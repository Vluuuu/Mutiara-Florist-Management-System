import { useEffect, useState, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, Plus, Search, Users, X } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { formatAmount } from '@/lib/format';
import type { AppPageProps, CustomerItem, PaginatedData } from '@/types';

type CustomersIndexProps = {
    customers: PaginatedData<CustomerItem>;
    filters: {
        q?: string;
    };
};

export default function CustomersIndex({ customers, filters }: CustomersIndexProps) {
    const { errors } = usePage<AppPageProps>().props;
    const [search, setSearch] = useState(filters.q ?? '');
    const [isLoading, setIsLoading] = useState(false);
    const isSearching = (filters.q ?? '').trim() !== '';

    useEffect(() => {
        setSearch(filters.q ?? '');
    }, [filters.q]);

    useEffect(() => {
        const stopStart = router.on('start', () => setIsLoading(true));
        const stopFinish = router.on('finish', () => setIsLoading(false));
        return () => {
            stopStart();
            stopFinish();
        };
    }, []);

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        router.get(
            '/ui-customers',
            search.trim() ? { q: search.trim() } : {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const handleReset = () => {
        setSearch('');
        router.get(
            '/ui-customers',
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const columns: DataColumn<CustomerItem>[] = [
        {
            key: 'name',
            header: 'Nama Pelanggan',
            render: (customer) => (
                <div>
                    <Link
                        href={`/ui-customers/${customer.id}`}
                        className="inline-flex min-h-[44px] items-center font-bold text-[#143326] hover:underline"
                    >
                        {customer.name}
                    </Link>
                    {customer.notes && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[#525B54]">
                            {customer.notes}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'phone',
            header: 'No. Telepon / WA',
            cellClassName: 'whitespace-nowrap',
            render: (customer) => (
                <span className="font-[var(--font-mono)] text-[13px] text-[#1E2420] tabular-nums">
                    {customer.phone || '-'}
                </span>
            ),
        },
        {
            key: 'orders_count',
            header: 'Total Pesanan',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            render: (customer) => (
                <span className="font-semibold text-[#1E2420] tabular-nums">
                    {formatAmount(customer.orders_count)} pesanan
                </span>
            ),
        },
        {
            key: 'actions',
            header: 'Aksi',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            render: (customer) => (
                <div className="inline-flex items-center justify-end gap-2">
                    <Button asChild variant="secondary" size="sm">
                        <Link href={`/ui-orders/create?customer_id=${customer.id}`}>+ Pesan</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                        <Link href={`/ui-customers/${customer.id}`}>Detail</Link>
                    </Button>
                </div>
            ),
        },
    ];

    const searchError = errors?.q;

    return (
        <AppLayout title="Pelanggan">
            <Head title="Pelanggan" />

            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                        Direktori Pelanggan
                    </h1>
                    <p className="mt-1 text-sm text-[#525B54]">
                        Cari nama atau nomor telepon pemesan, lihat riwayat nota, atau buat pesanan baru.
                    </p>
                </div>
                <div>
                    <Button asChild variant="primary">
                        <Link href="/ui-customers/create">
                            <Plus className="size-4" aria-hidden="true" />
                            Tambah Pelanggan
                        </Link>
                    </Button>
                </div>
            </div>

            {searchError && (
                <div
                    role="alert"
                    className="mb-4 flex items-start gap-2.5 rounded-md border border-[#991B1B]/40 bg-[#FEE2E2] p-3.5 text-sm font-medium text-[#991B1B]"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{searchError}</span>
                </div>
            )}

            <Card className="overflow-hidden border-[#E3DED4]">
                <form
                    onSubmit={handleSearch}
                    role="search"
                    className="flex flex-col gap-3 border-b border-[#E3DED4] bg-[#FAF8F4]/60 p-4 sm:flex-row sm:items-end"
                >
                    <div className="w-full sm:max-w-md">
                        <label
                            htmlFor="q"
                            className="mb-1.5 block text-sm font-semibold text-[#1E2420]"
                        >
                            Cari nama atau nomor telepon
                        </label>
                        <div className="relative flex items-center">
                            <Input
                                id="q"
                                name="q"
                                type="search"
                                maxLength={100}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Contoh: Ibu Ratna atau 0812..."
                                className={search ? 'pr-12' : undefined}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    aria-label="Hapus kata kunci pencarian"
                                    className="absolute right-0 inline-flex size-11 items-center justify-center rounded text-[#525B54] hover:bg-[#F1EDE6] hover:text-[#1E2420]"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" variant="primary" disabled={isLoading}>
                            <Search className="size-4" aria-hidden="true" />
                            {isLoading ? 'Mencari...' : 'Cari'}
                        </Button>
                        {isSearching && (
                            <Button type="button" variant="secondary" onClick={handleReset}>
                                Reset Filter
                            </Button>
                        )}
                    </div>
                </form>

                {isLoading && (
                    <div
                        aria-busy="true"
                        className="border-b border-[#E3DED4] bg-[#F1EDE6]/60 px-4 py-2 text-xs font-semibold text-[#525B54]"
                    >
                        Memuat daftar pelanggan terbaru...
                    </div>
                )}

                <div className="p-3 lg:p-0">
                    <ResponsiveDataList
                        items={customers.data}
                        columns={columns}
                        keyExtractor={(customer) => customer.id}
                        tableAriaLabel="Daftar pelanggan Mutiara Florist"
                        renderMobileCard={(customer) => (
                            <article className="flex flex-col gap-3 rounded-lg border border-[#E3DED4] bg-white p-3.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <Link
                                            href={`/ui-customers/${customer.id}`}
                                            className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-[#143326] hover:underline"
                                        >
                                            {customer.name}
                                        </Link>
                                        <p className="mt-0.5 font-[var(--font-mono)] text-[13px] text-[#525B54] tabular-nums">
                                            {customer.phone || 'Nomor telepon belum diisi'}
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-[#F1EDE6] px-2.5 py-1 text-xs font-bold text-[#1E2420] tabular-nums">
                                        {formatAmount(customer.orders_count)} pesanan
                                    </span>
                                </div>

                                {customer.notes && (
                                    <p className="line-clamp-2 text-[13px] text-[#525B54]">
                                        {customer.notes}
                                    </p>
                                )}

                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <Button asChild variant="secondary" size="default">
                                        <Link href={`/ui-customers/${customer.id}`}>Detail</Link>
                                    </Button>
                                    <Button asChild variant="primary" size="default">
                                        <Link href={`/ui-orders/create?customer_id=${customer.id}`}>
                                            + Pesan
                                        </Link>
                                    </Button>
                                </div>
                            </article>
                        )}
                        emptyState={
                            <div className="px-6 py-14 text-center">
                                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[#F1EDE6] text-[#525B54]">
                                    {isSearching ? (
                                        <Search className="size-6" aria-hidden="true" />
                                    ) : (
                                        <Users className="size-6" aria-hidden="true" />
                                    )}
                                </div>
                                <h2 className="text-base font-bold text-[#1E2420]">
                                    {isSearching ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}
                                </h2>
                                <p className="mt-1.5 text-sm text-[#525B54]">
                                    {isSearching
                                        ? 'Coba kata kunci lain atau reset filter pencarian.'
                                        : 'Tambahkan pelanggan pertama untuk mulai mencatat pesanan.'}
                                </p>
                                <div className="mt-5">
                                    {isSearching ? (
                                        <Button type="button" variant="secondary" onClick={handleReset}>
                                            Reset Filter
                                        </Button>
                                    ) : (
                                        <Button asChild variant="primary">
                                            <Link href="/ui-customers/create">
                                                <Plus className="size-4" aria-hidden="true" />
                                                Tambah Pelanggan
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        }
                    />
                </div>

                {customers.last_page > 1 && (
                    <div className="border-t border-[#E3DED4] bg-[#FAF8F4]/50 px-4 py-3.5">
                        <Pagination
                            links={customers.links}
                            from={customers.from}
                            to={customers.to}
                            total={customers.total}
                            itemLabel="pelanggan"
                        />
                    </div>
                )}
            </Card>
        </AppLayout>
    );
}
