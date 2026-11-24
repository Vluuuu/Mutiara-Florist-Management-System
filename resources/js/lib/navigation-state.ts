import { useEffect, useId, useSyncExternalStore } from 'react';
import { router } from '@inertiajs/react';

export type NavigationErrorInfo = {
    status?: number;
    title: string;
    message: string;
    url: string;
    component?: string | null;
    isAuthError: boolean;
};

export type PendingBlockedVisit = {
    url: string;
    component?: string | null;
    method: string;
};

export type NavigationSnapshot = {
    isNavigating: boolean;
    pendingUrl: string | null;
    pendingComponent: string | null;
    pendingFilterPath: string | null;
    lastNavigateType: 'visit' | 'history' | null;
    navigationError: NavigationErrorInfo | null;
    deferredErrors: Record<string, string>;
    hasDirtyForm: boolean;
    dirtyMessage: string | null;
    pendingBlockedVisit: PendingBlockedVisit | null;
};

type VisitLike = {
    id?: string | number;
    url?: URL | string;
    method?: string;
    prefetch?: boolean;
    component?: string | null;
    only?: string[];
};

type TrackedVisit = {
    id: string;
    url: string;
    path: string;
    component: string | null;
    method: string;
    only: string[];
    isDeferred: boolean;
    kind: 'nav' | 'filter' | 'mutation' | 'deferred';
};

const DEFERRED_PROP_KEYS = new Set([
    'receivables',
    'cashFlowPulse',
    'recentActivity',
    'reportBreakdowns',
    'reportTrends',
    'paymentHistory',
]);

let snapshot: NavigationSnapshot = {
    isNavigating: false,
    pendingUrl: null,
    pendingComponent: null,
    pendingFilterPath: null,
    lastNavigateType: null,
    navigationError: null,
    deferredErrors: {},
    hasDirtyForm: false,
    dirtyMessage: null,
    pendingBlockedVisit: null,
};

const listeners = new Set<() => void>();
const dirtyForms = new Map<string, string>();
const trackedVisits = new Map<string, TrackedVisit>();
const activePartialCounts = new Map<string, number>();

let activeForegroundVisitId: string | null = null;
let activeFilterVisitId: string | null = null;
let lastAttemptedVisit: { url: string; component?: string | null } | null = null;
let bypassDirtyGuardOnce = false;
let initialized = false;
let fallbackIdCounter = 0;

const DEFAULT_DIRTY_MESSAGE =
    'Ada perubahan pada formulir yang belum disimpan. Jika berpindah halaman sekarang, isian Anda akan hilang.';

function emit() {
    for (const listener of listeners) {
        listener();
    }
}

function updateSnapshot(patch: Partial<NavigationSnapshot>) {
    let changed = false;
    for (const key of Object.keys(patch) as Array<keyof NavigationSnapshot>) {
        if (snapshot[key] !== patch[key]) {
            changed = true;
            break;
        }
    }
    if (!changed) {
        return;
    }
    snapshot = {
        ...snapshot,
        ...patch,
    };
    emit();
}

function toUrlString(url?: URL | string): string {
    if (!url) {
        return typeof window !== 'undefined' ? window.location.href : '/';
    }
    return typeof url === 'string' ? url : url.toString();
}

function getPathname(url?: URL | string): string {
    if (!url) {
        return typeof window !== 'undefined' ? window.location.pathname : '/';
    }
    try {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        return new URL(String(url), origin).pathname;
    } catch {
        return String(url).split('?')[0] || '/';
    }
}

function getPathAndSearch(url?: URL | string): string {
    if (!url) return '';
    try {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const parsed = typeof url === 'string' ? new URL(url, origin) : url;
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return String(url);
    }
}

function isDeferredOnly(only?: string[]): boolean {
    if (!Array.isArray(only) || only.length === 0) {
        return false;
    }
    return only.every((key) => DEFERRED_PROP_KEYS.has(key));
}

