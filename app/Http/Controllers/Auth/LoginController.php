<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Support\DemoAccessManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function __construct(
        private readonly DemoAccessManager $demo
    ) {}

    public function show(Request $request): View|Response
    {
        $demoAccess = $this->demo->loginViewPayload();

        if ($request->query('fallback') === 'blade' || $request->routeIs('blade-login')) {
            return view('auth.login', [
                'demoAccess' => $demoAccess,
            ]);
        }

        return Inertia::render('Auth/Login', [
            'heading' => 'Masuk ke dashboard',
            'brand' => 'Mutiara Florist',
            'demoAccess' => $demoAccess,
        ]);
    }

    public function showBlade(): View
    {
        return view('auth.login', [
            'demoAccess' => $this->demo->loginViewPayload(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $normalizedEmail = strtolower(trim((string) $credentials['email']));
        $credentials['email'] = $normalizedEmail;

        if ($this->demo->isDemoRuntime()) {
            return $this->authenticateDemoRuntime($request, $credentials);
        }

        return $this->authenticateProductionRuntime($request, $credentials);
    }

    private function authenticateProductionRuntime(Request $request, array $credentials): RedirectResponse
    {
        // Production runtime must NEVER authenticate the demo account.
        if ($this->demo->isDemoEmail($credentials['email'])) {
            return back()->withErrors([
                'email' => 'Email atau password tidak sesuai.',
            ])->onlyInput('email');
        }

        if (! Auth::attempt($credentials)) {
            return back()->withErrors([
                'email' => 'Email atau password tidak sesuai.',
            ])->onlyInput('email');
        }

        $request->session()->regenerate();
        $request->session()->put('mfms_runtime_mode', 'production');

        $target = $request->header('X-Inertia')
            ? route('ui-dashboard', absolute: false)
            : route('dashboard', absolute: false);

        return redirect()
            ->intended($target)
            ->withCookie(Cookie::forget($this->demo->routingCookieName(), '/'));
    }

    private function authenticateDemoRuntime(Request $request, array $credentials): RedirectResponse
    {
        if (! $this->demo->isActive()) {
            return back()->withErrors([
                'email' => $this->demo->inactiveReason(),
            ])->onlyInput('email');
        }

        // Demo runtime only accepts the single configured demo evaluator account.
        if (! $this->demo->isDemoEmail($credentials['email'])) {
            return back()->withErrors([
                'email' => 'Email atau password tidak sesuai.',
            ])->onlyInput('email');
        }

        $configuredPassword = $this->demo->demoPassword();
        if ($configuredPassword === null || ! hash_equals($configuredPassword, (string) $credentials['password'])) {
            return back()->withErrors([
                'email' => 'Email atau password tidak sesuai.',
            ])->onlyInput('email');
        }

        if (! Auth::attempt($credentials)) {
            return back()->withErrors([
                'email' => 'Email atau password tidak sesuai.',
            ])->onlyInput('email');
        }

        $request->session()->regenerate();
        $request->session()->put('mfms_runtime_mode', 'demo');

        $target = $request->header('X-Inertia')
            ? route('ui-dashboard', absolute: false)
            : route('dashboard', absolute: false);

        $isSecure = (bool) config('session.secure', $request->isSecure());
        $lifetime = (int) config('session.lifetime', 120);
        $routingCookie = Cookie::make(
            name: $this->demo->routingCookieName(),
            value: $this->demo->routingCookieValue(),
            minutes: $lifetime,
            path: '/',
            domain: config('session.domain'),
            secure: $isSecure,
            httpOnly: true,
            raw: false,
            sameSite: (string) config('session.same_site', 'lax')
        );

        return redirect()
            ->intended($target)
            ->withCookie($routingCookie);
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()
            ->route('login')
            ->withCookie(Cookie::forget($this->demo->routingCookieName(), '/'));
    }
}
