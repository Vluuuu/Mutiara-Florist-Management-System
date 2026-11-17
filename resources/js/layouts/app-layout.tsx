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
import type { AppPageProps } from '@/types';
import { cn } from '@/lib/utils';

type AppLayoutProps = {
    title: string;
    children: ReactNode;
};

export default function AppLayout({ title: _title, children }: AppLayoutProps) {
    const { url, props } = usePage<AppPageProps>();
    const { auth, flash, errors, nav } = props;

    const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [globalQuery, setGlobalQuery] = useState('');

    const flashKey = `${url}::${flash?.success ?? ''}::${flash?.error ?? ''}::${errors?.customer ?? ''}`;
    const [dismissedKey, setDismissedKey] = useState<string | null>(null);

    useEffect(() => {
        setMenuDrawerOpen(false);
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
        { label: 'Hari Ini', href: dashboardHref, icon: CalendarDays, exact: true },
        { label: 'Pesanan', href: ordersHref, icon: ShoppingBag, exact: true },
        { label: 'Buat', href: createOrderHref, icon: PlusCircle, exact: false },
    ];

    return (
        <div className="min-h-screen bg-[#FBF9F6] text-[#1E2420]">
            <a
                href="#main-content"
                className="sr-only fixed left-3 top-3 z-[100] rounded-md bg-[#143326] px-4 py-2.5 text-sm font-bold text-white focus:not-sr-only"
            >
                Langsung ke konten utama
            </a>

            <div className="flex min-h-screen">
                {/* Desktop Dark Botanical Sidebar (>= 1024px) */}
                <aside
                    aria-label="Sidebar navigasi"
                    className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[248px] lg:shrink-0 lg:flex-col lg:overflow-y-auto"
                >
                    <SidebarContent onRequestLogout={() => setLogoutModalOpen(true)} />
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Sticky Topbar */}
                    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#E3DED4] bg-white px-4 py-2.5 lg:px-7">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex items-center gap-2 lg:hidden">
                                <span
                                    aria-hidden="true"
                                    className="grid size-[30px] shrink-0 place-items-center rounded-md bg-[#143326] font-[var(--font-display)] text-[15px] font-semibold text-white"
                                >
                                    M
                                </span>
                                <span className="truncate text-base font-bold text-[#1E2420]">
                                    Mutiara Florist
                                </span>
                            </div>

                            <form
                                onSubmit={handleGlobalSearch}
                                role="search"
                                className="hidden md:flex md:w-80 md:items-center"
                            >
                                <label htmlFor="topbar-global-search" className="sr-only">
                                    Cari nomor nota atau nama pelanggan
                                </label>
                                <div className="relative w-full">
                                    <Search
                                        className="pointer-events-none absolute left-3 top-3 size-4 text-[#525B54]"
                                        aria-hidden="true"
                                    />
                                    <input
                                        id="topbar-global-search"
                                        type="search"
                                        value={globalQuery}
                                        onChange={(e) => setGlobalQuery(e.target.value)}
                                        placeholder="Cari nomor nota (MF-...) atau pelanggan..."
                                        className="min-h-[44px] w-full rounded-md border-[1.5px] border-[#858E87] bg-white py-2 pl-9 pr-3 text-sm text-[#1E2420] placeholder:text-[#525B54]/75 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#143326]"
                                    />
                                </div>
                            </form>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            {/* Tablet ONLY Menu button (768px - 1023px) */}
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setMenuDrawerOpen(true)}
                                className="hidden md:inline-flex lg:hidden"
                            >
                                <Menu className="size-4" aria-hidden="true" />
                                <span>Menu</span>
                            </Button>

                            <Button asChild variant="primary" size="default">
                                <Link href={createOrderHref}>+ Pesanan Baru</Link>
                            </Button>
                        </div>
                    </header>

                    {/* Main Content */}
                    <main
                        id="main-content"
                        className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-[calc(64px+env(safe-area-inset-bottom)+28px)] pt-5 md:px-6 md:pb-14 lg:px-8 lg:pt-6"
                    >
                        {successMessage && (
                            <div
                                role="status"
                                className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-[#166534]/30 bg-[#DCFCE7] p-3.5 text-sm font-medium text-[#166534]"
                            >
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
                                    <span>{successMessage}</span>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Tutup pemberitahuan"
                                    onClick={() => setDismissedKey(flashKey)}
                                    className="inline-flex size-11 shrink-0 items-center justify-center rounded text-[#166534] hover:bg-[#166534]/10"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            </div>
                        )}

                        {errorMessage && (
                            <div
                                role="alert"
                                className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-[#991B1B]/40 bg-[#FEE2E2] p-3.5 text-sm font-medium text-[#991B1B]"
                            >
                                <div className="flex items-center gap-2">
                                    <XCircle className="size-5 shrink-0" aria-hidden="true" />
                                    <span>{errorMessage}</span>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Tutup peringatan"
                                    onClick={() => setDismissedKey(flashKey)}
                                    className="inline-flex size-11 shrink-0 items-center justify-center rounded text-[#991B1B] hover:bg-[#991B1B]/10"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            </div>
                        )}

                        {children}
                    </main>
                </div>
            </div>

            {/* Mobile 4-Destination Bottom Navigation (< 768px) */}
            <nav
                aria-label="Navigasi utama mobile"
                className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-4 border-t border-[#E3DED4] bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
            >
                {bottomDestinations.map((dest) => {
                    const isActive = isNavItemActive(url, dest.href, dest.exact);
                    return (
                        <Link
                            key={dest.label}
                            href={dest.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs transition-colors',
                                isActive
                                    ? 'bg-[#E6EFEA] font-bold text-[#143326]'
                                    : 'font-semibold text-[#525B54] hover:bg-[#F1EDE6]',
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
                    className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-semibold text-[#525B54] hover:bg-[#F1EDE6]"
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
                <nav aria-label="Menu lanjutan" className="space-y-2">
                    <Link
                        href={paymentsHref}
                        onClick={() => setMenuDrawerOpen(false)}
                        className="flex min-h-[44px] w-full items-center justify-center rounded-md border border-[#858E87] bg-white px-4 py-2 text-sm font-semibold text-[#1E2420] hover:bg-[#F1EDE6]"
                    >
                        Piutang &amp; Pembayaran
                    </Link>
                    {secondaryNavItems.map((item) => (
                        <Link
                            key={item.label}
                            href={resolveNavHref(nav, item)}
                            onClick={() => setMenuDrawerOpen(false)}
                            className="flex min-h-[44px] w-full items-center justify-center rounded-md border border-[#858E87] bg-white px-4 py-2 text-sm font-semibold text-[#1E2420] hover:bg-[#F1EDE6]"
                        >
                            {item.label}
                        </Link>
                    ))}
                    <div className="border-t border-[#E3DED4] pt-2">
                        <Button
                            type="button"
                            variant="urgent"
                            className="w-full"
                            onClick={() => {
                                setMenuDrawerOpen(false);
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
                        >
                            Tetap Masuk
                        </Button>
                        <Button
                            type="button"
                            variant="urgent"
                            disabled={isLoggingOut}
                            onClick={handleConfirmLogout}
                        >
                            {isLoggingOut ? 'Mengakhiri sesi...' : 'Keluar Sekarang'}
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-[#525B54]">
                    Pastikan seluruh pesanan atau pembayaran yang sedang diketik sudah disimpan sebelum keluar.
                </p>
            </Modal>
        </div>
    );
}
