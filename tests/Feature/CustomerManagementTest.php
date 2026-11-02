<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CustomerManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_access_customer_pages_or_modify_customers(): void
    {
        $customer = Customer::query()->create(['name' => 'Contoh Pelanggan']);

        $this->get('/customers')->assertRedirect(route('login'));
        $this->get('/customers/create')->assertRedirect(route('login'));
        $this->get("/customers/{$customer->id}")->assertRedirect(route('login'));
        $this->get("/customers/{$customer->id}/edit")->assertRedirect(route('login'));
        $this->post('/customers', ['name' => 'Tanpa Izin'])->assertRedirect(route('login'));
        $this->put("/customers/{$customer->id}", ['name' => 'Tanpa Izin'])->assertRedirect(route('login'));
        $this->delete("/customers/{$customer->id}")->assertRedirect(route('login'));

        $this->assertDatabaseMissing('customers', ['name' => 'Tanpa Izin']);
    }

    public function test_admin_can_create_customer_without_phone_or_notes_and_audit_it(): void
    {
        $admin = User::factory()->create();

        $response = $this->actingAs($admin)->post(route('customers.store'), [
            'name' => '  Bunga Pertiwi  ',
            'phone' => '',
            'notes' => '',
        ]);

        $customer = Customer::query()->firstOrFail();
        $response->assertRedirect(route('customers.show', $customer));
        $this->assertSame('Bunga Pertiwi', $customer->name);
        $this->assertNull($customer->phone);
        $this->assertNull($customer->notes);
        $this->assertDatabaseHas('audit_logs', [
            'subject_type' => 'customer',
            'subject_id' => $customer->id,
            'action' => 'customer.created',
            'actor_user_id' => $admin->id,
        ]);
    }

    public function test_name_is_required_and_lengths_are_limited(): void
    {
        $this->actingAs(User::factory()->create())->post(route('customers.store'), [
            'name' => '  ',
            'phone' => str_repeat('1', 51),
            'notes' => str_repeat('x', 2001),
        ])->assertSessionHasErrors(['name', 'phone', 'notes']);

        $this->assertDatabaseCount('customers', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_admin_can_edit_customer_and_changelog_contains_changed_fields(): void
    {
        $admin = User::factory()->create();
        $customer = Customer::query()->create([
            'name' => 'Sebelumnya',
            'phone' => '08111',
            'notes' => null,
        ]);

        $this->actingAs($admin)->put(route('customers.update', $customer), [
            'name' => 'Nama Baru',
            'phone' => '08222',
            'notes' => 'Pelanggan tetap',
        ])->assertRedirect(route('customers.show', $customer));

        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'name' => 'Nama Baru',
            'phone' => '08222',
            'notes' => 'Pelanggan tetap',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'customer.updated',
            'subject_id' => $customer->id,
            'actor_user_id' => $admin->id,
        ]);
    }

    public function test_search_finds_customers_by_name_and_phone(): void
    {
        Customer::query()->create(['name' => 'Ibu Mawar', 'phone' => '0812345678']);
        Customer::query()->create(['name' => 'Pak Melati', 'phone' => '0899123456']);

        $this->actingAs(User::factory()->create())
            ->get(route('customers.index', ['q' => 'Mawar']))
            ->assertOk()
            ->assertSee('Ibu Mawar')
            ->assertDontSee('Pak Melati');

        $this->get(route('customers.index', ['q' => '0899']))
            ->assertOk()
            ->assertSee('Pak Melati')
            ->assertDontSee('Ibu Mawar');
    }

    public function test_duplicate_phone_numbers_are_allowed(): void
    {
        $admin = User::factory()->create();

        $this->actingAs($admin)->post(route('customers.store'), [
            'name' => 'Pelanggan A',
            'phone' => '081234',
        ])->assertRedirect();

        $this->post(route('customers.store'), [
            'name' => 'Pelanggan B',
            'phone' => '081234',
        ])->assertRedirect();

        $this->assertDatabaseCount('customers', 2);
    }

    public function test_customer_with_no_orders_is_archived_not_hard_deleted(): void
    {
        $admin = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Tanpa Pesanan']);

        $this->actingAs($admin)->from(route('customers.show', $customer))
            ->delete(route('customers.destroy', $customer))
            ->assertRedirect(route('customers.index'));

        $this->assertSoftDeleted('customers', ['id' => $customer->id]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'customer.archived',
            'subject_id' => $customer->id,
            'actor_user_id' => $admin->id,
        ]);
        $this->get(route('customers.index'))->assertDontSee('Tanpa Pesanan');
        $this->get(route('customers.show', $customer))->assertNotFound();
    }

    public function test_customer_with_orders_cannot_be_archived(): void
    {
        $admin = User::factory()->create();
        $customer = Customer::query()->create(['name' => 'Ada Riwayat']);
        DB::table('orders')->insert([
            'order_number' => 'TEST-CUSTOMER-0001',
            'customer_id' => $customer->id,
            'created_by' => $admin->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 100000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($admin)
            ->from(route('customers.show', $customer))
            ->delete(route('customers.destroy', $customer))
            ->assertRedirect(route('customers.show', $customer))
            ->assertSessionHasErrors('customer');

        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'deleted_at' => null,
        ]);
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'customer.archived',
            'subject_id' => $customer->id,
        ]);
    }

    public function test_pagination_is_limited_to_ten_customers(): void
    {
        $admin = User::factory()->create();

        foreach (range(1, 12) as $number) {
            Customer::query()->create(['name' => 'Pelanggan '.str_pad((string) $number, 2, '0', STR_PAD_LEFT)]);
        }

        $this->actingAs($admin)->get(route('customers.index'))->assertOk()
            ->assertSee('Pelanggan 12')
            ->assertDontSee('Pelanggan 01');

        $this->get(route('customers.index', ['page' => 2]))->assertOk()->assertSee('Pelanggan 01');
    }

    public function test_customer_name_is_escaped_in_html(): void
    {
        Customer::query()->create(['name' => '<script>alert(1)</script>']);

        $this->actingAs(User::factory()->create())
            ->get(route('customers.index'))
            ->assertOk()
            ->assertSee('&lt;script&gt;alert(1)&lt;/script&gt;', false)
            ->assertDontSee('<script>alert(1)</script>', false);
    }
}
