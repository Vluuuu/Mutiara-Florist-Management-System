<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UiAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_ui_login_renders_react_component(): void
    {
        $this->get(route('ui-login'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Auth/Login')
            );
    }

    public function test_standard_login_renders_blade_view(): void
    {
        $this->get(route('login'))
            ->assertOk()
            ->assertSee('Masuk ke dashboard')
            ->assertSee('Mutiara Florist');
    }

    public function test_inertia_login_authenticates_and_redirects_to_ui_dashboard(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@mutiaraflorist.com',
            'password' => Hash::make('secret-password-123'),
        ]);

        $response = $this->withHeader('X-Inertia', 'true')
            ->post(route('login.store'), [
                'email' => 'admin@mutiaraflorist.com',
                'password' => 'secret-password-123',
            ]);

        $this->assertAuthenticatedAs($user);
        $response->assertRedirect(route('ui-dashboard'));
    }

    public function test_inertia_login_respects_intended_url(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@mutiaraflorist.com',
            'password' => Hash::make('secret-password-123'),
        ]);

        // Attempting to access protected page stores intended URL
        $this->get('/ui-orders')->assertRedirect(route('login'));

        $response = $this->withHeader('X-Inertia', 'true')
            ->post(route('login.store'), [
                'email' => 'admin@mutiaraflorist.com',
                'password' => 'secret-password-123',
            ]);

        $this->assertAuthenticatedAs($user);
        $response->assertRedirect('/ui-orders');
    }

    public function test_invalid_login_fails_with_errors(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@mutiaraflorist.com',
            'password' => Hash::make('correct-password'),
        ]);

        $this->withHeader('X-Inertia', 'true')
            ->post(route('login.store'), [
                'email' => 'admin@mutiaraflorist.com',
                'password' => 'wrong-password',
            ])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }
}
