<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class Phase9Sprint1LocalizationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['name' => 'Sari Wijaya']);
    }

    public function test_seven_form_requests_emit_indonesian_validation_messages(): void
    {
        // 1. CustomerRequest
        $this->actingAs($this->admin)
            ->post('/ui-customers', ['name' => ''])
            ->assertSessionHasErrors('name');
        $custErr = session('errors')->first('name');
        $this->assertStringContainsStringIgnoringCase('nama pelanggan', $custErr);
        $this->assertStringContainsStringIgnoringCase('wajib diisi', $custErr);

        // 2. OrderRequest (header & dynamic Bunga #1 item label)
        $customer = Customer::query()->create(['name' => 'PT Mawar Sejahtera']);
        $this->actingAs($this->admin)
            ->post('/ui-orders', [
                'customer_id' => $customer->id,
                'order_date' => '2026-11-17',
                'items' => [
                    [
                        'flower_type' => '',
                        'recipient' => '',
                        'sender_name' => '',
                        'delivery_date' => '2026-11-17',
                        'delivery_location' => '',
                        'quantity' => 1,
                        'unit_price' => 100000,
                        'shipping_mode' => 'SEPARATE',
                        'shipping_fee' => 0,
                    ],
                ],
            ])
            ->assertSessionHasErrors([
                'items.0.flower_type',
                'items.0.recipient',
                'items.0.sender_name',
                'items.0.delivery_location',
                'items.0.shipping_fee',
            ]);

        $orderErrors = session('errors');
        $this->assertStringContainsString('Bunga #1 (jenis bunga)', $orderErrors->first('items.0.flower_type'));
        $this->assertStringContainsString('wajib diisi', $orderErrors->first('items.0.flower_type'));
        $this->assertStringNotContainsString('items.0.', $orderErrors->first('items.0.flower_type'));
        $this->assertStringContainsString('Ongkir terpisah harus lebih dari Rp0.', $orderErrors->first('items.0.shipping_fee'));

        $order = new Order();
        $order->forceFill([
            'order_number' => 'MF-261117-LOC1',
            'customer_id' => $customer->id,
            'created_by' => $this->admin->id,
            'order_date' => '2026-11-17',
            'status' => 'NEW',
            'total_amount' => 500000,
        ]);
        $order->save();

        // 3. StorePaymentRequest
        $this->actingAs($this->admin)
            ->post("/ui-orders/{$order->id}/payments", [
                'payment_date' => '2026-11-17',
                'amount' => 0,
                'method' => 'INVALID',
                'idempotency_key' => 'not-uuid',
            ])
            ->assertSessionHasErrors(['amount', 'method', 'idempotency_key']);
        $payErr = session('errors');
        $this->assertStringContainsStringIgnoringCase('nominal pembayaran', $payErr->first('amount'));
        $this->assertStringContainsStringIgnoringCase('metode pembayaran', $payErr->first('method'));

        // 4. VoidPaymentRequest
        $payment = new Payment();
        $payment->forceFill([
            'order_id' => $order->id,
            'recorded_by' => $this->admin->id,
            'payment_date' => '2026-11-17',
            'amount' => 100000,
            'method' => 'CASH',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ]);
        $payment->save();
        $this->actingAs($this->admin)
            ->post("/ui-orders/{$order->id}/payments/{$payment->id}/void", ['void_reason' => 'pendek'])
            ->assertSessionHasErrors('void_reason');
        $this->assertStringContainsString('minimal 10 karakter', session('errors')->first('void_reason'));

        // 5. StoreExpenseRequest
        $this->actingAs($this->admin)
            ->post('/ui-expenses', [
                'expense_category_id' => 999999,
                'expense_date' => '2026-11-17',
                'amount' => 0,
                'description' => 'a',
                'idempotency_key' => (string) Str::uuid(),
            ])
            ->assertSessionHasErrors(['expense_category_id', 'amount', 'description']);
        $expErr = session('errors');
        $this->assertStringContainsStringIgnoringCase('kategori biaya', $expErr->first('expense_category_id'));
        $this->assertStringContainsString('Nominal pengeluaran minimal Rp1.', $expErr->first('amount'));

        // 6. VoidExpenseRequest
        $cat = new ExpenseCategory();
        $cat->forceFill(['name' => 'Bunga Segar Sprint 1', 'is_active' => true]);
        $cat->save();

        $expense = new Expense();
        $expense->forceFill([
            'expense_category_id' => $cat->id,
            'recorded_by' => $this->admin->id,
            'expense_date' => '2026-11-17',
            'amount' => 50000,
            'description' => 'Belanja daun',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
        ]);
        $expense->save();
        $this->actingAs($this->admin)
            ->post("/ui-expenses/{$expense->id}/void", ['void_reason' => 'kurang'])
            ->assertSessionHasErrors('void_reason');
        $this->assertStringContainsString('minimal 10 karakter', session('errors')->first('void_reason'));

        // 7. ExpenseCategoryRequest
        $this->actingAs($this->admin)
            ->post('/ui-expense-categories', ['name' => 'Bunga Segar Sprint 1'])
            ->assertSessionHasErrors('name');
        $this->assertStringContainsString('sudah terdaftar', session('errors')->first('name'));
    }

    public function test_ui_expense_index_formats_dates_in_asia_jakarta(): void
    {
        $cat = new ExpenseCategory();
        $cat->forceFill(['name' => 'Kurir', 'is_active' => true]);
        $cat->save();
        $wibVoidTime = Carbon::create(2026, 11, 17, 18, 30, 0, 'Asia/Jakarta');

        $exp = new Expense();
        $exp->forceFill([
            'expense_category_id' => $cat->id,
            'recorded_by' => $this->admin->id,
            'expense_date' => '2026-11-17',
            'amount' => 75000,
            'description' => 'Ongkir malam WIB',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'VOIDED',
            'void_reason' => 'Dibatalkan uji zona waktu Indonesia Barat',
            'voided_at' => $wibVoidTime,
        ]);
        $exp->save();

        $this->actingAs($this->admin)
            ->get('/ui-expenses')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('expenses.data.0.expense_date', '17/11/2026')
                ->where('expenses.data.0.voided_at', '17/11/2026 18:30 WIB')
                ->etc());
    }

    public function test_dashboard_exposes_synced_botanical_navigation_props(): void
    {
        $this->actingAs($this->admin)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('nav.uiOrdersCreate', route('ui-orders.create'))
                ->where('nav.uiOrders', route('ui-orders.index'))
                ->where('nav.uiPayments', route('ui-payments.index'))
                ->where('nav.uiCustomers', route('ui-customers.index'))
                ->where('nav.uiExpenses', route('ui-expenses.index'))
                ->where('nav.uiExpenseCategories', route('ui-expense-categories.index'))
                ->where('nav.uiReports', route('ui-reports.index'))
                ->etc());
    }

    public function test_flash_success_shared_with_inertia_after_expense_category_store(): void
    {
        $response = $this->actingAs($this->admin)
            ->post('/ui-expense-categories', ['name' => 'Perlengkapan Pita Patch01']);

        $response->assertRedirect('/ui-expense-categories');

        $this->actingAs($this->admin)
            ->get('/ui-expense-categories')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('flash.success', fn ($msg) => is_string($msg) && $msg !== '')
                ->etc());
    }
}
