import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    CheckCircle2,
    Menu,
    PlusCircle,
    Search,
    ShoppingBag,
    X,
    XCircle,
} from 'lucide-react';
import {
    isNavItemActive,
    primaryNavItems,
    resolveNavHref,
    secondaryNavItems,
    SidebarContent,
} from '@/components/app-sidebar';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { NavigationErrorBanner } from '@/components/ui/page-skeleton';
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

    const flashKey = `${url}::${flash?.success ?? ''}::${flash?.error ?? ''}::${errors?.customer ?? ''}`;
    const [dismissedKey, setDismissedKey] = useState<string | null>(null);

    useEffect(() => {
        setMenuDrawerOpen(false);
        setMobileSearchOpen(false);
    }, [url]);

    const showFlash = dismissedKey !== flashKey;
    const successMessage = showFlash ? flash?.success : null;
    const errorMessage = showFlash ? (flash?.error ?? errors?.customer) : null;

    const createOrderHref = nav?.uiOrdersCreate ?? '/ui-orders/create';
    const ordersHref = nav?.uiOrders ?? '/ui-orders';
    const dashboardHref = nav?.dashboard ?? '/dashboard';
    const paymentsHref = nav?.uiPayments ?? '/ui-payments';

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
        <div className="min-h-screen bg-[#F7F3EC] text-[#1C211E]">
            <a
                href="#main-content"
                className="sr-only fixed left-3 top-3 z-[100] rounded-[8px] bg-[#1D3B2A] px-4 py-2.5 text-sm font-bold text-[#FFFDF9] focus:not-sr-only"
            >
                Langsung ke konten utama
            </a>

            <div className="flex min-h-screen">
                {/* Desktop Deep Cypress Atelier Spine (>= 1024px) */}
                <aside
                    aria-label="Sidebar navigasi"
                    className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[256px] lg:shrink-0 lg:flex-col lg:overflow-y-auto"
                >
                    <SidebarContent onRequestLogout={() => setLogoutModalOpen(true)} />
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Solid Matte Cotton Topbar */}
                    <header className="sticky top-0 z-20 border-b border-[#DED6C8] bg-[#F7F3EC] px-4 py-2 md:py-3 lg:px-8">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex items-center gap-2 lg:hidden">
                                    <span
                                        aria-hidden="true"
                                        className="size-2 shrink-0 rounded-full bg-[#9A3B22]"
                                    />
                                    <span className="text-[17px] font-bold tracking-[-0.015em] text-[#182920] sm:text-lg">
                                        Mutiara Florist
                                    </span>
                                </div>

                                <form
                                    onSubmit={handleGlobalSearch}
                                    role="search"
                                    className="hidden md:flex md:items-center md:gap-2"
                                >
                                    <label htmlFor="topbar-global-search" className="sr-only">
                                        Cari nomor nota atau nama pelanggan
                                    </label>
                                    <div className="relative w-72 lg:w-80">
                                        <Search
                                            className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#545852]"
                                            aria-hidden="true"
                                        />
                                        <input
                                            id="topbar-global-search"
                                            type="search"
                                            enterKeyHint="search"
                                            spellCheck={false}
                                            value={globalQuery}
                                            onChange={(e) => setGlobalQuery(e.target.value)}
                                            placeholder="Cari no. nota atau pelanggan..."
                                            className="h-11 w-full rounded-[8px] border-[1.5px] border-[#7D776C] bg-[#FFFDF9] py-2 pl-9 pr-3 text-[15px] text-[#1C211E] placeholder:text-[#60645E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        variant="secondary"
                                        className="h-11 min-w-[104px]"
                                    >
                                        Cari Nota
                                    </Button>
                                </form>
                            </div>

                            <div className="flex shrink-0 items-center gap-2.5">
                                {/* Mobile ONLY Quick Search Toggle (< 768px) */}
                                <Button
                                    type="button"
                                    variant="secondary"
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

                                {/* Tablet ONLY Menu button (768px - 1023px) */}
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setMenuDrawerOpen(true)}
                                    className="hidden h-11 min-w-[104px] md:inline-flex lg:hidden"
                                >
                                    <Menu className="size-4" aria-hidden="true" />
                                    <span>Menu</span>
                                </Button>

                                {/* Desktop & Tablet Create CTA (Mobile uses Bottom Nav + Buat) */}
                                <Button
                                    asChild
                                    variant="primary"
                                    className="hidden h-11 min-w-[144px] md:inline-flex"
                                >
                                    <Link
                                        href={createOrderHref}
                                        component="Orders/Create"
                                        prefetch="hover"
                                        cacheFor="10s"
                                        cacheTags={['customers', 'orders']}
                                    >
                                        + Pesanan Baru
                                    </Link>
                                </Button>
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
                                    className="h-11 min-w-0 flex-1 rounded-[8px] border-[1.5px] border-[#7D776C] bg-[#FFFDF9] px-3 text-[15px] text-[#1C211E] placeholder:text-[#60645E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
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
                                className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-[#1D3B2A]"
                            >
                                <span className="sr-only">Sedang memuat halaman tujuan...</span>
                            </div>
                        )}
                    </header>

                    {/* Main Content */}
                    <main
                        id="main-content"
                        className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-[calc(76px+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-16 md:pt-6 lg:px-8 lg:pt-8"
                    >
                        {successMessage && (
                            <div
                                role="status"
                                className="mb-6 flex items-start justify-between gap-3 rounded-[8px] border border-[#B8D0C0] bg-[#EEF5F0] p-4 text-[15px] font-medium text-[#164B2A]"
                            >
                                <div className="flex items-start gap-2.5">
                                    <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                                    <span>{successMessage}</span>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Tutup pemberitahuan"
                                    onClick={() => setDismissedKey(flashKey)}
                                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-[8px] text-[#164B2A] hover:bg-[#164B2A]/10"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            </div>
                        )}

                        {errorMessage && (
                            <div
                                role="alert"
                                className="mb-6 flex items-start justify-between gap-3 rounded-[8px] border border-[#E2B3AA] bg-[#FCECE9] p-4 text-[15px] font-medium text-[#8A2619]"
                            >
                                <div className="flex items-start gap-2.5">
                                    <XCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                                    <span>{errorMessage}</span>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Tutup peringatan"
                                    onClick={() => setDismissedKey(flashKey)}
                                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-[8px] text-[#8A2619] hover:bg-[#8A2619]/10"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            </div>
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
                className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(62px+env(safe-area-inset-bottom))] grid-cols-4 border-t border-[#DED6C8] bg-[#FFFDF9] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] md:hidden"
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
                                'flex min-h-[48px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[13px] transition-colors',
                                isActive
                                    ? 'border-t-2 border-[#1D3B2A] bg-[#EFE9DE]/80 font-bold text-[#182920]'
                                    : 'font-semibold text-[#545852] hover:bg-[#EFE9DE]/50',
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
                    className="flex min-h-[48px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[13px] font-semibold text-[#545852] hover:bg-[#EFE9DE]/50"
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
                <nav aria-label="Menu lanjutan" className="space-y-2.5">
                    <Link
                        href={paymentsHref}
                        component="Payments/Index"
                        prefetch="hover"
                        cacheFor="10s"
                        cacheTags={['payments', 'orders']}
                        onClick={() => setMenuDrawerOpen(false)}
                        className="flex min-h-[44px] w-full items-center justify-center rounded-[8px] border-[1.5px] border-[#7D776C] bg-[#FFFDF9] px-4 py-2.5 text-[15px] font-semibold text-[#1C211E] hover:bg-[#EFE9DE]"
                    >
                        Piutang &amp; Pembayaran
                    </Link>
                    {secondaryNavItems.map((item) => (
                        <Link
                            key={item.label}
                            href={resolveNavHref(nav, item)}
                            component={item.component}
                            prefetch="hover"
                            cacheFor="10s"
                            cacheTags={item.cacheTags}
                            onClick={() => setMenuDrawerOpen(false)}
                            className="flex min-h-[44px] w-full items-center justify-center rounded-[8px] border-[1.5px] border-[#7D776C] bg-[#FFFDF9] px-4 py-2.5 text-[15px] font-semibold text-[#1C211E] hover:bg-[#EFE9DE]"
                        >
                            {item.label}
                        </Link>
                    ))}
                    <div className="border-t border-[#DED6C8] pt-3">
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
                <p className="text-[15px] text-[#545852]">
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
                <p className="text-[15px] text-[#545852]">
                    {dirtyMessage ??
                        'Ada perubahan pada formulir yang belum disimpan. Jika berpindah halaman sekarang, isian Anda akan hilang.'}
                </p>
            </Modal>
        </div>
    );
}
