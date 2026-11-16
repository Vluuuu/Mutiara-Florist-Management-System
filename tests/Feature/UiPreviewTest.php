<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UiPreviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/ui-preview')->assertRedirect(route('login'));
    }

    public function test_admin_can_open_react_preview_without_changing_legacy_dashboard(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/ui-preview')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Preview')
                ->where('user.name', $user->name)
                ->where('dashboardUrl', route('dashboard'))
                ->etc());

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertOk();
    }
}