function getVisitId(visit?: VisitLike): string {
    if (visit?.id !== undefined && visit.id !== null) {
        return String(visit.id);
    }
    fallbackIdCounter += 1;
    return `fallback-${fallbackIdCounter}`;
}

function pruneTrackedVisits() {
    if (trackedVisits.size <= 50) return;
    const keys = Array.from(trackedVisits.keys());
    for (let i = 0; i < keys.length - 30; i += 1) {
        const id = keys[i];
        if (id !== activeForegroundVisitId && id !== activeFilterVisitId) {
            trackedVisits.delete(id);
        }
    }
}

function syncBeforeUnload() {
    if (typeof window === 'undefined') return;
    if (dirtyForms.size > 0) {
        window.onbeforeunload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
            return '';
        };
    } else {
        window.onbeforeunload = null;
    }
}

function refreshDirtySnapshot() {
    const firstMessage = dirtyForms.values().next().value ?? null;
    updateSnapshot({
        hasDirtyForm: dirtyForms.size > 0,
        dirtyMessage: firstMessage,
    });
    syncBeforeUnload();
}

export function setFormDirty(formId: string, dirty: boolean, message = DEFAULT_DIRTY_MESSAGE) {
    if (dirty) {
        dirtyForms.set(formId, message);
    } else {
        dirtyForms.delete(formId);
    }
    refreshDirtySnapshot();
}

export function clearFormDirty(formId: string) {
    if (dirtyForms.delete(formId)) {
        refreshDirtySnapshot();
    }
}

export function clearAllDirtyForms() {
    if (dirtyForms.size > 0) {
        dirtyForms.clear();
        refreshDirtySnapshot();
    }
}

export function clearNavigationError() {
    if (snapshot.navigationError) {
        updateSnapshot({ navigationError: null });
    }
}

export function invalidateNavigationCache() {
    router.flushAll();
}

export function retryLastNavigation() {
    const target = snapshot.navigationError
        ? { url: snapshot.navigationError.url, component: snapshot.navigationError.component }
        : lastAttemptedVisit;

    clearNavigationError();

    if (!target) {
        router.reload();
        return;
    }

    router.visit(target.url, {
        component: target.component ?? undefined,
    });
}

export function confirmLeaveDirtyPage() {
    const target = snapshot.pendingBlockedVisit;
    clearAllDirtyForms();
    updateSnapshot({ pendingBlockedVisit: null });

    if (!target) return;

    bypassDirtyGuardOnce = true;
    try {
        router.visit(target.url, {
            component: target.component ?? undefined,
        });
    } finally {
        bypassDirtyGuardOnce = false;
    }
}

export function cancelLeaveDirtyPage() {
    if (snapshot.pendingBlockedVisit) {
        updateSnapshot({ pendingBlockedVisit: null });
    }
}

function setDeferredErrors(keys: string[], message: string) {
    if (keys.length === 0) return;
    const next = { ...snapshot.deferredErrors };
    for (const key of keys) {
        next[key] = message;
    }
    updateSnapshot({ deferredErrors: next });
}

export function clearDeferredErrors(keys?: string[]) {
    if (!keys || keys.length === 0) {
        if (Object.keys(snapshot.deferredErrors).length > 0) {
            updateSnapshot({ deferredErrors: {} });
        }
        return;
    }
    const next = { ...snapshot.deferredErrors };
    let changed = false;
    for (const key of keys) {
        if (key in next) {
            delete next[key];
            changed = true;
        }
    }
    if (changed) {
        updateSnapshot({ deferredErrors: next });
    }
}

