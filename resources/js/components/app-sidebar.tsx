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

// Modul yang masih memakai halaman Blade lama. Tautan ini memakai tag <a>
// biasa agar melakukan navigasi penuh dan tidak di-intercept oleh router Inertia.
const bladeItems: Array<{ label: string; href: keyof AppPageProps['nav']; icon: LucideIcon }> = [
    { label: 'Pembayaran', href: 'payments', icon: Wallet },
    { label: 'Pengeluaran', href: 'expenses', icon: ReceiptText },
    { label: 'Kategori Pengeluaran', href: 'expenseCategories', icon: Tags },
];

export function SidebarContent({ onNavigate }: SidebarNavProps) {
    const { url, props } = usePage<AppPageProps>();
    const nav = props.nav;

    const currentPath = url.split('?')[0];
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';

    const dashboardPath = nav?.dashboard ? new URL(nav.dashboard, origin).pathname : '/ui-dashboard';
    const dashboardActive = currentPath === dashboardPath;

    const customersHref = nav?.uiCustomers ?? '/ui-customers';
    const customersPath = new URL(customersHref, origin).pathname;
    const customersActive = currentPath === customersPath || currentPath.startsWith(customersPath + '/');

    const ordersHref = nav?.uiOrders ?? '/ui-orders';
    const ordersPath = new URL(ordersHref, origin).pathname;
    const ordersActive = currentPath === ordersPath || currentPath.startsWith(ordersPath + '/');

    const csrfToken =
        typeof document !== 'undefined'
            ? document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
            : '';

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 px-5 py-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-950 text-white">
                    <Flower2 className="size-5" aria-hidden="true" />
                </span>
                <div>
                    <p className="font-semibold text-emerald-950">Mutiara Florist</p>
                    <p className="text-xs text-stone-500">Management System</p>
                </div>
            </div>

            <nav aria-label="Navigasi utama" className="flex-1 space-y-1 px-3">
                <Link
                    href={nav?.dashboard ?? '/ui-dashboard'}
                    onClick={onNavigate}
                    aria-current={dashboardActive ? 'page' : undefined}
                    className={cn(
                        'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors',
                        dashboardActive
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
                    )}
                >
                    <LayoutDashboard className="size-4.5 shrink-0" aria-hidden="true" />
                    Dashboard
                </Link>

                <Link
                    href={customersHref}
                    onClick={onNavigate}
                    aria-current={customersActive ? 'page' : undefined}
                    className={cn(
                        'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors',
                        customersActive
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
                    )}
                >
                    <Users className="size-4.5 shrink-0" aria-hidden="true" />
                    Pelanggan
                </Link>

                <Link
                    href={ordersHref}
                    onClick={onNavigate}
                    aria-current={ordersActive ? 'page' : undefined}
                    className={cn(
                        'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors',
                        ordersActive
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
                    )}
                >
                    <ShoppingBag className="size-4.5 shrink-0" aria-hidden="true" />
                    Pesanan
                </Link>

                {bladeItems.map((item) => (
                    <a
                        key={item.label}
                        href={nav ? nav[item.href] : '#'}
                        onClick={onNavigate}
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
                    >
                        <item.icon className="size-4.5 shrink-0" aria-hidden="true" />
                        {item.label}
                    </a>
                ))}
            </nav>

            <div className="space-y-1 border-t border-stone-200 px-3 py-4">
                <a
                    href={nav?.legacyDashboard ?? '/dashboard'}
                    className="flex items-center gap-3 rounded-lg px-4 py-2 text-xs text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                >
                    Dashboard Blade lama
                </a>
                <a
                    href={nav?.customers ?? '/customers'}
                    className="flex items-center gap-3 rounded-lg px-4 py-2 text-xs text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                >
                    Pelanggan Blade lama
                </a>
                <a
                    href={nav?.orders ?? '/orders'}
                    className="flex items-center gap-3 rounded-lg px-4 py-2 text-xs text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                >
                    Pesanan Blade lama
                </a>

                <form method="POST" action={nav?.logout ?? '/logout'}>
                    <button
                        type="submit"
                        className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                    >
                        <LogOut className="size-4.5" aria-hidden="true" />
                        Keluar
                    </button>
                    <input type="hidden" name="_token" value={csrfToken} />
                </form>
            </div>
        </div>
    );
}
