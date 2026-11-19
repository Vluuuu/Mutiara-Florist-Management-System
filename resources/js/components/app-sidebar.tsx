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
        <div className="mb-6">
            <p className="px-3 pb-2 text-xs font-semibold text-[#B8C6BD]">
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
                                    'flex min-h-[44px] items-center gap-3 rounded-[8px] px-3 py-2.5 text-[15px] transition-colors focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#F2ECE1]',
                                    isActive
                                        ? 'bg-[#F2ECE1] font-bold text-[#182920]'
                                        : 'font-medium text-[#F5F1E8] hover:bg-[#233B2E]',
                                )}
                            >
                                <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                                <span>{item.label}</span>
                                {isActive && (
                                    <span
                                        aria-hidden="true"
                                        className="ml-auto size-2 shrink-0 rounded-full bg-[#9A3B22]"
                                    />
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );

    return (
        <div className="flex h-full flex-col justify-between border-r border-[#122018] bg-[#182920] px-4 py-5 text-[#F5F1E8]">
            <div>
                <div className="mb-6 border-b border-[#F5F1E8]/15 px-2.5 pb-4">
                    <p className="text-[20px] font-bold tracking-[-0.015em] text-[#F5F1E8]">
                        Mutiara Florist
                    </p>
                    <p className="mt-1 text-[13px] text-[#B8C6BD]">
                        Buku Pesanan &amp; Kas
                    </p>
                </div>

                <nav aria-label="Navigasi utama desktop">
                    {renderGroup('Operasional Harian', primaryNavItems)}
                    {renderGroup('Pelanggan & Buku Kas', secondaryNavItems)}
                </nav>
            </div>

            <div className="space-y-3 border-t border-[#F5F1E8]/15 pt-4">
                <div className="px-2.5">
                    <p className="break-words text-sm font-semibold text-[#F5F1E8]">{userName}</p>
                    <p className="mt-0.5 text-[13px] text-[#B8C6BD]">Kasir &amp; Jadwal</p>
                </div>
                <button
                    type="button"
                    onClick={onRequestLogout}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[8px] border border-[#6D8377] px-3 py-2 text-sm font-semibold text-[#F5F1E8] transition-colors hover:bg-[#233B2E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#F2ECE1]"
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
        <aside className="hidden w-[256px] shrink-0 lg:block">
            <SidebarContent />
        </aside>
    );
}
