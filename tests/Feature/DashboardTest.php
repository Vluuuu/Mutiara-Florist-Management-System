<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_uses_payments_for_cash_and_not_order_amount(): void
    {
        $user = User::factory()->create();
        $customerId = DB::table('customers')->insertGetId([
            'name' => 'Pelanggan Contoh',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $orderId = DB::table('orders')->insertGetId([
            'order_number' => 'TEST-0001',
            'customer_id' => $customerId,
            'created_by' => $user->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 1000000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('payments')->insert([
            'order_id' => $orderId,
            'recorded_by' => $user->id,
            'payment_date' => now()->toDateString(),
            'amount' => 250000,
            'method' => 'transfer',
            'idempotency_key' => (string) Str::uuid(),
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $categoryId = DB::table('expense_categories')->insertGetId([
            'name' => 'Pengiriman',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('expenses')->insert([
            'expense_category_id' => $categoryId,
            'recorded_by' => $user->id,
            'expense_date' => now()->toDateString(),
            'amount' => 50000,
            'description' => 'Biaya kurir contoh',
            'status' => 'POSTED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertOk()
            ->assertSee('Rp1.000.000')
            ->assertSee('Rp250.000')
            ->assertSee('Rp750.000')
            ->assertSee('Rp50.000');
    }
}
