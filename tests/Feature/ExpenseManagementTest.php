<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

class ExpenseManagementTest extends TestCase
{
    use RefreshDatabase;

    private function category(string $name = 'Pengiriman'): ExpenseCategory
    {
        $category = new ExpenseCategory();
        $category->forceFill(['name' => $name, 'is_active' => true])->save();

        return $category;
    }

    private function input(ExpenseCategory $category, int $amount = 55000, ?string $key = null): array
    {
        return [
            'expense_category_id' => $category->id,
            'expense_date' => '2026-11-02',
            'amount' => $amount,
            'description' => 'Ongkir kurir untuk bunga contoh',
            'idempotency_key' => $key ?? (string) Str::uuid(),
        ];
    }

    private function record(ExpenseCategory $category, array $data): Expense
    {
        $this->post(route('expenses.store'), $data)->assertRedirect(route('expenses.index'));

        return Expense::query()->orderByDesc('id')->firstOrFail();
    }

    public function test_guest_cannot_access_expense_or_category_routes(): void
    {
        $category = $this->category();

        $this->get(route('expenses.index'))->assertRedirect(route('login'));
        $this->get(route('expenses.create'))->assertRedirect(route('login'));
        $this->get(route('expense-categories.index'))->assertRedirect(route('login'));
        $this->post(route('expenses.store'), $this->input($category))->assertRedirect(route('login'));
        $this->post(route('expense-categories.store'), ['name' => 'Sewa'])->assertRedirect(route('login'));
        $this->put(route('expense-categories.update', $category), ['name' => 'Transport'])
            ->assertRedirect(route('login'));
        $this->post(route('expense-categories.status', $category), ['is_active' => 0])
            ->assertRedirect(route('login'));

        $this->assertDatabaseCount('expenses', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_category_can_be_created_and_duplicate_names_are_rejected(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $this->post(route('expense-categories.store'), ['name' => 'Pengiriman'])
            ->assertRedirect(route('expense-categories.index'));

        $this->post(route('expense-categories.store'), ['name' => 'Pengiriman'])
            ->assertSessionHasErrors('name');

        $category = ExpenseCategory::query()->firstOrFail();
        $this->assertTrue($category->is_active);
        $this->assertDatabaseCount('expense_categories', 1);
        $this->assertDatabaseHas('audit_logs', [
            'actor_user_id' => $user->id,
            'action' => 'expense_category.created',
            'subject_id' => $category->id,
        ]);
    }

    public function test_category_name_can_change_and_history_is_preserved_after_deactivation(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $category = $this->category();
        $expense = $this->record($category, $this->input($category));

        $this->put(route('expense-categories.update', $category), ['name' => 'Kurir'])
            ->assertRedirect();
        $this->assertSame('Kurir', $category->fresh()->name);

        $this->post(route('expense-categories.status', $category), ['is_active' => 0])
            ->assertRedirect();
        $this->assertFalse($category->fresh()->is_active);

        $this->assertSame($category->id, $expense->fresh()->expense_category_id);
        $this->assertSame('POSTED', $expense->fresh()->status);
        $this->get(route('expenses.index'))->assertOk()->assertSee('Kurir');

        $this->get(route('expenses.create'))->assertOk()->assertSee('Belum ada kategori biaya aktif');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'expense_category.deactivated',
            'subject_id' => $category->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'expense_category.renamed',
            'subject_id' => $category->id,
        ]);

        $this->post(route('expense-categories.status', $category), ['is_active' => 1])
            ->assertRedirect();
        $this->assertTrue($category->fresh()->is_active);
    }

    public function test_invalid_category_and_empty_category_list_are_safe(): void
    {
        $this->actingAs(User::factory()->create())
            ->get(route('expenses.create'))
            ->assertOk()
            ->assertSee('Belum ada kategori biaya aktif');

        $data = [
            'expense_category_id' => 987654,
            'expense_date' => '2026-11-02',
            'amount' => 100000,
            'description' => 'Biaya contoh',
            'idempotency_key' => (string) Str::uuid(),
        ];
        $this->post(route('expenses.store'), $data)->assertSessionHasErrors('expense_category_id');
        $this->assertDatabaseCount('expenses', 0);
    }

