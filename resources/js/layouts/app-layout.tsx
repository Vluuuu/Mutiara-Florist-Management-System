import { useState, type ReactNode } from 'react';
import { usePage } from '@inertiajs/react';
import { CheckCircle2, Menu, X, XCircle } from 'lucide-react';
import { SidebarContent } from '@/components/app-sidebar';
import type { AppPageProps } from '@/types';

type AppLayoutProps = {
    title: string;
    children: ReactNode;
};

export default function AppLayout({ title, children }: AppLayoutProps) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const { auth, flash, errors } = usePage<AppPageProps>().props;
    const [dismissFlash, setDismissFlash] = useState(false);

    const successMessage = !dismissFlash ? flash?.success : null;
    const errorMessage = !dismissFlash ? (flash?.error ?? errors?.customer) : null;

    return (
        <div className="min-h-screen bg-stone-50">
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-stone-200 bg-white lg:block">
                <SidebarContent />
            </aside>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
                    <button
                        type="button"
                        aria-label="Tutup menu"
                        className="absolute inset-0 bg-stone-900/50"
                        onClick={() => setMobileOpen(false)}
                    />
                    <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
                        <div className="flex justify-end px-4 pt-4">
                            <button
                                type="button"
                                aria-label="Tutup menu"
                                className="rounded-lg p-2 text-stone-500 hover:bg-stone-50"
                                onClick={() => setMobileOpen(false)}
                            >
                                <X className="size-5" aria-hidden="true" />
                            </button>
                        </div>
                        <SidebarContent onNavigate={() => setMobileOpen(false)} />
                    </div>
                </div>
            )}

            {/* Mobile header */}
            <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
                <button
                    type="button"
                    aria-label="Buka menu"
                    aria-expanded={mobileOpen}
                    className="rounded-lg p-2 text-stone-600 hover:bg-stone-50"
                    onClick={() => setMobileOpen(true)}
                >
                    <Menu className="size-5" aria-hidden="true" />
                </button>
                <p className="font-semibold text-emerald-950">Mutiara Florist</p>
            </header>

            <div className="lg:pl-64">
                {/* Desktop header */}
                <div className="hidden items-center justify-between border-b border-stone-200 bg-white px-8 py-4 lg:flex">
                    <h2 className="text-sm font-semibold text-stone-600">{title}</h2>
                    {auth?.user && (
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-stone-500">{auth.user.name}</span>
                            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-950 text-sm font-semibold text-white">
                                {auth.user.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>

                <main className="px-4 py-6 sm:px-6 lg:px-8">
                    {successMessage && (
                        <div
                            role="status"
                            className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
                        >
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />
                                <span>{successMessage}</span>
                            </div>
                            <button
                                type="button"
                                aria-label="Tutup pemberitahuan"
                                onClick={() => setDismissFlash(true)}
                                className="rounded p-1 text-emerald-800 hover:bg-emerald-100"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        </div>
                    )}

                    {errorMessage && (
                        <div
                            role="alert"
                            className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950"
                        >
                            <div className="flex items-center gap-2">
                                <XCircle className="size-5 shrink-0 text-red-700" aria-hidden="true" />
                                <span>{errorMessage}</span>
                            </div>
                            <button
                                type="button"
                                aria-label="Tutup peringatan"
                                onClick={() => setDismissFlash(true)}
                                className="rounded p-1 text-red-800 hover:bg-red-100"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        </div>
                    )}

                    {children}
                </main>
            </div>
        </div>
    );
}
