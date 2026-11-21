import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { NavigationErrorInfo } from '@/lib/navigation-state';

export function SkeletonBar({ className }: { className?: string }) {
    return (
        <div
            aria-hidden="true"
            className={cn('rounded-[6px] bg-[#EFE9DE]', className)}
        />
    );
}

export function PageHeaderSkeleton({
    title,
    subtitle = 'Memuat data halaman...',
    withAction = true,
}: {
    title?: string;
    subtitle?: string;
    withAction?: boolean;
}) {
    if (title) {
        return (
            <div className="mb-7 flex flex-col gap-3 border-b border-[#DED6C8] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="atelier-h1">{title}</h1>
                    <p className="mt-1 text-[14px] text-[#545852] sm:text-[15px]">{subtitle}</p>
                </div>
                {withAction && <SkeletonBar className="h-11 w-40 shrink-0 rounded-[8px]" />}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
                <SkeletonBar className="h-3.5 w-28" />
                <SkeletonBar className="h-8 w-56 sm:w-72" />
                <SkeletonBar className="h-4 w-72 max-w-full sm:w-96" />
            </div>
            {withAction && <SkeletonBar className="h-11 w-40 shrink-0 rounded-[8px]" />}
        </div>
    );
}

export function SummaryStripSkeleton({ cards = 3 }: { cards?: number }) {
    return (
        <section aria-busy="true" aria-label="Memuat ringkasan">
            <div
                className={cn(
                    'grid gap-3',
                    cards === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3',
                )}
            >
                {Array.from({ length: cards }).map((_, index) => (
                    <div
                        key={index}
                        className="rounded-[12px] border border-[#DED6C8] bg-[#FFFDF9] p-4 shadow-[0_1px_2px_rgba(28,33,30,0.06)]"
                    >
                        <SkeletonBar className="h-3.5 w-28" />
                        <SkeletonBar className="mt-3 h-7 w-36" />
                        <SkeletonBar className="mt-2 h-3.5 w-24" />
                    </div>
                ))}
            </div>
        </section>
    );
}

export function DataListSkeleton({
    title,
    rows = 5,
    showFilters = true,
}: {
    title?: string;
    rows?: number;
    showFilters?: boolean;
}) {
    return (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-5">
            <span className="sr-only">Memuat daftar data halaman...</span>
            <PageHeaderSkeleton title={title} />
            {showFilters && (
                <Card>
                    <CardContent className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
                        <SkeletonBar className="h-11 w-full rounded-[8px]" />
                        <SkeletonBar className="h-11 w-full rounded-[8px]" />
                        <SkeletonBar className="h-11 w-full rounded-[8px]" />
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader>
                    <SkeletonBar className="h-5 w-44" />
                    <SkeletonBar className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {Array.from({ length: rows }).map((_, index) => (
                        <div
                            key={index}
                            className="flex flex-col justify-between gap-3 rounded-[10px] border border-[#DED6C8] bg-[#FFFDF9] p-4 sm:flex-row sm:items-center"
                        >
                            <div className="space-y-2">
                                <SkeletonBar className="h-4 w-40" />
                                <SkeletonBar className="h-3.5 w-56" />
                            </div>
                            <div className="flex items-center gap-3">
                                <SkeletonBar className="h-6 w-24 rounded-full" />
                                <SkeletonBar className="h-5 w-28" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

export function FormCardSkeleton({
    title,
    fields = 5,
}: {
    title?: string;
    fields?: number;
}) {
    return (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-5">
            <span className="sr-only">Memuat formulir...</span>
            <PageHeaderSkeleton title={title} subtitle="Menyiapkan formulir..." withAction={false} />
            <Card>
                <CardHeader>
                    <SkeletonBar className="h-5 w-48" />
                    <SkeletonBar className="h-4 w-72 max-w-full" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {Array.from({ length: fields }).map((_, index) => (
                            <div key={index} className="space-y-2">
                                <SkeletonBar className="h-4 w-32" />
                                <SkeletonBar className="h-11 w-full rounded-[8px]" />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-3 border-t border-[#DED6C8] pt-4">
                        <SkeletonBar className="h-11 w-28 rounded-[8px]" />
                        <SkeletonBar className="h-11 w-40 rounded-[8px]" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function DetailPageSkeleton({ title }: { title?: string }) {
    return (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-5">
            <span className="sr-only">Memuat detail halaman...</span>
            <PageHeaderSkeleton title={title} />
            <SummaryStripSkeleton cards={3} />
            <div className="grid gap-5 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <SkeletonBar className="h-5 w-40" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <SkeletonBar className="h-20 w-full rounded-[10px]" />
                        <SkeletonBar className="h-20 w-full rounded-[10px]" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <SkeletonBar className="h-5 w-36" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <SkeletonBar className="h-4 w-full" />
                        <SkeletonBar className="h-4 w-5/6" />
                        <SkeletonBar className="h-10 w-full rounded-[8px]" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export function ReceivablesSkeleton() {
    return (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-3">
            <span className="sr-only">Memuat daftar piutang terbuka...</span>
            {Array.from({ length: 3 }).map((_, index) => (
                <div
                    key={index}
                    className="flex flex-col justify-between gap-2 rounded-[10px] border border-[#DED6C8] bg-[#FFFDF9] p-3.5 sm:flex-row sm:items-center"
                >
                    <div className="space-y-1.5">
                        <SkeletonBar className="h-4 w-44" />
                        <SkeletonBar className="h-3.5 w-32" />
                    </div>
                    <div className="flex items-center gap-3">
                        <SkeletonBar className="h-5 w-28" />
                        <SkeletonBar className="h-10 w-24 rounded-[8px]" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ReportBreakdownsSkeleton() {
    return (
        <div role="status" aria-live="polite" aria-busy="true" className="grid gap-5 lg:grid-cols-2">
            <span className="sr-only">Memuat rincian distribusi laporan...</span>
            {[0, 1].map((panel) => (
                <Card key={panel}>
                    <CardHeader>
                        <SkeletonBar className="h-5 w-48" />
                        <SkeletonBar className="h-4 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3">
                                    <SkeletonBar className="h-4 w-36" />
                                    <SkeletonBar className="h-4 w-24" />
                                </div>
                                <SkeletonBar className="h-2.5 w-full rounded-full" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export function ReportChartSkeleton() {
    return (
        <Card role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">Memuat grafik tren keuangan...</span>
            <CardHeader>
                <SkeletonBar className="h-5 w-52" />
                <SkeletonBar className="h-4 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex h-52 items-end gap-2 rounded-[10px] border border-[#DED6C8] bg-[#F7F3EC] p-4">
                    <SkeletonBar className="h-20 flex-1" />
                    <SkeletonBar className="h-32 flex-1" />
                    <SkeletonBar className="h-24 flex-1" />
                    <SkeletonBar className="h-40 flex-1" />
                    <SkeletonBar className="h-28 flex-1" />
                    <SkeletonBar className="h-36 flex-1" />
                </div>
                <SkeletonBar className="h-24 w-full rounded-[10px]" />
            </CardContent>
        </Card>
    );
}

export function DeferredSectionError({
    title = 'Bagian data gagal dimuat',
    message = 'Terjadi kendala saat mengambil data tambahan dari server.',
    reloading = false,
    onRetry,
}: {
    title?: string;
    message?: string;
    reloading?: boolean;
    onRetry: () => void;
}) {
    return (
        <div
            role="alert"
            className="flex flex-col gap-3 rounded-[10px] border border-[#E2B3AA] bg-[#FCECE9] p-4 text-[#8A2619] sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div>
                    <p className="text-[15px] font-bold">{title}</p>
                    <p className="mt-0.5 text-sm text-[#6E2318]">{message}</p>
                </div>
            </div>
            <Button
                type="button"
                variant="secondary"
                disabled={reloading}
                onClick={onRetry}
                className="shrink-0"
            >
                <RefreshCw className="size-4" aria-hidden="true" />
                <span>{reloading ? 'Memuat ulang...' : 'Muat Ulang Bagian Ini'}</span>
            </Button>
        </div>
    );
}

export function NavigationErrorBanner({
    error,
    onRetry,
    onDismiss,
}: {
    error: NavigationErrorInfo;
    onRetry: () => void;
    onDismiss: () => void;
}) {
    return (
        <section
            role="alert"
            aria-labelledby="nav-error-title"
            className="mb-6 rounded-[12px] border border-[#E2B3AA] bg-[#FCECE9] p-5 text-[#8A2619] shadow-[0_1px_2px_rgba(28,33,30,0.06)]"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <div>
                        <h2 id="nav-error-title" className="text-base font-bold text-[#8A2619]">
                            {error.title}
                            {error.status ? ` (${error.status})` : ''}
                        </h2>
                        <p className="mt-1 text-[15px] text-[#6E2318]">{error.message}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            onDismiss();
                            if (typeof window !== 'undefined' && window.history.length > 1) {
                                window.history.back();
                            }
                        }}
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        <span>Kembali</span>
                    </Button>
                    {error.isAuthError ? (
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => {
                                if (typeof window !== 'undefined') {
                                    window.location.assign('/login');
                                }
                            }}
                        >
                            <span>Masuk Ulang</span>
                        </Button>
                    ) : (
                        <Button type="button" variant="primary" onClick={onRetry}>
                            <RefreshCw className="size-4" aria-hidden="true" />
                            <span>Coba Lagi</span>
                        </Button>
                    )}
                </div>
            </div>
        </section>
    );
}
