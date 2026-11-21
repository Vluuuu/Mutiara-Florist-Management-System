import { useEffect, useId } from 'react';
import { useSyncExternalStore } from 'react';
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
    navigationError: NavigationErrorInfo | null;
    deferredErrors: Record<string, string>;
    hasDirtyForm: boolean;
    dirtyMessage: string | null;
    pendingBlockedVisit: PendingBlockedVisit | null;
};

type VisitLike = {
    url?: URL | string;
    method?: string;
    prefetch?: boolean;
    component?: string | null;
    only?: string[];
};

let snapshot: NavigationSnapshot = {
    isNavigating: false,
    pendingUrl: null,
    pendingComponent: null,
    navigationError: null,
    deferredErrors: {},
    hasDirtyForm: false,
    dirtyMessage: null,
    pendingBlockedVisit: null,
};

const listeners = new Set<() => void>();
const dirtyForms = new Map<string, string>();
const visitTokens = new WeakMap<object, number>();
const partialVisitKeys = new WeakMap<object, string[]>();
const activePartialCounts = new Map<string, number>();
let latestVisitToken = 0;
let activeVisitToken: number | null = null;
let activeForegroundVisit: { url: string; component?: string | null; method: string } | null = null;
let lastAttemptedVisit: { url: string; component?: string | null } | null = null;
let bypassDirtyGuardOnce = false;
let initialized = false;

const DEFAULT_DIRTY_MESSAGE =
    'Ada perubahan pada formulir yang belum disimpan. Jika berpindah halaman sekarang, isian Anda akan hilang.';

function emit() {
    for (const listener of listeners) {
        listener();
    }
}

function updateSnapshot(patch: Partial<NavigationSnapshot>) {
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

function getPathAndSearch(url?: URL | string): string {
    if (!url) return '';
    try {
        const parsed =
            typeof url === 'string'
                ? new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
                : url;
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return String(url);
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
        const targetPath = getPathAndSearch(visit.url);
        const currentPath = `${window.location.pathname}${window.location.search}`;

        if (
            method === 'get' &&
            !bypassDirtyGuardOnce &&
            dirtyForms.size > 0 &&
            !isPartialReload &&
            targetPath !== currentPath
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

        if (!isPartialReload) {
            latestVisitToken += 1;
            const token = latestVisitToken;
            visitTokens.set(visit as object, token);
            activeVisitToken = token;

            const targetUrl = toUrlString(visit.url);
            activeForegroundVisit = {
                url: targetUrl,
                component: visit.component ?? null,
                method,
            };
            lastAttemptedVisit = {
                url: targetUrl,
                component: visit.component ?? null,
            };

            updateSnapshot({
                isNavigating: true,
                pendingUrl: targetUrl,
                pendingComponent: visit.component ?? null,
                navigationError: null,
            });
        }
    });

    router.on('start', (event) => {
        const visit = (event.detail as { visit?: VisitLike }).visit;
        if (!visit || visit.prefetch) {
            return;
        }

        const isPartialReload = Array.isArray(visit.only) && visit.only.length > 0;
        if (isPartialReload && visit.only) {
            partialVisitKeys.set(visit as object, visit.only);
            for (const key of visit.only) {
                activePartialCounts.set(key, (activePartialCounts.get(key) ?? 0) + 1);
            }
            clearDeferredErrors(visit.only);
            return;
        }

        if (visitTokens.get(visit as object) === undefined) {
            latestVisitToken += 1;
            const token = latestVisitToken;
            visitTokens.set(visit as object, token);
            activeVisitToken = token;

            const targetUrl = toUrlString(visit.url);
            activeForegroundVisit = {
                url: targetUrl,
                component: visit.component ?? null,
                method: (visit.method ?? 'get').toLowerCase(),
            };
            lastAttemptedVisit = {
                url: targetUrl,
                component: visit.component ?? null,
            };

            updateSnapshot({
                isNavigating: true,
                pendingUrl: targetUrl,
                pendingComponent: visit.component ?? null,
                navigationError: null,
            });
        }
    });

    const releaseVisitTracking = (visit?: VisitLike) => {
        if (!visit || visit.prefetch) {
            return;
        }

        const keys = partialVisitKeys.get(visit as object);
        if (keys) {
            partialVisitKeys.delete(visit as object);
            for (const key of keys) {
                const next = (activePartialCounts.get(key) ?? 1) - 1;
                if (next <= 0) {
                    activePartialCounts.delete(key);
                } else {
                    activePartialCounts.set(key, next);
                }
            }
        }

        const token = visitTokens.get(visit as object);
        if (token !== undefined && token === activeVisitToken) {
            activeVisitToken = null;
            activeForegroundVisit = null;
            updateSnapshot({
                isNavigating: false,
                pendingUrl: null,
                pendingComponent: null,
            });
        }
    };

    router.on('cancel', (event) => {
        releaseVisitTracking((event.detail as { visit?: VisitLike }).visit);
    });

    router.on('finish', (event) => {
        releaseVisitTracking((event.detail as { visit?: VisitLike }).visit);
    });

    router.on('success', (event) => {
        const detail = event.detail as { visit?: VisitLike; page?: { component?: string } };
        const visit = detail.visit;
        if (!visit || visit.prefetch) {
            return;
        }

        const method = (visit.method ?? 'get').toLowerCase();
        if (method !== 'get') {
            // Non-GET mutations (create, update, payment, void, status advance, logout)
            // invalidate short GET prefetch cache to prevent stale financial totals.
            clearAllDirtyForms();
            router.flushAll();
        } else {
            const isPartialReload = Array.isArray(visit.only) && visit.only.length > 0;
            if (!isPartialReload) {
                updateSnapshot({
                    navigationError: null,
                    deferredErrors: {},
                });
            }
        }
    });

    router.on('httpException', (event) => {
        const detail = event.detail as {
            response?: { status?: number; url?: string };
        };
        const status = detail.response?.status;

        if (activeForegroundVisit) {
            if (activeForegroundVisit.method !== 'get') {
                return;
            }
            event.preventDefault();
            const failed = activeForegroundVisit;
            activeVisitToken = null;
            activeForegroundVisit = null;
            updateSnapshot({
                isNavigating: false,
                pendingUrl: null,
                pendingComponent: null,
                navigationError: buildHttpErrorInfo(status, failed.url, failed.component ?? null),
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
        if (activeForegroundVisit) {
            if (activeForegroundVisit.method !== 'get') {
                return;
            }
            event.preventDefault();
            const failed = activeForegroundVisit;
            activeVisitToken = null;
            activeForegroundVisit = null;
            updateSnapshot({
                isNavigating: false,
                pendingUrl: null,
                pendingComponent: null,
                navigationError: {
                    title: 'Koneksi ke server terputus',
                    message: 'Halaman belum dapat dimuat. Pastikan koneksi internet aktif lalu coba lagi.',
                    url: failed.url,
                    component: failed.component ?? null,
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
