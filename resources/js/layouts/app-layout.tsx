import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    ChevronRight,
    Menu,
    Plus,
    PlusCircle,
    Search,
    ShoppingBag,
    X,
} from 'lucide-react';
import {
    drawerNavGroups,
    isNavItemActive,
    resolveNavHref,
    SidebarContent,
} from '@/components/app-sidebar';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { NavigationErrorBanner } from '@/components/ui/page-skeleton';
import { ToastViewport } from '@/components/ui/toast-viewport';
import {
    cancelLeaveDirtyPage,
    clearAllDirtyForms,
    clearNavigationError,
    confirmLeaveDirtyPage,
    invalidateNavigationCache,
    retryLastNavigation,
    useNavigationState,
} from '@/lib/navigation-state';
import type { AppPageProps } from '@/types';
import { cn } from '@/lib/utils';

type AppLayoutProps = {
    title?: string;
    children: ReactNode;
};

type BreadcrumbSegment = {
    label: string;
    href?: string;
    component?: string;
};

function resolveBreadcrumbs(currentUrl: string, nav?: AppPageProps['nav']): BreadcrumbSegment[] {
    const path = currentUrl.split('?')[0];

    if (path === '/dashboard' || path === '/ui-dashboard') {
        return [{ label: 'Operasional' }, { label: 'Hari Ini' }];
    }
    if (path === '/ui-orders') {
        return [{ label: 'Operasional' }, { label: 'Pesanan' }];
    }
    if (path === '/ui-orders/create') {
        return [
            { label: 'Pesanan', href: nav?.uiOrders ?? '/ui-orders', component: 'Orders/Index' },
            { label: 'Buat Pesanan' },
        ];
    }
    if (/^\/ui-orders\/\d+\/edit$/.test(path)) {
        return [
            { label: 'Pesanan', href: nav?.uiOrders ?? '/ui-orders', component: 'Orders/Index' },
            { label: 'Edit Pesanan' },
        ];
    }
    if (/^\/ui-orders\/\d+$/.test(path)) {
        return [
            { label: 'Pesanan', href: nav?.uiOrders ?? '/ui-orders', component: 'Orders/Index' },
            { label: 'Detail Nota' },
        ];
    }
    if (path === '/ui-customers') {
        return [{ label: 'Operasional' }, { label: 'Pelanggan' }];
    }
    if (path === '/ui-customers/create') {
        return [
            { label: 'Pelanggan', href: nav?.uiCustomers ?? '/ui-customers', component: 'Customers/Index' },
            { label: 'Tambah Pelanggan' },
        ];
    }
    if (/^\/ui-customers\/\d+\/edit$/.test(path)) {
        return [
            { label: 'Pelanggan', href: nav?.uiCustomers ?? '/ui-customers', component: 'Customers/Index' },
            { label: 'Edit Pelanggan' },
        ];
    }
    if (/^\/ui-customers\/\d+$/.test(path)) {
        return [
            { label: 'Pelanggan', href: nav?.uiCustomers ?? '/ui-customers', component: 'Customers/Index' },
            { label: 'Detail Pelanggan' },
        ];
    }
    if (path === '/ui-payments') {
        return [{ label: 'Keuangan' }, { label: 'Piutang & Pembayaran' }];
    }
    if (path === '/ui-expenses') {
        return [{ label: 'Keuangan' }, { label: 'Pengeluaran' }];
    }
    if (path === '/ui-expenses/create') {
        return [
            { label: 'Pengeluaran', href: nav?.uiExpenses ?? '/ui-expenses', component: 'Expenses/Index' },
            { label: 'Catat Pengeluaran' },
        ];
    }
    if (path === '/ui-expense-categories') {
        return [{ label: 'Pengaturan' }, { label: 'Kategori Biaya' }];
    }
    if (path === '/ui-reports') {
        return [{ label: 'Keuangan' }, { label: 'Laporan Usaha' }];
    }

    return [{ label: 'Mutiara Florist' }];
}

