import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Check, Copy, Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

type DemoAccessProps = {
    available: boolean;
    email?: string;
    password?: string;
    reset_interval?: string;
};

type DemoNavigationProps = {
    is_demo_runtime: boolean;
    demo_entry_url?: string;
    admin_entry_url?: string;
    inactive_notice?: string | null;
};

type LoginProps = {
    errors?: Record<string, string>;
    demoAccess?: DemoAccessProps | null;
    demoNavigation?: DemoNavigationProps | null;
};

const LEDGER_SCOPE = [
    { num: '01', text: 'Pencatatan nota pelanggan & jadwal pengiriman per rangkaian bunga' },
    { num: '02', text: 'Pemantauan antrean rangkai harian serta status pengerjaan linear' },
    { num: '03', text: 'Pembukuan pembayaran, piutang terbuka, dan pengeluaran dengan jejak audit' },
];

function legacyCopyText(text: string): boolean {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
    document.body.append(field);
    field.select();
    try {
        return document.execCommand('copy');
    } finally {
        field.remove();
        previousFocus?.focus({ preventScroll: true });
    }
}

export default function Login({ demoAccess, demoNavigation }: LoginProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
    const [copyStatus, setCopyStatus] = useState('');
    const copyTimerRef = useRef<number | null>(null);
    const lastAnnouncementRef = useRef('');

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        post('/login');
    };

    const showDemoCard = Boolean(demoAccess?.available && demoAccess.email && demoAccess.password);

    useEffect(() => {
        if (!showDemoCard) {
            return;
        }

        const announce = (field: 'email' | 'password', ok: boolean) => {
            if (copyTimerRef.current !== null) {
                window.clearTimeout(copyTimerRef.current);
            }

            let message = ok
                ? field === 'email'
                    ? 'Email demo disalin'
                    : 'Password demo disalin'
                : 'Gagal menyalin ke clipboard';

            if (message === lastAnnouncementRef.current) {
                message += '\u00A0';
            }
            lastAnnouncementRef.current = message;

            setCopiedField(ok ? field : null);
            setCopyStatus('');
            window.requestAnimationFrame(() => setCopyStatus(message));

            copyTimerRef.current = window.setTimeout(() => {
                setCopiedField(null);
                setCopyStatus('');
            }, 2200);
        };

        const runCopy = async (target: HTMLElement | null) => {
            if (!target) {
                return;
            }
            const field = target.id === 'demo-credential-email' ? 'email' : 'password';
            const text = target.innerText.trim();
            if (!text) {
                return;
            }

            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                } else if (!legacyCopyText(text)) {
                    throw new Error('Copy failed');
                }
                announce(field, true);
            } catch {
                if (legacyCopyText(text)) {
                    announce(field, true);
                } else {
                    announce(field, false);
                }
            }
        };

        const onCommand = (event: Event) => {
            const cmdEvent = event as Event & { command?: string; target: EventTarget | null };
            if (cmdEvent.command === '--copy' && cmdEvent.target instanceof HTMLElement) {
                void runCopy(cmdEvent.target);
            }
        };

        const onClickFallback = (event: MouseEvent) => {
            if (event.defaultPrevented) {
                return;
            }
            const el = event.target instanceof Element ? event.target.closest('button[command="--copy"]') : null;
            if (!el) {
                return;
            }
            const targetId = el.getAttribute('commandfor');
            if (!targetId) {
                return;
            }
            void runCopy(document.getElementById(targetId));
        };

        const supportsInvokerCommands = typeof window !== 'undefined' && 'CommandEvent' in window;

        if (supportsInvokerCommands) {
            document.addEventListener('command', onCommand, true);
        } else {
            document.addEventListener('click', onClickFallback);
        }

        return () => {
            if (supportsInvokerCommands) {
                document.removeEventListener('command', onCommand, true);
            } else {
                document.removeEventListener('click', onClickFallback);
            }
            if (copyTimerRef.current !== null) {
                window.clearTimeout(copyTimerRef.current);
            }
        };
    }, [showDemoCard]);

    const handleAutofillDemo = () => {
        if (!demoAccess?.email || !demoAccess?.password) {
            return;
        }
        setData({
            email: demoAccess.email,
            password: demoAccess.password,
        });
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
                                        autoCorrect="off"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        enterKeyHint="next"
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
                                        enterKeyHint="done"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        aria-invalid={errors.password ? true : undefined}
                                        className="min-h-[44px] w-full rounded-[8px] border-[1.5px] border-[#7D776C] bg-[#FFFDF9] py-2 pl-10 pr-12 text-[15px] text-[#1C211E] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
                                    />
                                    <button
                                        type="button"
                                        aria-pressed={showPassword}
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

                        {showDemoCard && demoAccess && (
                            <section
                                aria-labelledby="demo-credentials-heading"
                                className="mt-6 border-t border-[#DED6C8] pt-5"
                            >
                                <div className="rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE] p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h2
                                            id="demo-credentials-heading"
                                            className="text-sm font-bold text-[#1C211E]"
                                        >
                                            Akun Demo Evaluasi
                                        </h2>
                                        <button
                                            type="button"
                                            onClick={handleAutofillDemo}
                                            className="inline-flex min-h-[44px] items-center rounded-[6px] border border-[#7D776C] bg-[#FFFDF9] px-3.5 py-2 text-xs font-semibold text-[#1D3B2A] hover:bg-[#EBF3EE] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
                                        >
                                            Isi ke Form
                                        </button>
                                    </div>

                                    <p className="mt-1 text-xs leading-relaxed text-[#545852]">
                                        Gunakan kredensial simulasi berikut untuk meninjau fitur tanpa menyentuh data toko.
                                    </p>

                                    <dl className="mt-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2 rounded-[6px] border border-[#DED6C8] bg-[#FFFDF9] pl-3 pr-1 py-1">
                                            <div className="min-w-0">
                                                <dt className="text-[11px] font-semibold text-[#545852]">Email</dt>
                                                <dd
                                                    id="demo-credential-email"
                                                    className="truncate font-[var(--font-mono)] text-xs font-medium text-[#1C211E]"
                                                >
                                                    {demoAccess.email}
                                                </dd>
                                            </div>
                                            <button
                                                type="button"
                                                {...({
                                                    command: '--copy',
                                                    commandfor: 'demo-credential-email',
                                                } as Record<string, string>)}
                                                aria-label="Salin email demo"
                                                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[6px] text-[#1D3B2A] hover:bg-[#EFE9DE] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
                                            >
                                                {copiedField === 'email' ? (
                                                    <Check className="size-4" aria-hidden="true" />
                                                ) : (
                                                    <Copy className="size-4" aria-hidden="true" />
                                                )}
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 rounded-[6px] border border-[#DED6C8] bg-[#FFFDF9] pl-3 pr-1 py-1">
                                            <div className="min-w-0">
                                                <dt className="text-[11px] font-semibold text-[#545852]">Password</dt>
                                                <dd
                                                    id="demo-credential-password"
                                                    className="truncate font-[var(--font-mono)] text-xs font-medium text-[#1C211E]"
                                                >
                                                    {demoAccess.password}
                                                </dd>
                                            </div>
                                            <button
                                                type="button"
                                                {...({
                                                    command: '--copy',
                                                    commandfor: 'demo-credential-password',
                                                } as Record<string, string>)}
                                                aria-label="Salin password demo"
                                                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[6px] text-[#1D3B2A] hover:bg-[#EFE9DE] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
                                            >
                                                {copiedField === 'password' ? (
                                                    <Check className="size-4" aria-hidden="true" />
                                                ) : (
                                                    <Copy className="size-4" aria-hidden="true" />
                                                )}
                                            </button>
                                        </div>
                                    </dl>

                                    <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-[#545852]">
                                        <span>Data simulasi direset otomatis setiap {demoAccess.reset_interval ?? '24 jam'}.</span>
                                        <span
                                            role="status"
                                            className={`shrink-0 font-semibold text-[#164B2A] transition-opacity ${
                                                copyStatus ? 'opacity-100' : 'opacity-0'
                                            }`}
                                        >
                                            {copyStatus}
                                        </span>
                                    </div>
                                </div>
                            </section>
                        )}

                        {demoNavigation?.is_demo_runtime && !showDemoCard && demoNavigation.inactive_notice && (
                            <div
                                role="status"
                                className="mt-6 border-t border-[#DED6C8] pt-5"
                            >
                                <div className="rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE] p-4 text-xs leading-relaxed text-[#545852]">
                                    <p className="font-semibold text-[#1C211E]">Mode Demo Tidak Aktif</p>
                                    <p className="mt-1">{demoNavigation.inactive_notice}</p>
                                </div>
                            </div>
                        )}

                        {demoNavigation?.is_demo_runtime && (
                            <div className="mt-4 text-center">
                                <a
                                    href={demoNavigation.admin_entry_url ?? '/admin-entry'}
                                    className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] px-3 text-sm font-semibold text-[#1D3B2A] underline-offset-4 hover:bg-[#EFE9DE] hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
                                >
                                    Kembali ke Login Admin
                                </a>
                            </div>
                        )}

                        {!demoNavigation?.is_demo_runtime && demoNavigation?.demo_entry_url && (
                            <section
                                aria-label="Akses Mode Demo Evaluasi"
                                className="mt-6 border-t border-[#DED6C8] pt-5"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE] px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-[#1C211E]">Mode Demo Evaluasi</p>
                                        <p className="text-xs text-[#545852]">
                                            Tinjau aplikasi menggunakan data simulasi terisolasi.
                                        </p>
                                    </div>
                                    <a
                                        href={demoNavigation.demo_entry_url}
                                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[6px] border border-[#7D776C] bg-[#FFFDF9] px-3.5 py-2 text-xs font-semibold text-[#1D3B2A] hover:bg-[#EBF3EE] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#1D3B2A]"
                                    >
                                        Buka Demo
                                    </a>
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
