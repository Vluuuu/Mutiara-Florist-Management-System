import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    Edit2,
    FolderOpen,
    Info,
    Plus,
    Power,
    PowerOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField, Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { DataListSkeleton } from '@/components/ui/page-skeleton';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { useScopedFilterLoading } from '@/lib/navigation-state';
import { useInstantPageGuard } from '@/lib/use-instant-page-guard';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ExpenseCategoryItem } from '@/types';

type CategoryFilter = 'all' | 'active' | 'inactive';

type ExpenseCategoriesIndexProps = {
    categories?: ExpenseCategoryItem[];
};

export default function ExpenseCategoriesIndex({
    categories,
}: ExpenseCategoriesIndexProps) {
    const isLoading = useScopedFilterLoading('/ui-expense-categories');
    useInstantPageGuard(Boolean(categories));
    const categoryList = categories ?? [];
    const [statusFilter, setStatusFilter] = useState<CategoryFilter>('all');

    // Add category form
    const {
        data: createData,
        setData: setCreateData,
        post: postCreate,
        processing: createProcessing,
        errors: createErrors,
        reset: resetCreate,
        clearErrors: clearCreateErrors,
    } = useForm({
        name: '',
    });

    // Rename modal state
    const [renameTarget, setRenameTarget] = useState<ExpenseCategoryItem | null>(null);
    const {
        data: editData,
        setData: setEditData,
        put: putEdit,
        processing: editProcessing,
        errors: editErrors,
        clearErrors: clearEditErrors,
    } = useForm({
        name: '',
    });

    // Activate/Deactivate confirmation modal state (replaces window.confirm)
    const [toggleTarget, setToggleTarget] = useState<ExpenseCategoryItem | null>(null);
    const [toggleProcessing, setToggleProcessing] = useState(false);
    const [toggleError, setToggleError] = useState<string | null>(null);
    const toggleLockRef = useRef(false);

    const activeCount = useMemo(
        () => categoryList.filter((c) => Boolean(c.is_active)).length,
        [categoryList],
    );
    const inactiveCount = categoryList.length - activeCount;

    const filteredCategories = useMemo(() => {
        if (statusFilter === 'active') {
            return categoryList.filter((c) => Boolean(c.is_active));
        }
        if (statusFilter === 'inactive') {
            return categoryList.filter((c) => !c.is_active);
        }
        return categoryList;
    }, [categoryList, statusFilter]);

    const handleCreate = (e: FormEvent) => {
        e.preventDefault();
        if (createProcessing) return;
        postCreate('/ui-expense-categories', {
            preserveScroll: true,
            onSuccess: () => resetCreate(),
        });
    };

    const openRenameModal = (cat: ExpenseCategoryItem) => {
        clearEditErrors();
        setEditData('name', cat.name);
        setRenameTarget(cat);
    };

    const closeRenameModal = () => {
        if (editProcessing) return;
        setRenameTarget(null);
        clearEditErrors();
    };

    const handleSaveRename = (e: FormEvent) => {
        e.preventDefault();
        if (!renameTarget || editProcessing) return;
        putEdit(`/ui-expense-categories/${renameTarget.id}`, {
            preserveScroll: true,
            onSuccess: () => setRenameTarget(null),
        });
    };

    const openToggleModal = (cat: ExpenseCategoryItem) => {
        setToggleError(null);
        toggleLockRef.current = false;
        setToggleTarget(cat);
    };

    const closeToggleModal = () => {
        if (toggleProcessing) return;
        setToggleTarget(null);
        setToggleError(null);
        toggleLockRef.current = false;
    };

    const confirmToggleStatus = () => {
        if (!toggleTarget || toggleLockRef.current || toggleProcessing) return;

        toggleLockRef.current = true;
        setToggleProcessing(true);
        setToggleError(null);

        router.patch(
            `/ui-expense-categories/${toggleTarget.id}/status`,
            { is_active: toggleTarget.is_active ? 0 : 1 },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setToggleTarget(null);
                },
                onError: (err) => {
                    const msg =
                        (err as Record<string, string>)?.is_active ??
                        'Gagal mengubah status kategori. Silakan coba lagi.';
                    setToggleError(msg);
                },
                onFinish: () => {
                    toggleLockRef.current = false;
                    setToggleProcessing(false);
                },
            },
        );
    };

    const columns: DataColumn<ExpenseCategoryItem>[] = [
        {
            key: 'name',
            header: 'Nama Kategori',
            render: (cat) => (
                <div>
                    <p
                        className={cn(
                            'font-bold',
                            cat.is_active ? 'text-[#1C211E]' : 'text-[#545852]',
                        )}
                    >
                        {cat.name}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#545852] tabular-nums">
                        Dipakai pada {formatAmount(cat.expenses_count ?? 0)} transaksi
                    </p>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cellClassName: 'whitespace-nowrap',
            render: (cat) => (
                <Badge tone={cat.is_active ? 'paid' : 'neutral'}>
                    {cat.is_active ? 'Aktif' : 'Nonaktif'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: 'Aksi',
            align: 'right',
            cellClassName: 'whitespace-nowrap',
            render: (cat) => (
                <div className="inline-flex items-center justify-end gap-2.5">
                    <Button
                        type="button"
                        variant="secondary"
                        aria-label={`Ubah nama kategori ${cat.name}`}
                        onClick={() => openRenameModal(cat)}
                        className="min-w-[124px]"
                    >
                        <Edit2 className="size-4" aria-hidden="true" />
                        Ubah Nama
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        aria-label={
                            cat.is_active
                                ? `Nonaktifkan kategori ${cat.name}`
                                : `Aktifkan kembali kategori ${cat.name}`
                        }
                        className={cn(
                            'min-w-[132px]',
                            cat.is_active
                                ? 'border-[#E2B3AA] text-[#9A3B22] hover:bg-[#FCF0EC]'
                                : 'border-[#B8D0C0] text-[#1D3B2A] hover:bg-[#EEF5F0]',
                        )}
                        onClick={() => openToggleModal(cat)}
                    >
                        {cat.is_active ? (
                            <>
                                <PowerOff className="size-4" aria-hidden="true" />
                                Nonaktifkan
                            </>
                        ) : (
                            <>
                                <Power className="size-4" aria-hidden="true" />
                                Aktifkan
                            </>
                        )}
                    </Button>
                </div>
            ),
        },
    ];

    if (!categories) {
        return (
            <>
                <Head title="Kategori Biaya" />
                <DataListSkeleton title="Kategori Biaya" rows={5} showFilters={false} />
            </>
        );
    }

    return (
        <>
            <Head title="Kategori Biaya" />

            <div className="mb-7 border-b border-[#DED6C8] pb-5">
                <h1 className="atelier-h1">
                    Kategori Biaya
                </h1>
            </div>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,1fr)]">
                {/* Category List Card */}
                <Card className="overflow-hidden">
                    <div className="flex flex-col gap-3 border-b border-[#DED6C8] bg-[#EFE9DE]/55 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div>
                            <h2 className="atelier-h2">
                                Daftar Kategori ({formatAmount(categoryList.length)})
                            </h2>
                            <p className="mt-0.5 text-[13px] text-[#545852] tabular-nums">
                                {formatAmount(activeCount)} aktif · {formatAmount(inactiveCount)} nonaktif
                            </p>
                        </div>

                        <div
                            className="flex flex-wrap gap-2"
                            role="group"
                            aria-label="Filter status kategori biaya"
                        >
                            {(
                                [
                                    { key: 'all', label: `Semua (${categories.length})` },
                                    { key: 'active', label: `Aktif (${activeCount})` },
                                    { key: 'inactive', label: `Nonaktif (${inactiveCount})` },
                                ] as const
                            ).map((chip) => {
                                const selected = statusFilter === chip.key;
                                return (
                                    <button
                                        key={chip.key}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => setStatusFilter(chip.key)}
                                        className={cn(
                                            'inline-flex min-h-[44px] items-center rounded-[8px] border px-4 py-2 text-sm font-semibold transition-colors',
                                            selected
                                                ? 'border-[#1D3B2A] bg-[#1D3B2A] text-[#FFFDF9]'
                                                : 'border-[#7D776C] bg-[#FFFDF9] text-[#1C211E] hover:bg-[#EFE9DE]',
                                        )}
                                    >
                                        {chip.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {isLoading && (
                        <div
                            role="status"
                            aria-live="polite"
                            className="border-b border-[#DED6C8] bg-[#EFE9DE] px-5 py-2.5 text-sm font-semibold text-[#1D3B2A]"
                        >
                            Memperbarui daftar kategori...
                        </div>
                    )}

                    <div className="p-4 lg:p-0">
                        <ResponsiveDataList
                            items={filteredCategories}
                            columns={columns}
                            keyExtractor={(cat) => cat.id}
                            tableAriaLabel="Daftar kategori biaya"
                            emptyState={
                                <div className="px-6 py-12 text-center">
                                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE] text-[#1D3B2A]">
                                        <FolderOpen className="size-6" aria-hidden="true" />
                                    </div>
                                    <h3 className="atelier-h2">
                                        {statusFilter === 'all'
                                            ? 'Belum ada kategori pengeluaran'
                                            : 'Tidak ada kategori pada filter ini'}
                                    </h3>
                                    <p className="mx-auto mt-1.5 max-w-sm text-[15px] text-[#545852]">
                                        {statusFilter === 'all'
                                            ? 'Tambahkan kategori baru melalui formulir di samping.'
                                            : 'Pilih tab Semua untuk melihat seluruh kategori yang tersedia.'}
                                    </p>
                                    {statusFilter !== 'all' && (
                                        <div className="mt-4">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => setStatusFilter('all')}
                                                className="min-w-[180px]"
                                            >
                                                Tampilkan Semua Kategori
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            }
                            renderMobileCard={(cat) => (
                                <div className="atelier-sheet p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p
                                                className={cn(
                                                    'text-base font-bold',
                                                    cat.is_active ? 'text-[#1C211E]' : 'text-[#545852]',
                                                )}
                                            >
                                                {cat.name}
                                            </p>
                                            <p className="mt-0.5 text-[13px] text-[#545852] tabular-nums">
                                                Dipakai pada {formatAmount(cat.expenses_count ?? 0)} transaksi
                                            </p>
                                        </div>
                                        <Badge tone={cat.is_active ? 'paid' : 'neutral'}>
                                            {cat.is_active ? 'Aktif' : 'Nonaktif'}
                                        </Badge>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-[#DED6C8] pt-3">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            aria-label={`Ubah nama kategori ${cat.name}`}
                                            onClick={() => openRenameModal(cat)}
                                        >
                                            <Edit2 className="size-4" aria-hidden="true" />
                                            Ubah Nama
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            aria-label={
                                                cat.is_active
                                                    ? `Nonaktifkan kategori ${cat.name}`
                                                    : `Aktifkan kembali kategori ${cat.name}`
                                            }
                                            className={
                                                cat.is_active
                                                    ? 'border-[#E2B3AA] text-[#9A3B22] hover:bg-[#FCF0EC]'
                                                    : 'border-[#B8D0C0] text-[#1D3B2A] hover:bg-[#EEF5F0]'
                                            }
                                            onClick={() => openToggleModal(cat)}
                                        >
                                            {cat.is_active ? (
                                                <>
                                                    <PowerOff className="size-4" aria-hidden="true" />
                                                    Nonaktifkan
                                                </>
                                            ) : (
                                                <>
                                                    <Power className="size-4" aria-hidden="true" />
                                                    Aktifkan
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                </Card>

                {/* Add Category Panel */}
                <div className="space-y-4 lg:sticky lg:top-20">
                    <Card className="p-5 sm:p-6">
                        <h2 className="atelier-h2">
                            Tambah Kategori Baru
                        </h2>

                        <form onSubmit={handleCreate} noValidate className="mt-4 space-y-4">
                            <FormField
                                id="create_name"
                                label="Nama kategori"
                                required
                                hint="Minimal 2 karakter."
                                error={createErrors.name}
                            >
                                <Input
                                    id="create_name"
                                    type="text"
                                    required
                                    minLength={2}
                                    maxLength={100}
                                    placeholder="Misal: Pengiriman & Kurir"
                                    value={createData.name}
                                    onChange={(e) => {
                                        setCreateData('name', e.target.value);
                                        clearCreateErrors('name');
                                    }}
                                    invalid={Boolean(createErrors.name)}
                                    aria-describedby={
                                        createErrors.name ? 'create_name-error' : 'create_name-hint'
                                    }
                                />
                            </FormField>

                            <Button
                                type="submit"
                                variant="primary"
                                disabled={createProcessing || createData.name.trim().length < 2}
                                className="w-full"
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                {createProcessing ? 'Menambahkan...' : 'Tambah Kategori'}
                            </Button>
                        </form>
                    </Card>

                    <div className="flex items-start gap-2.5 rounded-[8px] border border-[#DED6C8] bg-[#EFE9DE] p-4 text-[13px] leading-relaxed text-[#1C211E]">
                        <Info className="mt-0.5 size-4 shrink-0 text-[#1D3B2A]" aria-hidden="true" />
                        <p>
                            Kategori yang sudah dipakai tidak dihapus permanen agar riwayat pembukuan tetap utuh.
                        </p>
                    </div>
                </div>
            </div>

            {/* Rename Modal */}
            <Modal
                open={Boolean(renameTarget)}
                onClose={closeRenameModal}
                isSubmitting={editProcessing}
                title="Ubah Nama Kategori"
                description={
                    renameTarget
                        ? `Memperbarui nama kategori "${renameTarget.name}" untuk tampilan laporan ke depan.`
                        : undefined
                }
            >
                <form onSubmit={handleSaveRename} noValidate className="space-y-4">
                    <FormField
                        id="rename-category-input"
                        label="Nama kategori baru"
                        required
                        error={editErrors.name}
                    >
                        <Input
                            id="rename-category-input"
                            data-modal-initial="true"
                            type="text"
                            required
                            minLength={2}
                            maxLength={100}
                            value={editData.name}
                            onChange={(e) => {
                                setEditData('name', e.target.value);
                                clearEditErrors('name');
                            }}
                            invalid={Boolean(editErrors.name)}
                            aria-describedby={
                                editErrors.name ? 'rename-category-input-error' : undefined
                            }
                        />
                    </FormField>

                    <div className="flex flex-col-reverse gap-2 border-t border-[#DED6C8] pt-4 sm:flex-row sm:justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={editProcessing}
                            onClick={closeRenameModal}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={editProcessing || editData.name.trim().length < 2}
                        >
                            {editProcessing ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Toggle Active/Inactive Modal Confirmation */}
            <Modal
                open={Boolean(toggleTarget)}
                onClose={closeToggleModal}
                isSubmitting={toggleProcessing}
                title={
                    toggleTarget?.is_active
                        ? 'Nonaktifkan Kategori Biaya'
                        : 'Aktifkan Kembali Kategori'
                }
                description={toggleTarget ? `Kategori: ${toggleTarget.name}` : undefined}
            >
                {toggleTarget && (
                    <div className="space-y-4">
                        {toggleError && (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-[6px] border border-[#E5B5AC] bg-[#FAE5E1] p-3 text-xs font-medium text-[#8A2619]"
                            >
                                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>{toggleError}</span>
                            </div>
                        )}

                        <p className="text-sm text-[#1C211E]">
                            {toggleTarget.is_active
                                ? `Kategori "${toggleTarget.name}" tidak akan muncul pada pilihan input pengeluaran baru. Seluruh ${formatAmount(toggleTarget.expenses_count ?? 0)} catatan transaksi lama tetap tersimpan rapi.`
                                : `Kategori "${toggleTarget.name}" akan muncul kembali sebagai pilihan aktif pada formulir pencatatan pengeluaran.`}
                        </p>

                        <div className="flex flex-col-reverse gap-2 border-t border-[#DED6C8] pt-4 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={toggleProcessing}
                                onClick={closeToggleModal}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                variant={toggleTarget.is_active ? 'urgent' : 'primary'}
                                disabled={toggleProcessing}
                                data-modal-initial="true"
                                onClick={confirmToggleStatus}
                            >
                                {toggleProcessing
                                    ? 'Memproses...'
                                    : toggleTarget.is_active
                                      ? 'Ya, Nonaktifkan'
                                      : 'Ya, Aktifkan'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
