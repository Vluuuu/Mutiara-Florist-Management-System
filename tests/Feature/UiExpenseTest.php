<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UiExpenseTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private ExpenseCategory $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['name' => 'Admin Penguji']);
        $this->category = new ExpenseCategory();
        $this->category->forceFill([
            'name' => 'Pengiriman & Kurir',
            'is_active' => true,
        ]);
        $this->category->save();
    }

    public function test_guest_cannot_access_ui_expenses_or_categories(): void
    {
        $this->get('/ui-expenses')->assertRedirect(route('login'));
        $this->get('/ui-expenses/create')->assertRedirect(route('login'));
        $this->post('/ui-expenses', [])->assertRedirect(route('login'));
        $this->get('/ui-expense-categories')->assertRedirect(route('login'));
        $this->post('/ui-expense-categories', [])->assertRedirect(route('login'));
    }

    public function test_admin_can_view_expenses_list_with_metrics_and_filters(): void
    {
        $expense1 = new Expense();
        $expense1->forceFill([
            'expense_category_id' => $this->category->id,
            'recorded_by' => $this->admin->id,
            'expense_date' => now()->toDateString(),
            'amount' => 150000,
            'description' => 'Ongkir kurir wilayah Jakarta Barat',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ]);
        $expense1->save();

        $expense2 = new Expense();
        $expense2->forceFill([
            'expense_category_id' => $this->category->id,
            'recorded_by' => $this->admin->id,
            'expense_date' => now()->toDateString(),
            'amount' => 50000,
            'description' => 'Salah catat ongkir',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'VOIDED',
            'void_reason' => 'Salah input tanggal dan armada pengiriman',
            'voided_at' => now(),
        ]);
        $expense2->save();

        // Total posted should only be 150,000 (VOIDED is excluded)
        $this->actingAs($this->admin)
            ->get(route('ui-expenses.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Expenses/Index')
                ->where('postedTotal', 150000)
                ->has('expenses.data', 2)
            );
    }

    public function test_admin_can_record_expense(): void
    {
        $uuid = (string) Str::uuid();

        $response = $this->actingAs($this->admin)
            ->post(route('ui-expenses.store'), [
                'expense_category_id' => $this->category->id,
                'expense_date' => now()->toDateString(),
                'amount' => 275000,
                'description' => 'Pembelian busa oasis dan pita satin',
                'idempotency_key' => $uuid,
            ]);

        $response->assertRedirect(route('ui-expenses.index'));

        $this->assertDatabaseHas('expenses', [
            'expense_category_id' => $this->category->id,
            'amount' => 275000,
            'status' => 'POSTED',
            'idempotency_key' => $uuid,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'expense.posted',
        ]);
    }

    public function test_admin_can_void_expense_with_valid_reason(): void
    {
        $expense = new Expense();
        $expense->forceFill([
            'expense_category_id' => $this->category->id,
            'recorded_by' => $this->admin->id,
            'expense_date' => now()->toDateString(),
            'amount' => 100000,
            'description' => 'Pembelian cutter dan lem tembak',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ]);
        $expense->save();

        $response = $this->actingAs($this->admin)
            ->post(route('ui-expenses.void', $expense), [
                'void_reason' => 'Nota pembelian ganda tidak sengaja terinput dua kali',
            ]);

        $response->assertRedirect(route('ui-expenses.index'));

        $expense->refresh();
        $this->assertSame('VOIDED', $expense->status);
        $this->assertSame('Nota pembelian ganda tidak sengaja terinput dua kali', $expense->void_reason);
        $this->assertNotNull($expense->voided_at);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'expense.voided',
        ]);
    }

    public function test_void_expense_requires_ten_characters(): void
    {
        $expense = new Expense();
        $expense->forceFill([
            'expense_category_id' => $this->category->id,
            'recorded_by' => $this->admin->id,
            'expense_date' => now()->toDateString(),
            'amount' => 100000,
            'description' => 'Biaya parkir mobil toko',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ]);
        $expense->save();

        $this->actingAs($this->admin)
            ->post(route('ui-expenses.void', $expense), [
                'void_reason' => 'Pendek',
            ])
            ->assertSessionHasErrors('void_reason');

        $expense->refresh();
        $this->assertSame('POSTED', $expense->status);
    }

    public function test_admin_can_manage_expense_categories(): void
    {
        // 1. Index
        $this->actingAs($this->admin)
            ->get(route('ui-expense-categories.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('ExpenseCategories/Index')
                ->has('categories', 1)
            );

        // 2. Create category
        $this->actingAs($this->admin)
            ->post(route('ui-expense-categories.store'), [
                'name' => 'Bahan Baku Bunga Segar',
            ])
            ->assertRedirect(route('ui-expense-categories.index'));

        $newCat = ExpenseCategory::query()->where('name', 'Bahan Baku Bunga Segar')->firstOrFail();
        $this->assertTrue((bool) $newCat->is_active);

        // 3. Rename category
        $this->actingAs($this->admin)
            ->put(route('ui-expense-categories.update', $newCat), [
                'name' => 'Bunga Segar & Daun Hias',
            ])
            ->assertRedirect(route('ui-expense-categories.index'));

        $newCat->refresh();
        $this->assertSame('Bunga Segar & Daun Hias', $newCat->name);

        // 4. Toggle status to inactive
        $this->actingAs($this->admin)
            ->patch(route('ui-expense-categories.status', $newCat), [
                'is_active' => 0,
            ])
            ->assertRedirect(route('ui-expense-categories.index'));

        $newCat->refresh();
        $this->assertFalse((bool) $newCat->is_active);

        // 5. Toggle status back to active
        $this->actingAs($this->admin)
            ->patch(route('ui-expense-categories.status', $newCat), [
                'is_active' => 1,
            ])
            ->assertRedirect(route('ui-expense-categories.index'));

        $newCat->refresh();
        $this->assertTrue((bool) $newCat->is_active);
    }
}
