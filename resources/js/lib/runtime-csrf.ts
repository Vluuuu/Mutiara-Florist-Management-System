import { http } from '@inertiajs/react';
import type { RuntimeContext } from '@/types';

export const SESSION_EXPIRED_MESSAGE = 'Sesi telah berakhir. Silakan masuk kembali.';

const DEFAULT_RUNTIME_CONTEXT: RuntimeContext = {
    mode: 'production',
    xsrf_cookie: 'MFMS-PROD-XSRF-TOKEN',
    xsrf_header: 'X-MFMS-PROD-XSRF-TOKEN',
    runtime_header: 'X-MFMS-Runtime',
};

let lockedRuntimeContext: RuntimeContext | null = null;
let runtimeCsrfInitialized = false;

function readMeta(name: string): string | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const value = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content?.trim();

    return value && value.length > 0 ? value : null;
}

/**
 * Resolves and locks this browser tab's runtime identity at initial page bootstrap.
 * Locking per tab ensures stale admin/demo tabs always declare the runtime they were
 * rendered by and never silently read or submit against the opposite runtime's cookies.
 */
export function getTabRuntimeContext(): RuntimeContext {
    if (lockedRuntimeContext) {
        return lockedRuntimeContext;
    }

    const rawMode = readMeta('mfms-runtime');
    const mode: 'production' | 'demo' = rawMode === 'demo' ? 'demo' : 'production';
    const defaultXsrfCookie = mode === 'demo' ? 'MFMS-DEMO-XSRF-TOKEN' : 'MFMS-PROD-XSRF-TOKEN';
    const defaultXsrfHeader = mode === 'demo' ? 'X-MFMS-DEMO-XSRF-TOKEN' : 'X-MFMS-PROD-XSRF-TOKEN';

    lockedRuntimeContext = {
        mode,
        xsrf_cookie: readMeta('mfms-xsrf-cookie') ?? defaultXsrfCookie,
        xsrf_header: readMeta('mfms-xsrf-header') ?? defaultXsrfHeader,
        runtime_header: readMeta('mfms-runtime-header') ?? DEFAULT_RUNTIME_CONTEXT.runtime_header,
    };

    return lockedRuntimeContext;
}

export function getRuntimeRequestHeaders(): Record<string, string> {
    const ctx = getTabRuntimeContext();

    return {
        [ctx.runtime_header]: ctx.mode,
    };
}

export function isSafeRelativeRecoveryUrl(url: unknown): url is string {
    return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//');
}

export function resolveSessionRecoveryUrl(
    responseData: unknown,
    tabMode: 'production' | 'demo' = getTabRuntimeContext().mode,
): string {
    if (responseData && typeof responseData === 'object' && 'recovery_url' in responseData) {
        const candidate = (responseData as { recovery_url?: unknown }).recovery_url;
        if (isSafeRelativeRecoveryUrl(candidate)) {
            return candidate;
        }
    }

    return tabMode === 'demo' ? '/demo?session_expired=1' : '/login?session_expired=1';
}

/**
 * Configures Inertia.js v3's built-in XHR client (no Axios dependency) to use
 * runtime-specific XSRF cookies/headers, declare the tab's locked runtime on
 * every request, and reload pages restored from bfcache.
 */
export function initRuntimeCsrf(): RuntimeContext {
    const ctx = getTabRuntimeContext();

    if (runtimeCsrfInitialized || typeof window === 'undefined') {
        return ctx;
    }
    runtimeCsrfInitialized = true;

    http.setClient({
        xsrfCookieName: ctx.xsrf_cookie,
        xsrfHeaderName: ctx.xsrf_header,
    });

    http.onRequest((config) => ({
        ...config,
        headers: {
            ...config.headers,
            [ctx.runtime_header]: ctx.mode,
        },
    }));

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            window.location.reload();
        }
    });

    return ctx;
}
