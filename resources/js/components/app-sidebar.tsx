import { Link, usePage } from '@inertiajs/react';
import {
    BarChart3,
    CalendarDays,
    LogOut,
    PlusCircle,
    ReceiptText,
    ShoppingBag,
    Tags,
    Users,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPageProps } from '@/types';
import { cn } from '@/lib/utils';

type NavItemConfig = {
    label: string;
    hrefKey: keyof AppPageProps['nav'];
    defaultHref: string;
    icon: LucideIcon;
    matchExact?: boolean;
};

export const primaryNavItems: NavItemConfig[] = [
    { label: 'Hari Ini', hrefKey: 'dashboard', defaultHref: '/dashboard', icon: CalendarDays, matchExact: true },
    { label: 'Pesanan', hrefKey: 'uiOrders', defaultHref: '/ui-orders', icon: ShoppingBag, matchExact: true },
    { label: 'Buat Pesanan', hrefKey: 'uiOrdersCreate', defaultHref: '/ui-orders/create', icon: PlusCircle },
    { label: 'Piutang & Bayar', hrefKey: 'uiPayments', defaultHref: '/ui-payments', icon: Wallet },
];

export const secondaryNavItems: NavItemConfig[] = [
    { label: 'Pelanggan', hrefKey: 'uiCustomers', defaultHref: '/ui-customers', icon: Users },
    { label: 'Pengeluaran', hrefKey: 'uiExpenses', defaultHref: '/ui-expenses', icon: ReceiptText },
    { label: 'Kategori Biaya', hrefKey: 'uiExpenseCategories', defaultHref: '/ui-expense-categories', icon: Tags },
    { label: 'Laporan', hrefKey: 'uiReports', defaultHref: '/ui-reports', icon: BarChart3 },
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

type SidebarNavProps = {
    onNavigate?: () => void;
    onRequestLogout?: () => void;
};

export function SidebarContent({ onNavigate, onRequestLogout }: SidebarNavProps) {
    const { url, props } = usePage<AppPageProps>();
    const nav = props.nav;
    const userName = props.auth?.user?.name ?? 'Operator Toko';

    const renderGroup = (groupLabel: string, items: NavItemConfig[]) => (
        <div className="mb-5">
            <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#C6D7CE]">
                {groupLabel}
            </p>
            <ul className="space-y-1">
                {items.map((item) => {
                    const href = resolveNavHref(nav, item);
                    const isActive = isNavItemActive(url, href, item.matchExact);
                    return (
                        <li key={item.label}>
                            <Link
                                href={href}
                                onClick={onNavigate}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'flex min-h-[44px] items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#E6EFEA]',
                                    isActive
                                        ? 'bg-[#E6EFEA] font-bold text-[#143326]'
                                        : 'font-medium text-[#F6F4EF] hover:bg-[#1D4534]',
                                )}
                            >
                                <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                                <span>{item.label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );

    return (
        <div className="flex h-full flex-col justify-between bg-[#143326] px-3.5 py-5 text-[#F6F4EF]">
            <div>
                <div className="mb-4 flex items-center gap-3 border-b border-white/15 px-2 pb-4">
                    <span
                        aria-hidden="true"
                        className="grid size-[34px] shrink-0 place-items-center rounded-md bg-[#E6EFEA] font-[var(--font-display)] text-[17px] font-semibold text-[#143326]"
                    >
                        M
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-base font-bold leading-tight text-[#F6F4EF]">
                            Mutiara Florist
                        </p>
                        <p className="truncate text-xs text-[#C6D7CE]">Manajemen Pesanan &amp; Kas</p>
                    </div>
                </div>

                <nav aria-label="Navigasi utama desktop">
                    {renderGroup('Operasional Harian', primaryNavItems)}
                    {renderGroup('Pelanggan & Biaya', secondaryNavItems)}
                </nav>
            </div>

            <div className="space-y-2 border-t border-white/15 pt-3.5">
                <div className="px-2.5 py-1">
                    <p className="truncate text-sm font-semibold text-[#F6F4EF]">{userName}</p>
                    <p className="text-xs text-[#C6D7CE]">Operator Kasir &amp; Jadwal</p>
                </div>
                <button
                    type="button"
                    onClick={onRequestLogout}
                    className="flex min-h-[44px] w-full items-center gap-2 rounded-md border border-white/25 px-3 py-2 text-left text-sm font-semibold text-[#F6F4EF] transition-colors hover:bg-[#1D4534] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#E6EFEA]"
                >
                    <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
                    <span>Keluar Akun</span>
                </button>
            </div>
        </div>
    );
}

export function AppSidebar() {
    return (
        <aside className="hidden w-[248px] shrink-0 lg:block">
            <SidebarContent />
        </aside>
    );
}