function buildHttpErrorInfo(status: number | undefined, url: string, component?: string | null): NavigationErrorInfo {
    if (status === 401 || status === 419) {
        return {
            status,
            title: 'Sesi Anda telah berakhir',
            message: 'Silakan masuk kembali agar transaksi dan data keuangan tetap aman.',
            url,
            component,
            isAuthError: true,
        };
    }
    if (status === 403) {
        return {
            status,
            title: 'Akses halaman ditolak',
            message: 'Akun Anda tidak memiliki izin untuk membuka halaman ini.',
            url,
            component,
            isAuthError: false,
        };
    }
    if (status === 404) {
        return {
            status,
            title: 'Halaman atau data tidak ditemukan',
            message: 'Data yang Anda cari mungkin sudah dihapus atau URL tidak sesuai.',
            url,
            component,
            isAuthError: false,
        };
    }
    return {
        status,
        title: 'Gagal memuat halaman dari server',
        message: 'Terjadi kendala saat menghubungi server. Periksa koneksi lalu coba muat ulang.',
        url,
        component,
        isAuthError: false,
    };
}

function registerVisit(visit: VisitLike, fromBefore: boolean): TrackedVisit | null {
    if (visit.prefetch) {
        return null;
    }

    const id = getVisitId(visit);
    const existing = trackedVisits.get(id);
    if (existing) {
        return existing;
    }

    const method = (visit.method ?? 'get').toLowerCase();
    const only = Array.isArray(visit.only) ? visit.only : [];
    const isDeferred = isDeferredOnly(only);
    const targetUrl = toUrlString(visit.url);
    const targetPath = getPathname(visit.url);
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

    let kind: TrackedVisit['kind'];
    if (isDeferred) {
        kind = 'deferred';
    } else if (method !== 'get' && method !== 'query') {
        kind = 'mutation';
    } else if (targetPath === currentPath && !visit.component && fromBefore) {
        kind = 'filter';
    } else if (targetPath === currentPath && !visit.component && only.length > 0) {
        kind = 'filter';
    } else {
        kind = 'nav';
    }

    const record: TrackedVisit = {
        id,
        url: targetUrl,
        path: targetPath,
        component: visit.component ?? null,
        method,
        only,
        isDeferred,
        kind,
    };

    trackedVisits.set(id, record);
    pruneTrackedVisits();

    if (kind === 'nav') {
        activeForegroundVisitId = id;
        activeFilterVisitId = null;
        lastAttemptedVisit = {
            url: targetUrl,
            component: record.component,
        };
        updateSnapshot({
            isNavigating: true,
            pendingUrl: targetUrl,
            pendingComponent: record.component,
            pendingFilterPath: null,
            navigationError: null,
        });
    } else if (kind === 'filter') {
        activeFilterVisitId = id;
        updateSnapshot({
            pendingFilterPath: targetPath,
            navigationError: null,
        });
    } else if (kind === 'deferred') {
        for (const key of only) {
            activePartialCounts.set(key, (activePartialCounts.get(key) ?? 0) + 1);
        }
        clearDeferredErrors(only);
    }

    return record;
}

function completeVisitById(id: string | null, removeRecord: boolean, extraPatch?: Partial<NavigationSnapshot>) {
    const patch: Partial<NavigationSnapshot> = { ...extraPatch };

    if (id !== null && id === activeForegroundVisitId) {
        activeForegroundVisitId = null;
        patch.isNavigating = false;
        patch.pendingUrl = null;
        patch.pendingComponent = null;
    }

    if (id !== null && id === activeFilterVisitId) {
        activeFilterVisitId = null;
        patch.pendingFilterPath = null;
    }

    if (id !== null && removeRecord) {
        const rec = trackedVisits.get(id);
        if (rec?.kind === 'deferred') {
            for (const key of rec.only) {
                const next = (activePartialCounts.get(key) ?? 1) - 1;
                if (next <= 0) {
                    activePartialCounts.delete(key);
                } else {
                    activePartialCounts.set(key, next);
                }
            }
        }
        trackedVisits.delete(id);
    }

    if (Object.keys(patch).length > 0) {
        updateSnapshot(patch);
    }
}

