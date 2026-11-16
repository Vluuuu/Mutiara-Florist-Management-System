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

// Item yang menuju layar Blade lama. Tautan ini TIDAK boleh memakai Link
// Inertia: Inertia meng-intercept kliknya lalu mengirim XHR, dan respons HTML
// Blade bukan respons Inertia yang valid sehingga Inertia menampilkan dialog
// error alih-alih berpindah halaman. Anchor biasa melakukan navigasi penuh.
const bladeItems: Array<{ label: string; href: keyof AppPageProps['nav']; icon: LucideIcon }> = [
    { label: 'Pelanggan', href: 'customers', icon: Users },
    { label: 'Pesanan', href: 'orders', icon: ShoppingBag },
    { label: 'Pembayaran', href: 'payments', icon: Wallet },
    { label: 'Pengeluaran', href: 'expenses', icon: ReceiptText },
    { label: 'Kategori Pengeluaran', href: 'expenseCategories', icon: Tags },
];

export function SidebarContent({ onNavigate }: SidebarNavProps) {
    const { url, props } = usePage<AppPageProps>();
    const nav = props.nav;
    // route() mengirim URL absolut sedangkan usePage().url berupa pathname,
    // jadi normalisasi href ke pathname sebelum dibandingkan.
    const currentPath = url.split('?')[0];
    const dashboardPath = new URL(nav.dashboard, window.location.origin).pathname;
    const dashboardActive = currentPath === dashboardPath;
    const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

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
                    href={nav.dashboard}
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
                {bladeItems.map((item) => (
                    <a
                        key={item.label}
                        href={nav[item.href]}
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
                    href={nav.legacyDashboard}
                    className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                >
                    Dashboard Blade lama
                </a>
                {/* Logout sebagai form POST native: respons redirect Blade bukan
                    respons Inertia, jadi router.post() akan menampilkan dialog
                    error yang sama dengan tautan Blade. */}
                <form method="POST" action={nav.logout}>
                    <button
                        type="submit"
                        className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900"
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
