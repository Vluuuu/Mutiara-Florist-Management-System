import { Link, usePage } from '@inertiajs/react';
import {
    BarChart3,
    CalendarDays,
    LogOut,
    ReceiptText,
    ShoppingBag,
    Tags,
    User,
    Users,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigationState } from '@/lib/navigation-state';
import type { AppPageProps } from '@/types';
import { cn } from '@/lib/utils';

export type NavItemConfig = {
    label: string;
    hrefKey: keyof AppPageProps['nav'];
    defaultHref: string;
    component: string;
    cacheTags: string[];
    icon: LucideIcon;
    matchExact?: boolean;
};

export type NavGroupConfig = {
    label: string;
    items: NavItemConfig[];
};

export const navGroups: NavGroupConfig[] = [
    {
        label: 'Operasional',
        items: [
            {
                label: 'Hari Ini',
                hrefKey: 'dashboard',
                defaultHref: '/dashboard',
                component: 'Dashboard',
                cacheTags: ['dashboard', 'orders', 'payments', 'expenses'],
                icon: CalendarDays,
                matchExact: true,
            },
            {
                label: 'Pesanan',
                hrefKey: 'uiOrders',
                defaultHref: '/ui-orders',
                component: 'Orders/Index',
                cacheTags: ['orders'],
                icon: ShoppingBag,
            },
            {
                label: 'Pelanggan',
                hrefKey: 'uiCustomers',
                defaultHref: '/ui-customers',
                component: 'Customers/Index',
                cacheTags: ['customers'],
                icon: Users,
            },
        ],
    },
    {
        label: 'Keuangan',
        items: [
            {
                label: 'Piutang & Bayar',
                hrefKey: 'uiPayments',
                defaultHref: '/ui-payments',
                component: 'Payments/Index',
                cacheTags: ['payments', 'orders'],
                icon: Wallet,
            },
            {
                label: 'Pengeluaran',
                hrefKey: 'uiExpenses',
                defaultHref: '/ui-expenses',
                component: 'Expenses/Index',
                cacheTags: ['expenses'],
                icon: ReceiptText,
            },
            {
                label: 'Laporan',
                hrefKey: 'uiReports',
                defaultHref: '/ui-reports',
                component: 'Reports/Index',
                cacheTags: ['reports', 'orders', 'payments', 'expenses'],
                icon: BarChart3,
            },
        ],
    },
    {
        label: 'Pengaturan',
        items: [
            {
                label: 'Kategori Biaya',
                hrefKey: 'uiExpenseCategories',
                defaultHref: '/ui-expense-categories',
                component: 'ExpenseCategories/Index',
                cacheTags: ['expense-categories', 'expenses'],
                icon: Tags,
            },
        ],
    },
];

// Secondary destinations surfaced inside mobile/tablet Menu drawer
export const drawerNavGroups: NavGroupConfig[] = [
    {
        label: 'Keuangan & Pembukuan',
        items: [
            navGroups[1].items[0], // Piutang & Bayar
            navGroups[1].items[1], // Pengeluaran
            navGroups[1].items[2], // Laporan
        ],
    },
    {
        label: 'Pelanggan & Pengaturan',
        items: [
            navGroups[0].items[2], // Pelanggan
            navGroups[2].items[0], // Kategori Biaya
        ],
    },
];

export function resolveNavHref(nav: AppPageProps['nav'] | undefined, item: NavItemConfig): string {
    return (nav && nav[item.hrefKey]) || item.defaultHref;
}

export function isNavItemActive(currentUrl: string, href: string, matchExact = false): boolean {
    const currentPath = currentUrl.split('?')[0];
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const path = new URL(href, origin).pathname;

    if (path === '/dashboard' || path === '/ui-dashboard') {
        return currentPath === '/dashboard' || currentPath === '/ui-dashboard';
    }
    if (matchExact) {
        if (path === '/ui-orders') {
            return (
                currentPath === '/ui-orders' ||
                (currentPath.startsWith('/ui-orders/') && currentPath !== '/ui-orders/create')
            );
        }
        return currentPath === path;
    }
    return currentPath === path || currentPath.startsWith(path + '/');
}

function isNavItemPending(
    pendingUrl: string | null,
    pendingComponent: string | null,
    href: string,
    component: string,
    matchExact = false,
): boolean {
    if (pendingComponent && pendingComponent === component) {
        return true;
    }
    if (!pendingUrl) {
        return false;
    }
    try {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const pendingPath = new URL(pendingUrl, origin).pathname;
        return isNavItemActive(pendingPath, href, matchExact);
    } catch {
        return false;
    }
}