export default function AppLayout({ title: _title, children }: AppLayoutProps) {
    const { url, props } = usePage<AppPageProps>();
    const { auth, flash, errors, nav } = props;
    const {
        isNavigating,
        navigationError,
        pendingBlockedVisit,
        dirtyMessage,
    } = useNavigationState();

    const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [globalQuery, setGlobalQuery] = useState('');

    const currentPath = url.split('?')[0];
    const isCreateOrderPage = currentPath === '/ui-orders/create';

    const successToastKey = `${url}::${flash?.success ?? ''}`;
    const errorBannerKey = `${url}::${flash?.error ?? ''}::${errors?.customer ?? ''}`;
    const [dismissedSuccessKey, setDismissedSuccessKey] = useState<string | null>(null);
    const [dismissedErrorKey, setDismissedErrorKey] = useState<string | null>(null);

    useEffect(() => {
        setMenuDrawerOpen(false);
        setMobileSearchOpen(false);
    }, [url]);

    const successMessage =
        dismissedSuccessKey !== successToastKey ? flash?.success : null;
    const errorMessage =
        dismissedErrorKey !== errorBannerKey ? (flash?.error ?? errors?.customer) : null;

    const handleDismissToast = useCallback(() => {
        setDismissedSuccessKey(successToastKey);
    }, [successToastKey]);

    const createOrderHref = nav?.uiOrdersCreate ?? '/ui-orders/create';
    const ordersHref = nav?.uiOrders ?? '/ui-orders';
    const dashboardHref = nav?.dashboard ?? '/dashboard';

    const breadcrumbs = useMemo(() => resolveBreadcrumbs(url, nav), [url, nav]);

    const isSecondaryRouteActive = useMemo(
        () =>
            drawerNavGroups.some((group) =>
                group.items.some((item) =>
                    isNavItemActive(url, resolveNavHref(nav, item), item.matchExact),
                ),
            ),
        [url, nav],
    );

    const handleGlobalSearch = (e: FormEvent) => {
        e.preventDefault();
        const trimmed = globalQuery.trim();
        router.get(ordersHref, trimmed ? { q: trimmed } : {}, { preserveScroll: true });
    };

    const handleConfirmLogout = () => {
        setIsLoggingOut(true);
        clearAllDirtyForms();
        invalidateNavigationCache();
        router.post(
            nav?.logout ?? '/logout',
            {},
            {
                onFinish: () => {
                    setIsLoggingOut(false);
                    setLogoutModalOpen(false);
                },
            },
        );
    };

    const bottomDestinations = [
        {
            label: 'Hari Ini',
            href: dashboardHref,
            component: 'Dashboard',
            cacheTags: ['dashboard', 'orders', 'payments', 'expenses'],
            icon: CalendarDays,
            exact: true,
        },
        {
            label: 'Pesanan',
            href: ordersHref,
            component: 'Orders/Index',
            cacheTags: ['orders'],
            icon: ShoppingBag,
            exact: true,
        },
        {
            label: 'Buat',
            href: createOrderHref,
            component: 'Orders/Create',
            cacheTags: ['customers', 'orders'],
            icon: PlusCircle,
            exact: false,
        },
    ];

    return (
        <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
            <a
                href="#main-content"
                className="sr-only fixed left-3 top-3 z-[100] rounded-[8px] bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-bold text-[var(--bg-surface)] focus:not-sr-only"
            >
                Langsung ke konten utama
            </a>

            <div className="flex min-h-screen">
                {/* Desktop Deep Cypress Botanical Spine (>= 1024px) */}
                <aside
                    aria-label="Sidebar navigasi"
                    className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[248px] lg:shrink-0 lg:flex-col lg:overflow-y-auto"
                >
                    <SidebarContent onRequestLogout={() => setLogoutModalOpen(true)} />
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Elevated Compact Ivory Topbar (Syncro + Sparkpixel separation) */}
                    <header className="sticky top-0 z-20 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2 md:px-6 md:py-2.5 lg:px-8">
                        <div className="flex items-center justify-between gap-3">
                            {/* Left: Mobile/Tablet Brand + Menu OR Desktop Contextual Breadcrumb */}
                            <div className="flex min-w-0 items-center gap-2.5">
                                <div className="flex shrink-0 items-center gap-2 lg:hidden">
                                    <span
                                        aria-hidden="true"
                                        className="size-2 shrink-0 rounded-full bg-[var(--brand-urgent)]"
                                    />
                                    <span className="whitespace-nowrap text-[16px] font-bold tracking-[-0.015em] text-[var(--bg-rail)] sm:text-[17px]">
                                        Mutiara Florist
                                    </span>
                                </div>

                                {/* Tablet ONLY Menu trigger (768px - 1023px) */}
                                <Button
                                    type="button"
                                    variant="subtle"
                                    onClick={() => setMenuDrawerOpen(true)}
                                    aria-expanded={menuDrawerOpen}
                                    className="hidden h-11 shrink-0 px-3 md:inline-flex lg:hidden"
                                >
                                    <Menu className="size-4" aria-hidden="true" />
                                    <span>Menu</span>
                                </Button>

                                {/* Desktop Contextual Breadcrumb (>= 1024px) */}
                                <nav
                                    aria-label="Lokasi halaman"
                                    className="hidden min-w-0 items-center lg:flex"
                                >
                                    <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                                        {breadcrumbs.map((seg, idx) => {
                                            const isLast = idx === breadcrumbs.length - 1;
                                            return (
                                                <li
                                                    key={`${seg.label}-${idx}`}
                                                    className="flex min-w-0 items-center gap-1.5"
                                                >
                                                    {idx > 0 && (
                                                        <ChevronRight
                                                            className="size-3.5 shrink-0 text-[var(--text-secondary)]"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    {seg.href && !isLast ? (
                                                        <Link
                                                            href={seg.href}
                                                            component={seg.component}
                                                            prefetch="hover"
                                                            cacheFor="10s"
                                                            className="inline-flex min-h-[44px] items-center truncate font-medium text-[var(--text-secondary)] hover:text-[var(--brand-primary)] hover:underline"
                                                        >
                                                            {seg.label}
                                                        </Link>
                                                    ) : (
                                                        <span
                                                            aria-current={isLast ? 'page' : undefined}
                                                            className={cn(
                                                                'truncate',
                                                                isLast
                                                                    ? 'font-bold text-[var(--text-primary)]'
                                                                    : 'font-medium text-[var(--text-secondary)]',
                                                            )}
                                                        >
                                                            {seg.label}
                                                        </span>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </nav>
                            </div>

                            {/* Right: Integrated Search + Single Global Primary CTA */}
                            <div className="flex shrink-0 items-center gap-2.5">
                                <form
                                    onSubmit={handleGlobalSearch}
                                    role="search"
                                    className="hidden md:flex md:items-center"
                                >
                                    <label htmlFor="topbar-global-search" className="sr-only">
                                        Cari nomor nota atau nama pelanggan
                                    </label>
                                    <div className="relative w-52 lg:w-64 xl:w-72">
                                        <Search
                                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-secondary)]"
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="topbar-global-search"
                                            type="search"
                                            enterKeyHint="search"
                                            spellCheck={false}
                                            value={globalQuery}
                                            onChange={(e) => setGlobalQuery(e.target.value)}
                                            placeholder="Cari nota / pelanggan..."
                                            className={cn(
                                                'h-11 w-full rounded-[8px] border border-[var(--border-input)] bg-[var(--bg-canvas)]/65 py-2 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] transition-colors focus:bg-[var(--bg-surface)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]',
                                                globalQuery ? 'pr-11' : 'pr-3',
                                            )}
                                        />
                                        {globalQuery && (
                                            <button
                                                type="button"
                                                aria-label="Hapus pencarian nota"
                                                onClick={() => setGlobalQuery('')}
                                                className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-[8px] text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]"
                                            >
                                                <X className="size-4" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                </form>

                                {/* Mobile ONLY Quick Search Toggle (< 768px) */}
                                <Button
                                    type="button"
                                    variant="subtle"
                                    onClick={() => setMobileSearchOpen((v) => !v)}
                                    aria-expanded={mobileSearchOpen}
                                    aria-label={mobileSearchOpen ? 'Tutup pencarian nota' : 'Cari Nota'}
                                    className="h-11 min-w-[44px] px-3 md:hidden"
                                >
                                    {mobileSearchOpen ? (
                                        <X className="size-4" aria-hidden="true" />
                                    ) : (
                                        <Search className="size-4" aria-hidden="true" />
                                    )}
                                    <span className="text-[13px]">Cari Nota</span>
                                </Button>

                                {/* Single Global Create Order CTA on Tablet & Desktop (hidden on /ui-orders/create) */}
                                {!isCreateOrderPage && (
                                    <Button
                                        asChild
                                        variant="primary"
                                        className="hidden h-11 shrink-0 px-4 md:inline-flex"
                                    >
                                        <Link
                                            href={createOrderHref}
                                            component="Orders/Create"
                                            prefetch="hover"
                                            cacheFor="10s"
                                            cacheTags={['customers', 'orders']}
                                        >
                                            <Plus className="size-4" aria-hidden="true" />
                                            <span>Pesanan Baru</span>
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {mobileSearchOpen && (
                            <form
                                onSubmit={handleGlobalSearch}
                                role="search"
                                className="mt-2.5 flex items-center gap-2 md:hidden"
                            >
                                <label htmlFor="mobile-global-search" className="sr-only">
                                    Cari nomor nota atau nama pelanggan
                                </label>
                                <input
                                    id="mobile-global-search"
                                    type="search"
                                    enterKeyHint="search"
                                    spellCheck={false}
                                    autoFocus
                                    value={globalQuery}
                                    onChange={(e) => setGlobalQuery(e.target.value)}
                                    placeholder="Cari no. nota atau nama..."
                                    className="h-11 min-w-0 flex-1 rounded-[8px] border-[1.5px] border-[var(--border-input)] bg-[var(--bg-surface)] px-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
                                />
                                <Button type="submit" variant="primary" className="h-11 shrink-0 px-4">
                                    Cari
                                </Button>
                            </form>
                        )}

                        {isNavigating && (
                            <div
                                role="status"
                                aria-live="polite"
                                className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-[var(--brand-primary)]"
                            >
                                <span className="sr-only">Sedang memuat halaman tujuan...</span>
                            </div>
                        )}
                    </header>

                    {/* Non-blocking accessible success toast */}
                    <ToastViewport
                        message={successMessage}
                        toastKey={successToastKey}
                        onDismiss={handleDismissToast}
                    />

                    {/* Main Content */}
                    <main
                        id="main-content"
                        className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-[calc(76px+env(safe-area-inset-bottom))] pt-5 md:px-6 md:pb-16 md:pt-6 lg:px-8 lg:pt-7"
                    >
                        {errorMessage && (
                            <AlertBanner
                                tone="error"
                                className="mb-6"
                                onDismiss={() => setDismissedErrorKey(errorBannerKey)}
                                dismissLabel="Tutup peringatan"
                            >
                                {errorMessage}
                            </AlertBanner>
                        )}

                        {navigationError && (
                            <NavigationErrorBanner
                                error={navigationError}
                                onRetry={retryLastNavigation}
                                onDismiss={clearNavigationError}
                            />
                        )}

                        {children}
                    </main>
                </div>
            </div>

            {/* Mobile 4-Destination Bottom Navigation (< 768px) */}
            <nav
                aria-label="Navigasi utama mobile"
                className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(62px+env(safe-area-inset-bottom))] grid-cols-4 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] md:hidden"
            >
                {bottomDestinations.map((dest) => {
                    const isActive = isNavItemActive(url, dest.href, dest.exact);
                    return (
                        <Link
                            key={dest.label}
                            href={dest.href}
                            component={dest.component}
                            prefetch="hover"
                            cacheFor="10s"
                            cacheTags={dest.cacheTags}
                            aria-current={isActive ? 'page' : undefined}
                            aria-busy={isActive && isNavigating ? 'true' : undefined}
                            className={cn(
                                'flex min-h-[48px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[12.5px] transition-colors',
                                isActive
                                    ? 'border-t-2 border-[var(--brand-primary)] bg-[var(--bg-sunken)]/75 font-bold text-[var(--bg-rail)]'
                                    : 'font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)]/45',
                            )}
                        >
                            <dest.icon className="size-5" aria-hidden="true" />
                            <span>{dest.label}</span>
                        </Link>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setMenuDrawerOpen(true)}
                    aria-expanded={menuDrawerOpen}
                    className={cn(
                        'flex min-h-[48px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[12.5px] transition-colors',
                        isSecondaryRouteActive
                            ? 'border-t-2 border-[var(--brand-primary)] bg-[var(--bg-sunken)]/75 font-bold text-[var(--bg-rail)]'
                            : 'font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)]/45',
                    )}
                >
                    <Menu className="size-5" aria-hidden="true" />
                    <span>Menu</span>
                </button>
            </nav>

            {/* Mobile & Tablet Navigation Drawer Modal */}
            <Modal
                open={menuDrawerOpen}
                onClose={() => setMenuDrawerOpen(false)}
                title="Menu Mutiara Florist"
                description={auth?.user ? `Masuk sebagai ${auth.user.name}` : undefined}
            >
                <nav aria-label="Menu lanjutan" className="space-y-4">
                    {/* Include primary destinations for Tablet users (< 1024px) */}
                    <div className="hidden space-y-2 md:block">
                        <p className="text-xs font-semibold text-[var(--text-secondary)]">
                            Operasional Utama
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: 'Hari Ini', href: dashboardHref, component: 'Dashboard', exact: true, cacheTags: ['dashboard', 'orders', 'payments', 'expenses'] },
                                { label: 'Pesanan', href: ordersHref, component: 'Orders/Index', exact: true, cacheTags: ['orders'] },
                            ].map((item) => {
                                const active = isNavItemActive(url, item.href, item.exact);
                                return (
                                    <Link
                                        key={item.label}
                                        href={item.href}
                                        component={item.component}
                                        prefetch="hover"
                                        cacheFor="10s"
                                        cacheTags={item.cacheTags}
                                        aria-current={active ? 'page' : undefined}
                                        onClick={() => setMenuDrawerOpen(false)}
                                        className={cn(
                                            'flex min-h-[44px] items-center justify-between rounded-[8px] border px-3.5 py-2 text-sm font-semibold transition-colors',
                                            active
                                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] font-bold text-[var(--brand-primary)]'
                                                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-sunken)]',
                                        )}
                                    >
                                        <span>{item.label}</span>
                                        {active && (
                                            <span
                                                aria-hidden="true"
                                                className="h-4 w-[3px] rounded-full bg-[var(--brand-urgent)]"
                                            />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {drawerNavGroups.map((group) => (
                        <div key={group.label} className="space-y-2">
                            <p className="text-xs font-semibold text-[var(--text-secondary)]">
                                {group.label}
                            </p>
                            <div className="space-y-2">
                                {group.items.map((item) => {
                                    const href = resolveNavHref(nav, item);
                                    const active = isNavItemActive(url, href, item.matchExact);
                                    return (
                                        <Link
                                            key={item.label}
                                            href={href}
                                            component={item.component}
                                            prefetch="hover"
                                            cacheFor="10s"
                                            cacheTags={item.cacheTags}
                                            aria-current={active ? 'page' : undefined}
                                            onClick={() => setMenuDrawerOpen(false)}
                                            className={cn(
                                                'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[8px] border px-4 py-2.5 text-[15px] font-semibold transition-colors',
                                                active
                                                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] font-bold text-[var(--brand-primary)]'
                                                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-sunken)]',
                                            )}
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                                                <span>{item.label}</span>
                                            </span>
                                            {active && (
                                                <span
                                                    aria-hidden="true"
                                                    className="h-4 w-[3px] rounded-full bg-[var(--brand-urgent)]"
                                                />
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="border-t border-[var(--border-hairline)] pt-3">
                        <Button
                            type="button"
                            variant="urgent"
                            className="w-full"
                            onClick={() => {
                                setLogoutModalOpen(true);
                            }}
                        >
                            Keluar Akun{auth?.user?.name ? ` (${auth.user.name})` : ''}
                        </Button>
                    </div>
                </nav>
            </Modal>

            {/* Accessible Logout Confirmation Modal */}
            <Modal
                open={logoutModalOpen}
                onClose={() => setLogoutModalOpen(false)}
                title="Keluar dari Aplikasi?"
                isSubmitting={isLoggingOut}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={isLoggingOut}
                            onClick={() => setLogoutModalOpen(false)}
                            className="w-full sm:w-auto sm:min-w-[132px]"
                        >
                            Tetap Masuk
                        </Button>
                        <Button
                            type="button"
                            variant="urgent"
                            disabled={isLoggingOut}
                            onClick={handleConfirmLogout}
                            className="w-full sm:w-auto sm:min-w-[148px]"
                        >
                            {isLoggingOut ? 'Mengakhiri sesi...' : 'Keluar Sekarang'}
                        </Button>
                    </>
                }
            >
                <p className="text-[15px] text-[var(--text-secondary)]">
                    Pastikan seluruh pesanan atau pembayaran yang sedang diketik sudah disimpan sebelum keluar.
                </p>
            </Modal>

            {/* Accessible Unsaved Form Guard Modal */}
            <Modal
                open={Boolean(pendingBlockedVisit)}
                onClose={cancelLeaveDirtyPage}
                title="Perubahan Belum Disimpan"
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={cancelLeaveDirtyPage}
                            className="w-full sm:w-auto sm:min-w-[164px]"
                        >
                            Tetap di Halaman Ini
                        </Button>
                        <Button
                            type="button"
                            variant="urgent"
                            onClick={confirmLeaveDirtyPage}
                            className="w-full sm:w-auto sm:min-w-[164px]"
                        >
                            Tinggalkan Halaman
                        </Button>
                    </>
                }
            >
                <p className="text-[15px] text-[var(--text-secondary)]">
                    {dirtyMessage ??
                        'Ada perubahan pada formulir yang belum disimpan. Jika berpindah halaman sekarang, isian Anda akan hilang.'}
                </p>
            </Modal>
        </div>
    );
}
