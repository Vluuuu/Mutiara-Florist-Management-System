import { useState, type FormEvent } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LoginProps = {
    errors?: Record<string, string>;
};

const LEDGER_SCOPE = [
    { num: '01', text: 'Pencatatan nota pelanggan & jadwal pengiriman per rangkaian bunga' },
    { num: '02', text: 'Pemantauan antrean rangkai harian serta status pengerjaan linear' },
    { num: '03', text: 'Pembukuan pembayaran, piutang terbuka, dan pengeluaran dengan jejak audit' },
];

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
        <div className="grid min-h-screen grid-cols-1 bg-[#F7F3EC] text-[#1C211E] antialiased lg:grid-cols-[1.05fr_1fr]">
            <Head title="Masuk" />

            {/* Desktop Editorial Spine */}
            <aside className="hidden flex-col justify-between bg-[#182920] p-12 text-[#F5F1E8] lg:flex">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#9A3B22]" />
                        <p className="text-2xl font-bold tracking-[-0.015em] text-[#F5F1E8]">
                            Mutiara Florist
                        </p>
                    </div>

                    <p className="mt-10 max-w-md text-3xl font-bold leading-snug tracking-[-0.015em] text-[#F5F1E8]">
                        Buku Meja Pesanan, Antrean Rangkai, dan Kas Toko.
                    </p>

                    <ol className="mt-10 max-w-md divide-y divide-[#F5F1E8]/15 border-y border-[#F5F1E8]/15">
                        {LEDGER_SCOPE.map((row) => (
                            <li key={row.num} className="flex items-baseline gap-4 py-4">
                                <span className="font-[var(--font-mono)] text-xs font-bold text-[#F2ECE1] tabular-nums">
                                    {row.num}
                                </span>
                                <span className="text-sm leading-relaxed text-[#B8C6BD]">
                                    {row.text}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>

                <p className="text-xs text-[#B8C6BD]">
                    Ruang kerja operasional internal Mutiara Florist
                </p>
            </aside>

            {/* Form Pane */}
            <main className="flex items-center justify-center px-4 py-8 sm:px-8">
                <div className="w-full max-w-[440px]">
                    <div className="mb-6 flex items-center gap-2 lg:hidden">
                        <span aria-hidden="true" className="size-2 rounded-full bg-[#9A3B22]" />
                        <p className="text-xl font-bold tracking-[-0.015em] text-[#182920]">
                            Mutiara Florist
                        </p>
                    </div>

                    <div className="atelier-sheet p-6 sm:p-8">
                        <h1 className="atelier-h1">Masuk Ruang Kerja</h1>
                        <p className="mt-1.5 text-sm text-[#545852]">
                            Masukkan akun operator toko untuk melanjutkan.
                        </p>

                        {errors.email && (
                            <div
                                role="alert"
                                className="mt-5 rounded-[8px] border border-[#E2B3AA] bg-[#FCECE9] p-3.5 text-sm font-medium text-[#8A2619]"
                            >
                                {errors.email}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="mb-1.5 block text-sm font-semibold text-[#1C211E]"
                                >
                                    Email admin
                                </label>
                                <div className="relative">
                                    <Mail
                                        className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-[#545852]"
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
                                        placeholder="nama@domain-toko.com"
                                        aria-invalid={errors.email ? true : undefined}
                                        className="min-h-[44px] w-full rounded-[8px] border-[1.5px] border-[#7D776C] bg-[#FFFDF9] py-2 pl-10 pr-3.5 text-[15px] text-[#1C211E] placeholder:text-[#60645E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="mb-1.5 block text-sm font-semibold text-[#1C211E]"
                                >
                                    Password
                                </label>
                                <div className="relative flex items-center">
                                    <Lock
                                        className="pointer-events-none absolute left-3.5 size-4 text-[#545852]"
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
                                        className="min-h-[44px] w-full rounded-[8px] border-[1.5px] border-[#7D776C] bg-[#FFFDF9] py-2 pl-10 pr-12 text-[15px] text-[#1C211E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
                                    />
                                    <button
                                        type="button"
                                        aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        className="absolute right-0 inline-flex size-11 items-center justify-center rounded-[8px] text-[#545852] hover:bg-[#EFE9DE] hover:text-[#1C211E]"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="size-4" aria-hidden="true" />
                                        ) : (
                                            <Eye className="size-4" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p role="alert" className="mt-1 text-xs font-semibold text-[#8A2619]">
                                        {errors.password}
                                    </p>
                                )}
                            </div>

                            <div className="pt-1">
                                <Button type="submit" disabled={processing} className="w-full">
                                    <LogIn className="size-4" aria-hidden="true" />
                                    <span>{processing ? 'Memproses...' : 'Masuk'}</span>
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
