<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UiCustomerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['name' => 'Admin Penguji']);
    }

    public function test_guests_cannot_access_ui_customer_pages_or_modify_customers(): void
    {
        $customer = Customer::query()->create(['name' => 'Pelanggan Tamu']);

        $this->get('/ui-customers')->assertRedirect(route('login'));
        $this->get('/ui-customers/create')->assertRedirect(route('login'));
        $this->post('/ui-customers', ['name' => 'Tamu'])->assertRedirect(route('login'));
        $this->get("/ui-customers/{$customer->id}")->assertRedirect(route('login'));
        $this->get("/ui-customers/{$customer->id}/edit")->assertRedirect(route('login'));
        $this->put("/ui-customers/{$customer->id}", ['name' => 'Tamu Edit'])->assertRedirect(route('login'));
        $this->delete("/ui-customers/{$customer->id}")->assertRedirect(route('login'));

        $this->assertDatabaseMissing('customers', ['name' => 'Tamu']);
        $this->assertDatabaseMissing('customers', ['name' => 'Tamu Edit']);
    }

    public function test_admin_can_view_customers_list_with_inertia(): void
    {
        Customer::query()->create(['name' => 'Pelanggan A', 'phone' => '08111']);
        Customer::query()->create(['name' => 'Pelanggan B', 'phone' => '08222']);

        $this->actingAs($this->admin)
            ->get(route('ui-customers.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Customers/Index')
                ->has('customers.data', 2)
                ->where('customers.total', 2)
                ->where('filters.q', '')
                ->where('nav.uiCustomers', route('ui-customers.index'))
                ->where('nav.customers', route('customers.index'))
                ->etc());
    }

    public function test_admin_can_create_customer_via_ui_route_and_it_is_audited(): void
    {
        $response = $this->actingAs($this->admin)->post(route('ui-customers.store'), [
            'name' => '  Ibu Dewi Sartika  ',
            'phone' => '08123456789',
            'notes' => 'Catatan pesanan rutin bunga anggrek',
        ]);

        $customer = Customer::query()->firstOrFail();

        $response->assertRedirect(route('ui-customers.show', $customer))
            ->assertSessionHas('success', 'Pelanggan berhasil ditambahkan.');

        $this->assertSame('Ibu Dewi Sartika', $customer->name);
        $this->assertSame('08123456789', $customer->phone);
        $this->assertSame('Catatan pesanan rutin bunga anggrek', $customer->notes);

        $this->assertDatabaseHas('audit_logs', [
            'subject_type' => 'customer',
            'subject_id' => $customer->id,
            'action' => 'customer.created',
            'actor_user_id' => $this->admin->id,
        ]);
    }

    public function test_validation_errors_prevent_creation_via_ui(): void
    {
        $this->actingAs($this->admin)->post(route('ui-customers.store'), [
            'name' => '   ',
            'phone' => str_repeat('0', 51),
            'notes' => str_repeat('c', 2001),
        ])->assertSessionHasErrors(['name', 'phone', 'notes']);

        $this->assertDatabaseCount('customers', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_duplicate_phone_numbers_are_permitted(): void
    {
        $this->actingAs($this->admin)->post(route('ui-customers.store'), [
            'name' => 'Pelanggan Kembar 1',
            'phone' => '081299990000',
        ])->assertRedirect();

        $this->post(route('ui-customers.store'), [
            'name' => 'Pelanggan Kembar 2',
            'phone' => '081299990000',
        ])->assertRedirect();

        $this->assertDatabaseCount('customers', 2);
    }

    public function test_admin_can_view_customer_details_via_ui(): void
    {
        $customer = Customer::query()->create([
            'name' => 'Bapak Sudirman',
            'phone' => '081333444555',
            'notes' => 'Langganan karangan bunga papan',
        ]);

        $this->actingAs($this->admin)
            ->get(route('ui-customers.show', $customer))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Customers/Show')
                ->where('customer.id', $customer->id)
                ->where('customer.name', 'Bapak Sudirman')
                ->where('customer.phone', '081333444555')
                ->where('customer.notes', 'Langganan karangan bunga papan')
                ->where('customer.orders_count', 0)
                ->etc());
    }

    public function test_admin_can_edit_customer_via_ui_and_changelog_is_recorded(): void
    {
        $customer = Customer::query()->create([
            'name' => 'Nama Lama',
            'phone' => '0811111111',
            'notes' => null,
        ]);

        $response = $this->actingAs($this->admin)->put(route('ui-customers.update', $customer), [
            'name' => 'Nama Diperbarui',
            'phone' => '0822222222',
            'notes' => 'Catatan baru',
        ]);

        $response->assertRedirect(route('ui-customers.show', $customer))
            ->assertSessionHas('success', 'Data pelanggan berhasil disimpan.');

        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'name' => 'Nama Diperbarui',
            'phone' => '0822222222',
            'notes' => 'Catatan baru',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'customer.updated',
            'subject_id' => $customer->id,
            'actor_user_id' => $this->admin->id,
        ]);
    }

    public function test_search_filters_customers_and_escapes_like_wildcards(): void
    {
        Customer::query()->create(['name' => 'Toko 100% Bunga', 'phone' => '081111']);
        Customer::query()->create(['name' => 'Toko 1000 Bunga', 'phone' => '082222']);
        Customer::query()->create(['name' => 'Ibu Siti_Nurhaliza', 'phone' => '083333']);

        // Pencarian dengan literal '%' harus menemukan '100%' bukan '1000'
        $this->actingAs($this->admin)
            ->get(route('ui-customers.index', ['q' => '100%']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('customers.data', 1)
                ->where('customers.data.0.name', 'Toko 100% Bunga')
                ->etc());

        // Pencarian dengan literal '_' harus menemukan 'Siti_Nurhaliza'
        $this->get(route('ui-customers.index', ['q' => 'Siti_']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('customers.data', 1)
                ->where('customers.data.0.name', 'Ibu Siti_Nurhaliza')
                ->etc());
    }

    public function test_customer_without_orders_can_be_archived_via_ui(): void
    {
        $customer = Customer::query()->create(['name' => 'Siap Arsip']);

        $response = $this->actingAs($this->admin)
            ->delete(route('ui-customers.destroy', $customer));

        $response->assertRedirect(route('ui-customers.index'))
            ->assertSessionHas('success', 'Pelanggan diarsipkan. Data tidak dihapus permanen.');

        $this->assertSoftDeleted('customers', ['id' => $customer->id]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'customer.archived',
            'subject_id' => $customer->id,
            'actor_user_id' => $this->admin->id,
        ]);

        // Route model binding harus mengembalikan 404 untuk pelanggan yang sudah diarsipkan
        $this->get(route('ui-customers.show', $customer))->assertNotFound();
    }

    public function test_customer_with_orders_cannot_be_archived_via_ui(): void
    {
        $customer = Customer::query()->create(['name' => 'Punya Order']);
        DB::table('orders')->insert([
            'order_number' => 'ORD-UI-001',
            'customer_id' => $customer->id,
            'created_by' => $this->admin->id,
            'order_date' => now()->toDateString(),
            'status' => 'NEW',
            'total_amount' => 500000,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($this->admin)
            ->from(route('ui-customers.show', $customer))
            ->delete(route('ui-customers.destroy', $customer));

        $response->assertRedirect(route('ui-customers.show', $customer))
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

    public function test_pagination_limits_to_ten_customers_per_page(): void
    {
        foreach (range(1, 15) as $i) {
            Customer::query()->create(['name' => 'Pelanggan '.str_pad((string) $i, 2, '0', STR_PAD_LEFT)]);
        }

        $this->actingAs($this->admin)
            ->get(route('ui-customers.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('customers.data', 10)
                ->where('customers.total', 15)
                ->where('customers.current_page', 1)
                ->where('customers.last_page', 2)
                ->etc());

        $this->get(route('ui-customers.index', ['page' => 2]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('customers.data', 5)
                ->where('customers.current_page', 2)
                ->etc());
    }
}