type SidebarNavProps = {
    onNavigate?: () => void;
    onRequestLogout?: () => void;
};

export function SidebarContent({ onNavigate, onRequestLogout }: SidebarNavProps) {
    const { url, props } = usePage<AppPageProps>();
    const { isNavigating, pendingUrl, pendingComponent } = useNavigationState();
    const nav = props.nav;
    const userName = props.auth?.user?.name ?? 'Operator Toko';

    return (
        <div className="flex h-full flex-col justify-between border-r border-[#101C16] bg-[var(--bg-rail)] px-3.5 py-5 text-[var(--text-on-rail)]">
            <div>
                <div className="mb-5 border-b border-[#F5F2EB]/12 px-2.5 pb-4">
                    <div className="flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full bg-[var(--brand-urgent)]"
                        />
                        <p className="text-[19px] font-bold tracking-[-0.02em] text-[var(--text-on-rail)]">
                            Mutiara Florist
                        </p>
                    </div>
                    <p className="mt-1 pl-4 text-[12.5px] font-medium text-[var(--text-on-rail-muted)]">
                        Atelier &amp; Buku Kas
                    </p>
                </div>

                <nav aria-label="Navigasi utama desktop" className="space-y-5">
                    {navGroups.map((group) => (
                        <div key={group.label}>
                            <p className="px-3 pb-1.5 text-[11.5px] font-semibold tracking-[0.02em] text-[var(--text-on-rail-muted)]">
                                {group.label}
                            </p>
                            <ul className="space-y-1">
                                {group.items.map((item) => {
                                    const href = resolveNavHref(nav, item);
                                    const isActive = isNavItemActive(url, href, item.matchExact);
                                    const isPending =
                                        isNavigating &&
                                        isNavItemPending(
                                            pendingUrl,
                                            pendingComponent,
                                            href,
                                            item.component,
                                            item.matchExact,
                                        );
                                    return (
                                        <li key={item.label}>
                                            <Link
                                                href={href}
                                                component={item.component}
                                                prefetch="hover"
                                                cacheFor="10s"
                                                cacheTags={item.cacheTags}
                                                onClick={onNavigate}
                                                aria-current={isActive ? 'page' : undefined}
                                                aria-busy={isPending ? 'true' : undefined}
                                                data-nav-pending={isPending ? 'true' : 'false'}
                                                className={cn(
                                                    'relative flex min-h-[44px] items-center gap-3 rounded-[9px] px-3 py-2 text-[14.5px] transition-colors focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--bg-rail-active)]',
                                                    isActive
                                                        ? 'bg-[var(--bg-rail-active)] font-bold text-[var(--bg-rail)] shadow-[0_1px_3px_rgba(0,0,0,0.16)]'
                                                        : isPending
                                                          ? 'bg-[var(--bg-rail-hover)] font-semibold text-[var(--text-on-rail)]'
                                                          : 'font-medium text-[var(--text-on-rail)]/90 hover:bg-[var(--bg-rail-hover)] hover:text-[var(--text-on-rail)]',
                                                )}
                                            >
                                                <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                                                <span className="truncate">{item.label}</span>
                                                {isPending ? (
                                                    <span
                                                        className={cn(
                                                            'ml-auto shrink-0 text-[11px] font-semibold',
                                                            isActive
                                                                ? 'text-[var(--brand-urgent)]'
                                                                : 'text-[var(--bg-rail-active)]',
                                                        )}
                                                    >
                                                        Memuat...
                                                    </span>
                                                ) : (
                                                    isActive && (
                                                        <span
                                                            aria-hidden="true"
                                                            className="ml-auto h-5 w-[3px] shrink-0 rounded-full bg-[var(--brand-urgent)]"
                                                        />
                                                    )
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>
            </div>

            <div className="space-y-2.5 border-t border-[#F5F2EB]/12 pt-4">
                <div className="flex items-center gap-2.5 px-2">
                    <span
                        aria-hidden="true"
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-[#F5F2EB]/15 bg-[var(--bg-rail-hover)] text-[var(--text-on-rail)]"
                    >
                        <User className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-[var(--text-on-rail)]">
                            {userName}
                        </p>
                        <p className="text-[12px] text-[var(--text-on-rail-muted)]">
                            Operator Toko
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onRequestLogout}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[8px] border border-[#6D8377] px-3 py-2 text-sm font-semibold text-[var(--text-on-rail)] transition-colors hover:bg-[var(--bg-rail-hover)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--bg-rail-active)]"
                >
                    <LogOut className="size-4 shrink-0" aria-hidden="true" />
                    <span>Keluar Akun</span>
                </button>
            </div>
        </div>
    );
}