export function initNavigationLifecycle() {
    if (initialized || typeof window === 'undefined') {
        return;
    }
    initialized = true;

    router.on('before', (event) => {
        const visit = (event.detail as { visit?: VisitLike }).visit;
        if (!visit || visit.prefetch) {
            return;
        }

        const method = (visit.method ?? 'get').toLowerCase();
        const isPartialReload = Array.isArray(visit.only) && visit.only.length > 0;
        const targetPathAndSearch = getPathAndSearch(visit.url);
        const currentPathAndSearch = `${window.location.pathname}${window.location.search}`;

        if (
            method === 'get' &&
            !bypassDirtyGuardOnce &&
            dirtyForms.size > 0 &&
            !isPartialReload &&
            targetPathAndSearch !== currentPathAndSearch
        ) {
            event.preventDefault();
            updateSnapshot({
                pendingBlockedVisit: {
                    url: toUrlString(visit.url),
                    component: visit.component ?? null,
                    method,
                },
            });
            return;
        }

        registerVisit(visit, true);
    });

    router.on('start', (event) => {
        const visit = (event.detail as { visit?: VisitLike }).visit;
        if (!visit || visit.prefetch) {
            return;
        }

        registerVisit(visit, false);
    });

    router.on('finish', (event) => {
        const visit = (event.detail as { visit?: VisitLike }).visit;
        if (!visit) {
            return;
        }
        const id = visit.id !== undefined && visit.id !== null ? String(visit.id) : null;
        if (!id || !trackedVisits.has(id)) {
            return;
        }
        completeVisitById(id, true);
    });

    router.on('success', (event) => {
        const detail = event.detail as { visitId?: string | number };
        const id = detail.visitId !== undefined && detail.visitId !== null ? String(detail.visitId) : null;
        const rec = id ? trackedVisits.get(id) : undefined;

        if (rec) {
            if (rec.kind === 'mutation') {
                clearAllDirtyForms();
                router.flushAll();
            }
            const clearAllErrors = rec.kind === 'nav';
            completeVisitById(
                id,
                false,
                clearAllErrors ? { navigationError: null, deferredErrors: {} } : undefined,
            );
        }
    });

    router.on('error', (event) => {
        const detail = event.detail as { visitId?: string | number };
        const id = detail.visitId !== undefined && detail.visitId !== null ? String(detail.visitId) : null;
        if (id && trackedVisits.has(id)) {
            completeVisitById(id, false);
        }
    });

    router.on('navigate', (event) => {
        const detail = event.detail as {
            type?: 'visit' | 'history';
            cached?: boolean;
            visitId?: string | number;
        };
        const navType = detail.type ?? 'visit';

        if (navType === 'history') {
            activeForegroundVisitId = null;
            activeFilterVisitId = null;
            updateSnapshot({
                lastNavigateType: 'history',
                isNavigating: false,
                pendingUrl: null,
                pendingComponent: null,
                pendingFilterPath: null,
                navigationError: null,
            });
            return;
        }

        const id = detail.visitId !== undefined && detail.visitId !== null ? String(detail.visitId) : null;
        if (detail.cached && id && trackedVisits.has(id)) {
            completeVisitById(id, true, { lastNavigateType: navType });
        } else {
            updateSnapshot({ lastNavigateType: navType });
        }
    });

    router.on('httpException', (event) => {
        const detail = event.detail as {
            response?: { status?: number };
        };
        const status = detail.response?.status;

        const fg = activeForegroundVisitId ? trackedVisits.get(activeForegroundVisitId) : undefined;
        if (fg) {
            if (fg.method !== 'get') {
                return;
            }
            event.preventDefault();
            completeVisitById(fg.id, true, {
                navigationError: buildHttpErrorInfo(status, fg.url, fg.component),
            });
            return;
        }

        const filterVisit = activeFilterVisitId ? trackedVisits.get(activeFilterVisitId) : undefined;
        if (filterVisit) {
            event.preventDefault();
            completeVisitById(filterVisit.id, true, {
                navigationError: buildHttpErrorInfo(status, filterVisit.url, filterVisit.component),
            });
            return;
        }

        const partialKeys = Array.from(activePartialCounts.keys());
        if (partialKeys.length > 0) {
            event.preventDefault();
            setDeferredErrors(
                partialKeys,
                status === 401 || status === 419
                    ? 'Sesi berakhir saat memuat bagian ini. Muat ulang halaman untuk masuk kembali.'
                    : 'Gagal memuat bagian data ini dari server.',
            );
        }
    });

    router.on('networkError', (event) => {
        const fg = activeForegroundVisitId ? trackedVisits.get(activeForegroundVisitId) : undefined;
        if (fg) {
            if (fg.method !== 'get') {
                return;
            }
            event.preventDefault();
            completeVisitById(fg.id, true, {
                navigationError: {
                    title: 'Koneksi ke server terputus',
                    message: 'Halaman belum dapat dimuat. Pastikan koneksi internet aktif lalu coba lagi.',
                    url: fg.url,
                    component: fg.component,
                    isAuthError: false,
                },
            });
            return;
        }

        const filterVisit = activeFilterVisitId ? trackedVisits.get(activeFilterVisitId) : undefined;
        if (filterVisit) {
            event.preventDefault();
            completeVisitById(filterVisit.id, true, {
                navigationError: {
                    title: 'Koneksi ke server terputus',
                    message: 'Filter gagal diperbarui karena koneksi terputus. Coba lagi.',
                    url: filterVisit.url,
                    component: filterVisit.component,
                    isAuthError: false,
                },
            });
            return;
        }

        const partialKeys = Array.from(activePartialCounts.keys());
        if (partialKeys.length > 0) {
            event.preventDefault();
            setDeferredErrors(
                partialKeys,
                'Koneksi terputus saat memuat bagian data ini. Periksa jaringan lalu coba lagi.',
            );
        }
    });

    // When a click consumes an in-flight hover prefetch whose request fails,
    // Inertia v3 rethrows HttpNetworkError / HttpResponseError from prefetched.response without emitting router events.
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason as { name?: string; response?: { status?: number } } | undefined;
        if (!reason || (reason.name !== 'HttpNetworkError' && reason.name !== 'HttpResponseError')) {
            return;
        }

        const fg = activeForegroundVisitId ? trackedVisits.get(activeForegroundVisitId) : undefined;
        const filterVisit = activeFilterVisitId ? trackedVisits.get(activeFilterVisitId) : undefined;
        const target = fg ?? filterVisit;
        if (!target || target.method !== 'get') {
            return;
        }

        event.preventDefault();
        if (reason.name === 'HttpResponseError') {
            completeVisitById(target.id, true, {
                navigationError: buildHttpErrorInfo(
                    reason.response?.status,
                    target.url,
                    target.component,
                ),
            });
            return;
        }

        completeVisitById(target.id, true, {
            navigationError: {
                title: 'Koneksi ke server terputus',
                message: 'Halaman belum dapat dimuat. Pastikan koneksi internet aktif lalu coba lagi.',
                url: target.url,
                component: target.component,
                isAuthError: false,
            },
        });
    });
}

function subscribe(callback: () => void) {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
}

function getSnapshot() {
    return snapshot;
}

export function useNavigationState(): NavigationSnapshot {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Reports whether an active local filter/search/pagination reload targets this route path,
 * preventing global Inertia navigation events from leaking loading UI across pages.
 */
export function useScopedFilterLoading(routePath: string | string[]): boolean {
    const { pendingFilterPath } = useNavigationState();
    if (!pendingFilterPath) {
        return false;
    }
    const paths = Array.isArray(routePath) ? routePath : [routePath];
    return paths.includes(pendingFilterPath);
}

export function useUnsavedChangesGuard(
    isDirty: boolean,
    message = DEFAULT_DIRTY_MESSAGE,
) {
    const formId = useId();

    useEffect(() => {
        setFormDirty(formId, isDirty, message);
    }, [formId, isDirty, message]);

    useEffect(() => {
        return () => {
            clearFormDirty(formId);
        };
    }, [formId]);
}
