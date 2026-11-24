<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Http\Controllers\UiExpenseController;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use App\Services\ExpenseService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class Phase13BFoundationRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_expenses_index_serializes_recorded_by_user_explicitly_while_preserving_fk(): void
    {
        $recorder = User::factory()->create([
            'name' => 'Siti Rahayu',
            'email' => 'siti.rahasia@example.test',
        ]);
        $viewer = User::factory()->create([
            'name' => 'Pemilik Toko',
        ]);

        $category = new ExpenseCategory();
        $category->forceFill(['name' => 'Belanja Bunga Segar', 'is_active' => true])->save();

        app(ExpenseService::class)->record([
            'expense_category_id' => $category->id,
            'expense_date' => now('Asia/Jakarta')->toDateString(),
            'amount' => 425000,
            'description' => 'Beli mawar dan lili putih untuk order pagi',
            'idempotency_key' => (string) Str::uuid(),
        ], $recorder->id);

        $this->actingAs($viewer)
            ->get(route('ui-expenses.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Expenses/Index')
                ->has('expenses.data', 1)
                ->where('expenses.data.0.recorded_by', $recorder->id)
                ->where('expenses.data.0.recorded_by_user.id', $recorder->id)
                ->where('expenses.data.0.recorded_by_user.name', 'Siti Rahayu')
                ->missing('expenses.data.0.recorded_by_user.email')
                ->missing('expenses.data.0.recorded_by_user.password')
                ->where('expenses.data.0.category.name', 'Belanja Bunga Segar')
            );
    }

    public function test_expenses_serializer_falls_back_safely_when_recorder_user_is_unavailable(): void
    {
        $recorder = User::factory()->create(['name' => 'Operator Lama']);
        $category = new ExpenseCategory();
        $category->forceFill(['name' => 'Kurir & Transportasi', 'is_active' => true])->save();

        $expense = app(ExpenseService::class)->record([
            'expense_category_id' => $category->id,
            'expense_date' => now('Asia/Jakarta')->toDateString(),
            'amount' => 85000,
            'description' => 'Biaya tol dan parkir pengiriman',
            'idempotency_key' => (string) Str::uuid(),
        ], $recorder->id);

        // Simulate missing/unavailable recorder relation while keeping FK intact
        $expense->load('category');
        $expense->setRelation('recordedBy', null);

        $serialized = UiExpenseController::formatExpenseForUi($expense);

        $this->assertSame($recorder->id, $serialized['recorded_by']);
        $this->assertNull($serialized['recorded_by_user']);
        $this->assertSame('Kurir & Transportasi', $serialized['category']['name']);
    }

    public function test_customer_show_returns_orders_for_full_width_history_section(): void
    {
        $admin = User::factory()->create(['name' => 'Admin Toko']);
        $customer = Customer::query()->create([
            'name' => 'PT Nusantara Prima',
            'phone' => '081200010001',
        ]);

        $order = app(OrderService::class)->create([
            'customer_id' => $customer->id,
            'order_date' => now('Asia/Jakarta')->toDateString(),
            'items' => [[
                'flower_type' => 'Papan Bunga Ucapan Selamat (2x1.2m)',
                'recipient' => 'Direksi Bank',
                'sender_name' => 'PT Nusantara Prima',
                'delivery_date' => now('Asia/Jakarta')->toDateString(),
                'delivery_location' => 'Jl. Sudirman Kav. 45',
                'quantity' => 1,
                'unit_price' => 850000,
                'shipping_mode' => 'INCLUDED',
                'shipping_fee' => 0,
            ]],
        ], $admin->id);

        $this->actingAs($admin)
            ->get(route('ui-customers.show', $customer))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Customers/Show')
                ->where('customer.name', 'PT Nusantara Prima')
                ->where('customer.orders_count', 1)
                ->has('orders', 1)
                ->where('orders.0.id', $order->id)
                ->where('orders.0.order_number', $order->order_number)
                ->where('orders.0.total_amount', 850000)
            );
    }
}
