import { useState, type FormEvent } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type LoginProps = {
    errors?: Record<string, string>;
};

export default function Login(_props: LoginProps) {
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF9F6] px-4 py-10 text-[#1E2420] antialiased">
            <Head title="Masuk" />

            <main className="w-full max-w-[420px]">
                <div className="mb-7 text-center">
                    <span
                        aria-hidden="true"
                        className="mx-auto mb-3.5 grid size-12 place-items-center rounded-xl bg-[#143326] font-[var(--font-display)] text-2xl font-semibold text-[#E6EFEA]"
                    >
                        M
                    </span>
                    <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[#1E2420]">
                        Mutiara Florist
                    </h1>
                    <p className="mt-1 text-sm text-[#525B54]">
                        Masuk untuk mengelola pesanan, pengiriman, dan kas toko
                    </p>
                </div>

                <Card className="p-6 sm:p-7">
                    <h2 className="mb-5 text-base font-bold text-[#1E2420]">Masuk ke Akun Admin</h2>

                    {errors.email && (
                        <div
                            role="alert"
                            className="mb-4 rounded-md border border-[#991B1B]/40 bg-[#FEE2E2] p-3 text-sm font-medium text-[#991B1B]"
                        >
                            {errors.email}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-1.5 block text-sm font-semibold text-[#1E2420]"
                            >
                                Email admin
                            </label>
                            <div className="relative">
                                <Mail
                                    className="pointer-events-none absolute left-3 top-3.5 size-4 text-[#525B54]"
                                    aria-hidden="true"
                                />
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    autoComplete="username"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="admin@mutiaraflorist.com"
                                    aria-invalid={errors.email ? true : undefined}
                                    className="min-h-[44px] w-full rounded-md border-[1.5px] border-[#858E87] bg-white py-2 pl-9 pr-3 text-[15px] text-[#1E2420] placeholder:text-[#525B54]/75 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#143326]"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-1.5 block text-sm font-semibold text-[#1E2420]"
                            >
                                Password
                            </label>
                            <div className="relative flex items-center">
                                <Lock
                                    className="pointer-events-none absolute left-3 size-4 text-[#525B54]"
                                    aria-hidden="true"
                                />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    required
                                    autoComplete="current-password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    aria-invalid={errors.password ? true : undefined}
                                    className="min-h-[44px] w-full rounded-md border-[1.5px] border-[#858E87] bg-white py-2 pl-9 pr-12 text-[15px] text-[#1E2420] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#143326]"
                                />
                                <button
                                    type="button"
                                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-1.5 inline-flex size-9 items-center justify-center rounded text-[#525B54] hover:bg-[#F1EDE6] hover:text-[#1E2420]"
                                >
                                    {showPassword ? (
                                        <EyeOff className="size-4" aria-hidden="true" />
                                    ) : (
                                        <Eye className="size-4" aria-hidden="true" />
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p role="alert" className="mt-1 text-xs font-semibold text-[#991B1B]">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        <Button type="submit" disabled={processing} className="w-full">
                            <LogIn className="size-4" aria-hidden="true" />
                            <span>{processing ? 'Memproses...' : 'Masuk'}</span>
                        </Button>
                    </form>
                </Card>
            </main>
        </div>
    );
}
