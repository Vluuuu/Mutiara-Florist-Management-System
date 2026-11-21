import { useEffect, useState, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, Plus, Search, Users, X } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataListSkeleton } from '@/components/ui/page-skeleton';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatAmount } from '@/lib/format';
import type { AppPageProps, CustomerItem, PaginatedData } from '@/types';

type CustomersIndexProps = {
    customers?: PaginatedData<CustomerItem>;
    filters?: {
        q?: string;
    };
};

export default function CustomersIndex({ customers, filters = {} }: CustomersIndexProps) {
    const { errors } = usePage<AppPageProps>().props;
    useInstantPageGuard(Boolean(customers));
    const [search, setSearch] = useState(filters.q ?? '');
    const [isLoading, setIsLoading] = useState(false);
    const isSearching = (filters.q ?? '').trim() !== '';

    useEffect(() => {
        setSearch(filters.q ?? '');
    }, [filters.q]);

    useEffect(() => {
        const stopStart = router.on('start', (e) => {
            if (!e.detail.visit.prefetch) setIsLoading(true);
        });
        const stopFinish = router.on('finish', (e) => {
            if (!e.detail.visit.prefetch) setIsLoading(false);
        });
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
                        component="Customers/Show"
                        prefetch="hover"
                        cacheFor="10s"
                        cacheTags={['customers']}
                        className="inline-flex min-h-[44px] items-center font-bold text-[#1D3B2A] hover:underline"
                    >
                        {customer.name}
                    </Link>
                    {customer.notes && (
                        <p className="mt-0.5 break-words text-[13px] text-[#545852]">
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
                <span className="font-[var(--font-mono)] text-sm text-[#1C211E] tabular-nums">
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
                <span className="font-semibold text-[#1C211E] tabular-nums">
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
                <div className="inline-flex items-center justify-end gap-2.5">
                    <Button asChild variant="secondary" className="min-w-[100px]">
                        <Link
                            href={`/ui-orders/create?customer_id=${customer.id}`}
                            component="Orders/Create"
                            prefetch="hover"
                            cacheFor="10s"
                            cacheTags={['customers', 'orders']}
                        >
                            + Pesan
                        </Link>
                    </Button>
                    <Button asChild variant="secondary" className="min-w-[100px]">
                        <Link
                            href={`/ui-customers/${customer.id}`}
                            component="Customers/Show"
                            prefetch="hover"
                            cacheFor="10s"
                            cacheTags={['customers']}
                        >
                            Detail
                        </Link>
                    </Button>
                </div>
            ),
        },
    ];

    const searchError = errors?.q;

    if (!customers) {
        return (
            <>
                <Head title="Pelanggan" />
                <DataListSkeleton title="Daftar Pelanggan" rows={6} showFilters />
            </>
        );
    }

    return (
        <>
            <Head title="Pelanggan" />

            <div className="mb-7 flex flex-col gap-3 border-b border-[#DED6C8] pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="atelier-h1">
                        Daftar Pelanggan
                    </h1>
                </div>
                <div>
                    <Button asChild variant="primary" className="min-w-[180px]">
                        <Link
                            href="/ui-customers/create"
                            component="Customers/Create"
                            prefetch="hover"
                            cacheFor="10s"
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            Tambah Pelanggan
                        </Link>
                    </Button>
                </div>
            </div>

            {searchError && (
                <div
                    role="alert"
                    className="mb-5 flex items-start gap-2.5 rounded-[8px] border border-[#E2B3AA] bg-[#FCECE9] p-4 text-sm font-medium text-[#8A2619]"
                >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{searchError}</span>
                </div>
            )}

            <Card className="overflow-hidden">
                <form
                    onSubmit={handleSearch}
                    role="search"
                    className="border-b border-[#DED6C8] bg-[#EFE9DE]/55 p-5 sm:p-6"
                >
                    <label
                        htmlFor="q"
                        className="mb-2 block text-sm font-semibold text-[#1C211E]"
                    >
                        Cari Pelanggan
                    </label>
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search
                                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#545852]"
                                aria-hidden="true"
                            />
                            <Input
                                id="q"
                                name="q"
                                type="search"
                                maxLength={100}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Ketik nama atau nomor HP..."
                                className={search ? 'h-11 pl-10 pr-12' : 'h-11 pl-10'}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    aria-label="Hapus kata kunci pencarian"
                                    className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-[8px] text-[#545852] hover:bg-[#EFE9DE] hover:text-[#1C211E]"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2.5">
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={isLoading}
                                className="h-11 min-w-[116px] flex-1 sm:flex-none"
                            >
                                {isLoading ? 'Mencari...' : 'Cari'}
                            </Button>
                            {isSearching && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleReset}
                                    className="h-11 min-w-[116px] flex-1 sm:flex-none"
                                >
                                    Reset
                                </Button>
                            )}
                        </div>
                    </div>
                </form>

                {isLoading && (
                    <div
                        aria-busy="true"
                        className="border-b border-[#DED6C8] bg-[#EFE9DE]/70 px-5 py-2.5 text-sm font-semibold text-[#1D3B2A]"
                    >
                        Memuat daftar pelanggan terbaru...
                    </div>
                )}

                <div className="p-4 lg:p-0">
                    <ResponsiveDataList
                        items={customers.data}
                        columns={columns}
                        keyExtractor={(customer) => customer.id}
                        tableAriaLabel="Daftar pelanggan Mutiara Florist"
                        renderMobileCard={(customer) => (
                            <article className="atelier-sheet flex flex-col gap-3 p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <Link
                                            href={`/ui-customers/${customer.id}`}
                                            component="Customers/Show"
                                            prefetch="hover"
                                            cacheFor="10s"
                                            cacheTags={['customers']}
                                            className="inline-flex min-h-[44px] items-center text-base font-bold text-[#1D3B2A] hover:underline"
                                        >
                                            {customer.name}
                                        </Link>
                                        <p className="mt-0.5 font-[var(--font-mono)] text-sm text-[#545852] tabular-nums">
                                            {customer.phone || 'Nomor telepon belum diisi'}
                                        </p>
                                    </div>
                                    <span className="shrink-0 pt-2 text-[13px] font-bold text-[#545852] tabular-nums">
                                        {formatAmount(customer.orders_count)} pesanan
                                    </span>
                                </div>

                                {customer.notes && (
                                    <p className="break-words text-sm text-[#545852]">
                                        {customer.notes}
                                    </p>
                                )}

                                <div className="grid grid-cols-2 gap-2.5 pt-1">
                                    <Button asChild variant="secondary">
                                        <Link
                                            href={`/ui-customers/${customer.id}`}
                                            component="Customers/Show"
                                            prefetch="hover"
                                            cacheFor="10s"
                                            cacheTags={['customers']}
                                        >
                                            Detail
                                        </Link>
                                    </Button>
                                    <Button asChild variant="primary">
                                        <Link
                                            href={`/ui-orders/create?customer_id=${customer.id}`}
                                            component="Orders/Create"
                                            prefetch="hover"
                                            cacheFor="10s"
                                            cacheTags={['customers', 'orders']}
                                        >
                                            + Pesan
                                        </Link>
                                    </Button>
                                </div>
                            </article>
                        )}
                        emptyState={
                            <div className="px-6 py-14 text-center">
                                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE] text-[#545852]">
                                    {isSearching ? (
                                        <Search className="size-6" aria-hidden="true" />
                                    ) : (
                                        <Users className="size-6" aria-hidden="true" />
                                    )}
                                </div>
                                <h2 className="atelier-h2">
                                    {isSearching ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}
                                </h2>
                                <p className="mt-1.5 text-[15px] text-[#545852]">
                                    {isSearching
                                        ? 'Coba kata kunci lain atau reset filter pencarian.'
                                        : 'Tambahkan pelanggan pertama untuk mulai mencatat pesanan.'}
                                </p>
                                <div className="mt-5">
                                    {isSearching ? (
                                        <Button type="button" variant="secondary" onClick={handleReset} className="min-w-[144px]">
                                            Reset Filter
                                        </Button>
                                    ) : (
                                        <Button asChild variant="primary" className="min-w-[180px]">
                                            <Link
                                                href="/ui-customers/create"
                                                component="Customers/Create"
                                                prefetch="hover"
                                                cacheFor="10s"
                                            >
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

                {customers.total > 0 && (
                    <div className="border-t border-[#DED6C8] bg-[#EFE9DE]/45 px-5 py-4">
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
        </>
    );
}
