import { Link, usePage } from '@inertiajs/react';
import {
    Flower2,
    LayoutDashboard,
    LogOut,
    ReceiptText,
    ShoppingBag,
    Tags,
    Users,
    Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPageProps } from '@/types';
import { cn } from '@/lib/utils';

type SidebarNavProps = {
    onNavigate?: () => void;
};

type NavItemConfig = {
    label: string;
    hrefKey: keyof AppPageProps['nav'];
    defaultHref: string;
    icon: LucideIcon;
};

const mainNavItems: NavItemConfig[] = [
    { label: 'Dashboard', hrefKey: 'dashboard', defaultHref: '/ui-dashboard', icon: LayoutDashboard },
    { label: 'Pelanggan', hrefKey: 'uiCustomers', defaultHref: '/ui-customers', icon: Users },
    { label: 'Pesanan', hrefKey: 'uiOrders', defaultHref: '/ui-orders', icon: ShoppingBag },
    { label: 'Pembayaran', hrefKey: 'uiPayments', defaultHref: '/ui-payments', icon: Wallet },
    { label: 'Pengeluaran', hrefKey: 'uiExpenses', defaultHref: '/ui-expenses', icon: ReceiptText },
    { label: 'Kategori Biaya', hrefKey: 'uiExpenseCategories', defaultHref: '/ui-expense-categories', icon: Tags },
];

const legacyBladeItems: Array<{ label: string; hrefKey: keyof AppPageProps['nav']; defaultHref: string }> = [
    { label: 'Dashboard Blade', hrefKey: 'legacyDashboard', defaultHref: '/dashboard' },
    { label: 'Pelanggan Blade', hrefKey: 'customers', defaultHref: '/customers' },
    { label: 'Pesanan Blade', hrefKey: 'orders', defaultHref: '/orders' },
    { label: 'Pembayaran Blade', hrefKey: 'payments', defaultHref: '/payments' },
    { label: 'Pengeluaran Blade', hrefKey: 'expenses', defaultHref: '/expenses' },
    { label: 'Kategori Biaya Blade', hrefKey: 'expenseCategories', defaultHref: '/expense-categories' },
];

export function SidebarContent({ onNavigate }: SidebarNavProps) {
    const { url, props } = usePage<AppPageProps>();
    const nav = props.nav;

    const currentPath = url.split('?')[0];
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

    const csrfToken =
        typeof document !== 'undefined'
            ? document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
            : '';

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 px-5 py-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-950 text-white shadow-xs">
                    <Flower2 className="size-5" aria-hidden="true" />
                </span>
                <div>
                    <p className="font-semibold text-emerald-950">Mutiara Florist</p>
                    <p className="text-xs text-stone-500">Management System</p>
                </div>
            </div>

            <nav aria-label="Navigasi utama" className="flex-1 space-y-1 px-3">
                {mainNavItems.map((item) => {
                    const href = (nav && nav[item.hrefKey]) || item.defaultHref;
                    const path = new URL(href, origin).pathname;
                    const isActive =
                        currentPath === path ||
                        (path !== '/ui-dashboard' && currentPath.startsWith(path + '/'));

                    return (
                        <Link
                            key={item.label}
                            href={href}
                            onClick={onNavigate}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors',
                                isActive
                                    ? 'bg-emerald-50 text-emerald-900 font-bold'
                                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
                            )}
                        >
                            <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="space-y-1 border-t border-stone-200 px-3 py-4">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    Fallback Blade Lama
                </p>
                <div className="grid grid-cols-2 gap-1">
                    {legacyBladeItems.map((item) => (
                        <a
                            key={item.label}
                            href={(nav && nav[item.hrefKey]) || item.defaultHref}
                            className="rounded px-2.5 py-1 text-[11px] text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                        >
                            {item.label}
                        </a>
                    ))}
                </div>

                <div className="pt-2">
                    <form method="POST" action={nav?.logout ?? '/logout'}>
                        <button
                            type="submit"
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                        >
                            <LogOut className="size-4" aria-hidden="true" />
                            Keluar
                        </button>
                        <input type="hidden" name="_token" value={csrfToken} />
                    </form>
                </div>
            </div>
        </div>
    );
}

export function AppSidebar() {
    return (
        <aside className="hidden w-64 shrink-0 border-r border-stone-200 bg-white md:block">
            <SidebarContent />
        </aside>
    );
}
