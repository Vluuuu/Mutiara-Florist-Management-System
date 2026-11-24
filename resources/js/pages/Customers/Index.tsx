import { useEffect, useState, type FormEvent } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Plus, Search, Users, X } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { DataListSkeleton } from '@/components/ui/page-skeleton';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { useScopedFilterLoading } from '@/lib/navigation-state';
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
    const isLoading = useScopedFilterLoading('/ui-customers');
    useInstantPageGuard(Boolean(customers));
    const [search, setSearch] = useState(filters.q ?? '');
    const isSearching = (filters.q ?? '').trim() !== '';

    useEffect(() => {
        setSearch(filters.q ?? '');
    }, [filters.q]);

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        router.get(
            '/ui-customers',
            search.trim() ? { q: search.trim() } : {},
            {
                only: ['customers', 'filters'],
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
                only: ['customers', 'filters'],
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
                        className="inline-flex min-h-[44px] items-center font-bold text-[var(--brand-primary)] hover:underline"
                    >
                        {customer.name}
                    </Link>
                    {customer.notes && (
                        <p className="mt-0.5 break-words text-[13px] text-[var(--text-secondary)]">
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
                <span className="font-[var(--font-mono)] text-sm text-[var(--text-primary)] tabular-nums">
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
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
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
                    <Button asChild variant="subtle" size="sm" className="min-w-[92px]">
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
                    <Button asChild variant="subtle" size="sm" className="min-w-[84px]">
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

            <PageHeader
                title="Daftar Pelanggan"
                actions={
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
                }
            />

            {searchError && (
                <AlertBanner tone="error" className="mb-5">
                    {searchError}
                </AlertBanner>
            )}

            <Card className="overflow-hidden">
                <form
                    onSubmit={handleSearch}
                    role="search"
                    className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/55 p-5 sm:p-6"
                >
                    <label
                        htmlFor="q"
                        className="mb-2 block text-sm font-semibold text-[var(--text-primary)]"
                    >
                        Cari Pelanggan
                    </label>
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search
                                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-secondary)]"
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
                                    className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-[8px] text-[var(--text-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--text-primary)]"
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
                        className="border-b border-[var(--border-hairline)] bg-[var(--bg-sunken)]/70 px-5 py-2.5 text-sm font-semibold text-[var(--brand-primary)]"
                    >
                        Memuat daftar pelanggan terbaru...
                    </div>
                )}

                <div className="p-4 lg:p-0">
                    <ResponsiveDataList
                        items={customers.data}
                        columns={columns}
                        keyExtractor={(customer) => customer.id}
                        tabletColumns={2}
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
                                            className="inline-flex min-h-[44px] items-center text-base font-bold text-[var(--brand-primary)] hover:underline"
                                        >
                                            {customer.name}
                                        </Link>
                                        <p className="mt-0.5 font-[var(--font-mono)] text-sm text-[var(--text-secondary)] tabular-nums">
                                            {customer.phone || 'Nomor telepon belum diisi'}
                                        </p>
                                    </div>
                                    <span className="shrink-0 pt-2 text-[13px] font-bold text-[var(--text-secondary)] tabular-nums">
                                        {formatAmount(customer.orders_count)} pesanan
                                    </span>
                                </div>

                                {customer.notes && (
                                    <p className="break-words text-sm text-[var(--text-secondary)]">
                                        {customer.notes}
                                    </p>
                                )}

                                <div className="mt-auto grid grid-cols-2 gap-2.5 pt-1">
                                    <Button asChild variant="subtle">
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
                            <EmptyState
                                icon={isSearching ? Search : Users}
                                title={
                                    isSearching
                                        ? 'Pelanggan tidak ditemukan'
                                        : 'Belum ada pelanggan'
                                }
                                description={
                                    isSearching
                                        ? 'Coba kata kunci lain atau reset filter pencarian.'
                                        : 'Tambahkan pelanggan pertama untuk mulai mencatat pesanan.'
                                }
                                action={
                                    isSearching ? (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={handleReset}
                                            className="min-w-[144px]"
                                        >
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
                                    )
                                }
                            />
                        }
                    />
                </div>

                {customers.total > 0 && (
                    <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-sunken)]/45 px-5 py-4">
                        <Pagination
                            links={customers.links}
                            from={customers.from}
                            to={customers.to}
                            total={customers.total}
                            itemLabel="pelanggan"
                            only={['customers', 'filters']}
                        />
                    </div>
                )}
            </Card>
        </>
    );
}