    public function test_posted_expense_affects_cash_out_but_not_order_value_or_payments(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $category = $this->category();

        $customerId = DB::table('customers')->insertGetId([
            'name' => 'Pelanggan Fiktif',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('orders')->insert([
            'order_number' => 'TEST-EXPENSE-ORDER',
            'customer_id' => $customerId,
            'created_by' => $user->id,
            'order_date' => '2026-11-02',
            'status' => 'NEW',
            'total_amount' => 200000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $expense = $this->record($category, $this->input($category));

        $this->assertSame('POSTED', $expense->status);
        $this->assertSame(55000, (int) $expense->amount);
        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseCount('expenses', 1);
        $this->assertDatabaseHas('audit_logs', [
            'actor_user_id' => $user->id,
            'action' => 'expense.posted',
            'subject_id' => $expense->id,
        ]);

        $this->get(route('dashboard'))->assertOk()
            ->assertSee('Rp200.000')
            ->assertSee('Rp55.000')
            ->assertSee('Rp-55.000');

        $this->get(route('expenses.index'))->assertOk()
            ->assertSee('Rp55.000')
            ->assertSee('Ongkir kurir untuk bunga contoh');
    }

    public function test_invalid_amount_and_description_cannot_create_expense(): void
    {
        $this->actingAs(User::factory()->create());
        $category = $this->category();
        $data = $this->input($category, 0);
        $data['description'] = 'a';

        $this->post(route('expenses.store'), $data)
            ->assertSessionHasErrors(['amount', 'description']);

        $data['amount'] = -50;
        $data['description'] = 'Keterangan benar';
        $this->post(route('expenses.store'), $data)->assertSessionHasErrors('amount');

        $data['amount'] = 1000000000000001;
        $this->post(route('expenses.store'), $data)->assertSessionHasErrors('amount');

        $this->assertDatabaseCount('expenses', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_inactive_category_cannot_receive_new_expense(): void
    {
        $this->actingAs(User::factory()->create());
        $category = $this->category();
        $this->post(route('expense-categories.status', $category), ['is_active' => 0])
            ->assertRedirect();

        $this->post(route('expenses.store'), $this->input($category))
            ->assertSessionHasErrors('expense_category_id');
        $this->assertDatabaseCount('expenses', 0);
    }

    public function test_same_idempotency_key_and_payload_do_not_duplicate_expense(): void
    {
        $this->actingAs(User::factory()->create());
        $category = $this->category();
        $data = $this->input($category);

        $first = $this->record($category, $data);
        $second = $this->record($category, $data);

        $this->assertSame($first->id, $second->id);
        $this->assertDatabaseCount('expenses', 1);
        $this->assertDatabaseCount('audit_logs', 1);
    }

    public function test_same_key_with_changed_payload_is_rejected(): void
    {
        $this->actingAs(User::factory()->create());
        $category = $this->category();
        $data = $this->input($category);
        $this->record($category, $data);

        $data['amount'] = 30000;
        $this->post(route('expenses.store'), $data)
            ->assertSessionHasErrors('idempotency_key');

        $this->assertDatabaseCount('expenses', 1);
    }

    public function test_void_requires_reason_preserves_original_row_and_updates_dashboard(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $category = $this->category();
        $expense = $this->record($category, $this->input($category));

        $this->post(route('expenses.void', $expense), ['void_reason' => 'salah'])
            ->assertSessionHasErrors('void_reason');
        $this->assertSame('POSTED', $expense->fresh()->status);

        $this->post(route('expenses.void', $expense), [
            'void_reason' => 'Biaya salah input, harus dicatat ulang',
        ])->assertRedirect(route('expenses.index'));

        $this->assertSame('VOIDED', $expense->fresh()->status);
        $this->assertNotNull($expense->fresh()->voided_at);
        $this->assertSame(55000, (int) $expense->fresh()->amount);
        $this->assertDatabaseCount('expenses', 1);
        $this->assertDatabaseHas('audit_logs', [
            'actor_user_id' => $user->id,
            'action' => 'expense.voided',
            'subject_id' => $expense->id,
        ]);
        $this->get(route('expenses.index'))->assertOk()->assertSee('VOIDED');
        $this->get(route('dashboard'))->assertOk()->assertSee('Rp0');
        $this->get(route('expenses.index'))->assertViewHas('postedTotal', 0);
    }

    public function test_cannot_void_twice_or_reuse_voided_idempotency_key(): void
    {
        $this->actingAs(User::factory()->create());
        $category = $this->category();
        $data = $this->input($category);
        $expense = $this->record($category, $data);

        $this->post(route('expenses.void', $expense), [
            'void_reason' => 'Input pertama keliru, dibatalkan',
        ])->assertRedirect();

        $this->post(route('expenses.void', $expense), [
            'void_reason' => 'Percobaan void kedua kalinya',
        ])->assertSessionHasErrors('void_reason');

        $this->post(route('expenses.store'), $data)
            ->assertSessionHasErrors('idempotency_key');

        $this->assertDatabaseCount('expenses', 1);
        $this->assertDatabaseCount('audit_logs', 2);
    }

    public function test_corrected_expense_after_void_uses_new_idempotency_key(): void
    {
        $this->actingAs(User::factory()->create());
        $category = $this->category();
        $old = $this->record($category, $this->input($category, 90000));

        $this->post(route('expenses.void', $old), [
            'void_reason' => 'Nominal ternyata lebih rendah dari itu',
        ])->assertRedirect();

        $this->record($category, $this->input($category, 55000));
        $this->assertDatabaseCount('expenses', 2);
        $this->assertSame(55000, (int) Expense::query()->where('status', 'POSTED')->sum('amount'));
        $this->get(route('expenses.index'))->assertViewHas('postedTotal', 55000);
    }

    public function test_expenses_can_be_filtered_by_category_date_status_and_search(): void
    {
        $this->actingAs(User::factory()->create());
        $shipping = $this->category('Kurir');
        $supplies = $this->category('Bahan');

        $first = $this->record($shipping, $this->input($shipping, 55000));
        $secondData = $this->input($supplies, 75000);
        $secondData['description'] = 'Pembelian busa bunga';
        $secondData['expense_date'] = '2026-11-05';
        $second = $this->record($supplies, $secondData);

        $this->get(route('expenses.index', [
            'category_id' => $shipping->id,
            'from' => '2026-11-01',
            'to' => '2026-11-03',
            'status' => 'POSTED',
            'q' => 'Ongkir',
        ]))->assertOk()
            ->assertSee('Ongkir kurir untuk bunga contoh')
            ->assertDontSee('Pembelian busa bunga')
            ->assertViewHas('postedTotal', 55000);

        $this->post(route('expenses.void', $first), [
            'void_reason' => 'Tidak jadi dibayar oleh florist',
        ])->assertRedirect();

        $this->get(route('expenses.index', ['status' => 'VOIDED']))
            ->assertOk()
            ->assertSee('Ongkir kurir untuk bunga contoh')
            ->assertDontSee('Pembelian busa bunga')
            ->assertViewHas('postedTotal', 0);

        $this->get(route('expenses.index'))->assertViewHas('postedTotal', 75000);

        $this->get(route('expenses.index', ['to' => '2026-11-03']))
            ->assertOk()
            ->assertViewHas('postedTotal', 0); // Only the VOIDED expense is before Nov 3.

        $this->get(route('expenses.index', ['from' => '2026-11-06', 'to' => '2026-11-01']))
            ->assertSessionHasErrors('to');
    }

    public function test_categories_are_never_deleted_and_expenses_are_not_editable_or_hard_deleted(): void
    {
        $this->assertFalse(Route::has('expense-categories.destroy'));
        $this->assertFalse(Route::has('expenses.destroy'));
        $this->assertFalse(Route::has('expenses.update'));
        $this->assertFalse(Route::has('expenses.edit'));
    }

    public function test_category_validation_prevents_empty_names_and_invalid_status(): void
    {
        $this->actingAs(User::factory()->create());
        $category = $this->category();

        $this->post(route('expense-categories.store'), ['name' => ' '])
            ->assertSessionHasErrors('name');

        $this->post(route('expense-categories.status', $category), ['is_active' => 'wrong'])
            ->assertSessionHasErrors('is_active');

        $this->assertTrue($category->fresh()->is_active);
        $this->assertDatabaseCount('expense_categories', 1);
    }
}
