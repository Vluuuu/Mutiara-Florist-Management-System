import { useState, type FormEvent } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Flower2, Lock, LogIn, Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';

type LoginProps = {
    errors?: Record<string, string>;
};

export default function Login({ errors: initialErrors }: LoginProps) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-5 py-12 text-stone-900 antialiased">
            <Head title="Masuk — Mutiara Florist Management System" />

            <main className="w-full max-w-[420px]">
                <div className="mb-8 text-center">
                    <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-950 text-white shadow-md">
                        <Flower2 className="size-7" aria-hidden="true" />
                    </span>
                    <h1 className="text-2xl font-bold tracking-tight text-emerald-950">
                        Mutiara Florist
                    </h1>
                    <p className="mt-1.5 text-sm text-stone-500">
                        Management System · Masuk untuk mengelola pesanan dan operasional
                    </p>
                </div>

                <Card className="border border-stone-200 bg-white p-7 shadow-sm sm:p-8">
                    <h2 className="mb-6 text-lg font-semibold text-stone-900">
                        Masuk ke dashboard
                    </h2>

                    {errors.email && (
                        <div
                            role="alert"
                            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
                        >
                            {errors.email}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-1.5 block text-xs font-semibold text-stone-700"
                            >
                                Email admin
                            </label>
                            <div className="relative">
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    autoComplete="username"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="admin@example.com"
                                    className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                                />
                                <Mail className="pointer-events-none absolute left-3 top-3 size-4 text-stone-400" />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-1.5 block text-xs font-semibold text-stone-700"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    required
                                    autoComplete="current-password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                                />
                                <Lock className="pointer-events-none absolute left-3 top-3 size-4 text-stone-400" />
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-900 disabled:opacity-50"
                        >
                            <LogIn className="size-4" />
                            {processing ? 'Memproses...' : 'Masuk'}
                        </button>
                    </form>
                    <div className="mt-4 border-t border-stone-100 pt-4 text-center">
                        <a
                            href="/login?fallback=blade"
                            className="text-xs text-stone-500 hover:text-stone-700 hover:underline"
                        >
                            Tampilan Login Klasik (Blade Fallback) →
                        </a>
                    </div>
                </Card>

                <p className="mt-6 text-center text-xs text-stone-400">
                    Aplikasi internal · Tidak tersedia pendaftaran publik
                </p>
            </main>
        </div>
    );
}
