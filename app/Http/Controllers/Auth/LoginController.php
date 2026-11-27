<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Support\DemoAccessManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class LoginController extends Controller
{
    public function __construct(
        private readonly DemoAccessManager $demo
    ) {}

    public function show(Request $request): View|Response
    {
        $demoAccess = $this->demo->loginViewPayload();
        $demoNavigation = $this->demo->loginNavigationPayload();
        $sessionNotice = $request->boolean('session_expired')
            ? $this->demo->sessionExpiredMessage()
            : $request->session()->get('session_expired_notice');

        if ($request->query('fallback') === 'blade' || $request->routeIs('blade-login')) {
            return view('auth.login', [
                'demoAccess' => $demoAccess,
                'demoNavigation' => $demoNavigation,
                'sessionNotice' => $sessionNotice,
            ]);
        }

        return Inertia::render('Auth/Login', [
            'heading' => 'Masuk ke dashboard',
            'brand' => 'Mutiara Florist',
            'demoAccess' => $demoAccess,
            'demoNavigation' => $demoNavigation,
            'sessionNotice' => $sessionNotice,
        ]);
    }

    public function showBlade(Request $request): View
    {
        return view('auth.login', [
            'demoAccess' => $this->demo->loginViewPayload(),
            'sessionNotice' => $request->boolean('session_expired')
                ? $this->demo->sessionExpiredMessage()
                : $request->session()->get('session_expired_notice'),
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
            ->withCookie($this->demo->forgetRoutingCookie($request))
            ->withCookie($this->demo->forgetCookie($request, 'mfms_demo_session', httpOnly: true))
            ->withCookie($this->demo->forgetCookie($request, $this->demo->demoXsrfCookieName(), httpOnly: false));
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

        return redirect()
            ->intended($target)
            ->withCookie($this->demo->makeRoutingCookie($request));
    }

    public function destroy(Request $request): SymfonyResponse
    {
        $isDemoRuntime = $this->demo->isDemoRuntime();

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $expiredRoutingCookie = $this->demo->forgetRoutingCookie($request);

        // When leaving the isolated demo runtime via Inertia, force a full-page
        // navigation so the browser cleanly boots the primary runtime's CSRF context.
        if ($isDemoRuntime && $request->header('X-Inertia')) {
            $response = Inertia::location(route('login'));
            $response->headers->setCookie($expiredRoutingCookie);
            $response->headers->setCookie(
                $this->demo->forgetCookie($request, $this->demo->xsrfCookieName(), httpOnly: false)
            );

            return $response;
        }

        $redirect = redirect()
            ->route('login')
            ->withCookie($expiredRoutingCookie);

        if ($isDemoRuntime) {
            $redirect->withCookie(
                $this->demo->forgetCookie($request, $this->demo->xsrfCookieName(), httpOnly: false)
            );
        }

        return $redirect;
    }
}
