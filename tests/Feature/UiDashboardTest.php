<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DashboardService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UiDashboardTest extends TestCase
{
    use RefreshDatabase;

    private int $userId;
    private int $customerId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->userId = User::factory()->create()->id;
        $this->customerId = DB::table('customers')->insertGetId([
            'name' => 'Pelanggan Uji React',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertOrder(int $totalAmount, string $orderNumber = 'UI-TEST-0001'): int
    {
        return DB::table('orders')->insertGetId([
            'order_number' => $orderNumber,
            'customer_id' => $this->customerId,
            'created_by' => $this->userId,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => $totalAmount,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertPayment(int $orderId, int $amount, string $status): void
    {
        DB::table('payments')->insert([
            'order_id' => $orderId,
            'recorded_by' => $this->userId,
            'payment_date' => now()->toDateString(),
            'amount' => $amount,
            'method' => 'transfer',
            'idempotency_key' => (string) Str::uuid(),
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertExpense(int $amount, string $status, string $name = 'Pengeluaran Uji'): void
    {
        // Nama kategori unik; pakai ulang kategori yang sudah ada agar test yang
        // memasukkan beberapa pengeluaran tidak melanggar constraint.
        $categoryId = DB::table('expense_categories')->where('name', $name)->value('id');

        if ($categoryId === null) {
            $categoryId = DB::table('expense_categories')->insertGetId([
                'name' => $name,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('expenses')->insert([
            'expense_category_id' => $categoryId,
            'recorded_by' => $this->userId,
            'expense_date' => now()->toDateString(),
            'amount' => $amount,
            'description' => 'Pengeluaran uji',
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/ui-dashboard')->assertRedirect(route('login'));
    }

    public function test_react_dashboard_shows_backend_stats_for_authenticated_user(): void
    {
        $orderId = $this->insertOrder(1000000, 'UI-TEST-0001');
        $this->insertOrder(500000, 'UI-TEST-0002');
        $this->insertPayment($orderId, 250000, 'POSTED');
        $this->insertExpense(50000, 'POSTED');

        $this->actingAs(User::find($this->userId))
            ->get('/ui-dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('stats.orders', 2)
                ->where('stats.billed', 1500000)
                ->where('stats.received', 250000)
                ->where('stats.outstanding', 1250000)
                ->where('stats.expenses', 50000)
                ->where('stats.cash_flow', 200000)
                ->where('nav.customers', route('customers.index'))
                ->where('nav.orders', route('orders.index'))
                ->where('nav.logout', route('logout'))
                ->etc());
    }

    public function test_only_posted_payments_count_toward_cash_and_outstanding(): void
    {
        $orderId = $this->insertOrder(1000000);
        $this->insertPayment($orderId, 400000, 'POSTED');
        $this->insertPayment($orderId, 250000, 'VOIDED');

        $this->actingAs(User::find($this->userId))
            ->get('/ui-dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.received', 400000)
                ->where('stats.outstanding', 600000)
                ->where('stats.cash_flow', 400000)
                ->etc());
    }

    public function test_only_posted_expenses_count_toward_cash_difference(): void
    {
        $orderId = $this->insertOrder(300000);
        $this->insertPayment($orderId, 300000, 'POSTED');
        $this->insertExpense(50000, 'POSTED', 'Kategori Uji A');
        $this->insertExpense(20000, 'VOIDED', 'Kategori Uji B');

        $this->actingAs(User::find($this->userId))
            ->get('/ui-dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.expenses', 50000)
                ->where('stats.cash_flow', 250000)
                ->etc());
    }

    public function test_outstanding_is_billed_minus_posted_received_and_never_negative(): void
    {
        // Overpayment guard biasanya mencegah kasus ini; insert langsung memverifikasi
        // bahwa piutang tidak pernah negatif di dashboard.
        $orderId = $this->insertOrder(300000);
        $this->insertPayment($orderId, 500000, 'POSTED');

        $this->actingAs(User::find($this->userId))
            ->get('/ui-dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.outstanding', 0)
                ->etc());
    }

    public function test_react_dashboard_matches_legacy_blade_dashboard_numbers(): void
    {
        $orderId = $this->insertOrder(1000000);
        $this->insertPayment($orderId, 250000, 'POSTED');
        $this->insertPayment($orderId, 100000, 'VOIDED');
        $this->insertExpense(50000, 'POSTED');
        $this->insertExpense(20000, 'VOIDED');

        $stats = app(DashboardService::class)->stats();

        $this->actingAs(User::find($this->userId))
            ->get('/ui-dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.orders', $stats['orders'])
                ->where('stats.billed', $stats['billed'])
                ->where('stats.received', $stats['received'])
                ->where('stats.outstanding', $stats['outstanding'])
                ->where('stats.expenses', $stats['expenses'])
                ->where('stats.cash_flow', $stats['cash_flow'])
                ->etc());

        // Dashboard Blade lama harus menampilkan angka yang sama.
        $this->actingAs(User::find($this->userId))
            ->get('/dashboard')
            ->assertOk()
            ->assertSee('Rp1.000.000')
            ->assertSee('Rp250.000')
            ->assertSee('Rp750.000')
            ->assertSee('Rp50.000')
            ->assertSee('Rp200.000');
    }

    public function test_legacy_blade_dashboard_still_works_after_service_extraction(): void
    {
        $this->actingAs(User::find($this->userId))
            ->get('/dashboard')
            ->assertOk()
            ->assertSee('Dashboard');
    }

    public function test_react_dashboard_provides_today_stats_separate_from_cumulative_stats(): void
    {
        $yesterday = now('Asia/Jakarta')->subDay()->toDateString();
        $today = now('Asia/Jakarta')->toDateString();

        $oldOrderId = DB::table('orders')->insertGetId([
            'order_number' => 'UI-OLD-0001',
            'customer_id' => $this->customerId,
            'created_by' => $this->userId,
            'order_date' => $yesterday,
            'status' => 'NEW',
            'total_amount' => 700000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $todayOrderId = DB::table('orders')->insertGetId([
            'order_number' => 'UI-TODAY-0001',
            'customer_id' => $this->customerId,
            'created_by' => $this->userId,
            'order_date' => $today,
            'status' => 'READY',
            'total_amount' => 500000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('order_items')->insert([
            [
                'order_id' => $oldOrderId,
                'flower_type' => 'Buket Lama',
                'recipient' => 'Penerima Lama',
                'sender_name' => 'Pengirim',
                'delivery_date' => $yesterday,
                'delivery_location' => 'Jakarta',
                'quantity' => 1,
                'unit_price' => 700000,
                'shipping_mode' => 'INCLUDED',
                'shipping_fee' => 0,
                'fulfillment_status' => 'NEW',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'order_id' => $todayOrderId,
                'flower_type' => 'Buket Hari Ini',
                'recipient' => 'Penerima Hari Ini',
                'sender_name' => 'Pengirim',
                'delivery_date' => $today,
                'delivery_location' => 'Jakarta',
                'quantity' => 1,
                'unit_price' => 500000,
                'shipping_mode' => 'INCLUDED',
                'shipping_fee' => 0,
                'fulfillment_status' => 'READY',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        DB::table('payments')->insert([
            'order_id' => $oldOrderId,
            'recorded_by' => $this->userId,
            'payment_date' => $yesterday,
            'amount' => 200000,
            'method' => 'TRANSFER',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->insertPayment($todayOrderId, 300000, 'POSTED');
        $this->insertPayment($todayOrderId, 100000, 'VOIDED');
        $this->insertExpense(45000, 'POSTED', 'Kurir');
        $this->insertExpense(90000, 'VOIDED', 'Kurir');

        $this->actingAs(User::find($this->userId))
            ->get('/ui-dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('todayStats.today_iso', $today)
                ->where('todayStats.orders_count', 1)
                ->where('todayStats.orders_billed', 500000)
                ->where('todayStats.deliveries_total_today', 1)
                ->where('todayStats.deliveries_pending_today', 1)
                ->where('todayStats.deliveries_overdue', 1)
                ->where('todayStats.deliveries_ready', 1)
                ->where('todayStats.cash_in', 300000)
                ->where('todayStats.cash_in_count', 1)
                ->where('todayStats.cash_out', 45000)
                ->where('todayStats.open_receivables_count', 2)
                ->where('stats.orders', 2)
                ->where('stats.billed', 1200000)
                ->where('stats.received', 500000)
                ->where('stats.outstanding', 700000)
                ->etc());
    }
}
