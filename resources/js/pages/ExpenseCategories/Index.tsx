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
import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField, Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ResponsiveDataList, type DataColumn } from '@/components/ui/responsive-data-list';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ExpenseCategoryItem } from '@/types';

type CategoryFilter = 'all' | 'active' | 'inactive';

type ExpenseCategoriesIndexProps = {
    categories: ExpenseCategoryItem[];
};

export default function ExpenseCategoriesIndex({
    categories,
}: ExpenseCategoriesIndexProps) {
    const [statusFilter, setStatusFilter] = useState<CategoryFilter>('all');
    const [isLoading, setIsLoading] = useState(false);

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

    useEffect(() => {
        const stopStart = router.on('start', () => setIsLoading(true));
        const stopFinish = router.on('finish', () => setIsLoading(false));
        return () => {
            stopStart();
            stopFinish();
        };
    }, []);

    const activeCount = useMemo(
        () => categories.filter((c) => Boolean(c.is_active)).length,
        [categories],
    );
    const inactiveCount = categories.length - activeCount;

    const filteredCategories = useMemo(() => {
        if (statusFilter === 'active') {
            return categories.filter((c) => Boolean(c.is_active));
        }
        if (statusFilter === 'inactive') {
            return categories.filter((c) => !c.is_active);
        }
        return categories;
    }, [categories, statusFilter]);

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
                            cat.is_active ? 'text-[#1E2420]' : 'text-[#525B54]',
                        )}
                    >
                        {cat.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[#525B54] tabular-nums">
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
                <div className="inline-flex items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-label={`Ubah nama kategori ${cat.name}`}
                        onClick={() => openRenameModal(cat)}
                    >
                        <Edit2 className="size-4" aria-hidden="true" />
                        Ubah Nama
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={
                            cat.is_active
                                ? `Nonaktifkan kategori ${cat.name}`
                                : `Aktifkan kembali kategori ${cat.name}`
                        }
                        className={
                            cat.is_active
                                ? 'border-[#8C3B4A]/40 text-[#8C3B4A] hover:bg-[#FDF2F4]'
                                : 'border-[#143326]/40 text-[#143326] hover:bg-[#E6EFEA]'
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
            ),
        },
    ];

    return (
        <AppLayout title="Kategori Biaya">
            <Head title="Kategori Biaya" />

            <div className="mb-5">
                <h1 className="font-[var(--font-display)] text-[clamp(20px,2.2vw,25px)] font-semibold leading-tight tracking-[-0.015em] text-[#1E2420]">
                    Kategori Biaya
                </h1>
                <p className="mt-1 text-sm text-[#525B54]">
                    Kelompokkan pengeluaran operasional agar laporan keuangan mudah dibaca. Kategori yang sudah dipakai tidak dihapus agar riwayat tetap utuh.
                </p>
            </div>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,1fr)]">
                {/* Category List Card */}
                <Card className="overflow-hidden border-[#E3DED4]">
                    <div className="flex flex-col gap-3 border-b border-[#E3DED4] bg-[#FAF8F4]/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                        <div>
                            <h2 className="text-base font-bold text-[#1E2420]">
                                Daftar Kategori ({formatAmount(categories.length)})
                            </h2>
                            <p className="mt-0.5 text-xs text-[#525B54] tabular-nums">
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
                                            'inline-flex min-h-[44px] items-center rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors',
                                            selected
                                                ? 'border-[#143326] bg-[#143326] text-white'
                                                : 'border-[#858E87] bg-white text-[#1E2420] hover:bg-[#F1EDE6]',
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
                            className="border-b border-[#E3DED4] bg-[#F1EDE6] px-4 py-2 text-xs font-semibold text-[#143326]"
                        >
                            Memperbarui daftar kategori...
                        </div>
                    )}

                    <div className="p-4 sm:p-0">
                        <ResponsiveDataList
                            items={filteredCategories}
                            columns={columns}
                            keyExtractor={(cat) => cat.id}
                            tableAriaLabel="Daftar kategori biaya"
                            emptyState={
                                <div className="px-6 py-12 text-center">
                                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[#F1EDE6] text-[#143326]">
                                        <FolderOpen className="size-6" aria-hidden="true" />
                                    </div>
                                    <h3 className="text-base font-bold text-[#1E2420]">
                                        {statusFilter === 'all'
                                            ? 'Belum ada kategori pengeluaran'
                                            : 'Tidak ada kategori pada filter ini'}
                                    </h3>
                                    <p className="mx-auto mt-1 max-w-sm text-sm text-[#525B54]">
                                        {statusFilter === 'all'
                                            ? 'Tambahkan kategori baru melalui panel di samping agar pencatatan pengeluaran lebih rapi.'
                                            : 'Pilih tab Semua untuk melihat seluruh kategori yang tersedia.'}
                                    </p>
                                    {statusFilter !== 'all' && (
                                        <div className="mt-4">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => setStatusFilter('all')}
                                            >
                                                Tampilkan Semua Kategori
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            }
                            renderMobileCard={(cat) => (
                                <div className="rounded-[10px] border border-[#E3DED4] bg-white p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p
                                                className={cn(
                                                    'text-base font-bold',
                                                    cat.is_active ? 'text-[#1E2420]' : 'text-[#525B54]',
                                                )}
                                            >
                                                {cat.name}
                                            </p>
                                            <p className="mt-0.5 text-xs text-[#525B54] tabular-nums">
                                                Dipakai pada {formatAmount(cat.expenses_count ?? 0)} transaksi
                                            </p>
                                        </div>
                                        <Badge tone={cat.is_active ? 'paid' : 'neutral'}>
                                            {cat.is_active ? 'Aktif' : 'Nonaktif'}
                                        </Badge>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#E3DED4] pt-3">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            aria-label={`Ubah nama kategori ${cat.name}`}
                                            onClick={() => openRenameModal(cat)}
                                        >
                                            <Edit2 className="size-4" aria-hidden="true" />
                                            Ubah Nama
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            aria-label={
                                                cat.is_active
                                                    ? `Nonaktifkan kategori ${cat.name}`
                                                    : `Aktifkan kembali kategori ${cat.name}`
                                            }
                                            className={
                                                cat.is_active
                                                    ? 'border-[#8C3B4A]/40 text-[#8C3B4A] hover:bg-[#FDF2F4]'
                                                    : 'border-[#143326]/40 text-[#143326] hover:bg-[#E6EFEA]'
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
                <div className="space-y-4 lg:sticky lg:top-6">
                    <Card className="border-[#E3DED4] p-4 sm:p-5">
                        <h2 className="text-base font-bold text-[#1E2420]">
                            Tambah Kategori Baru
                        </h2>
                        <p className="mt-1 text-xs text-[#525B54]">
                            Kategori baru langsung aktif dan dapat dipilih saat mencatat pengeluaran.
                        </p>

                        <form onSubmit={handleCreate} noValidate className="mt-4 space-y-4">
                            <FormField
                                id="create_name"
                                label="Nama kategori"
                                required
                                hint="Minimal 2 karakter, maksimal 100 karakter."
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

                    <div className="flex items-start gap-2.5 rounded-[10px] border border-[#E3DED4] bg-[#F1EDE6] p-4 text-xs text-[#1E2420]">
                        <Info className="mt-0.5 size-4 shrink-0 text-[#143326]" aria-hidden="true" />
                        <p>
                            Untuk menjaga integritas riwayat pembukuan, kategori tidak dihapus permanen. Nonaktifkan kategori lama agar tidak muncul di daftar pilihan transaksi baru.
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

                    <div className="flex flex-col-reverse gap-2 border-t border-[#E3DED4] pt-4 sm:flex-row sm:justify-end">
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
                                className="flex items-start gap-2 rounded-md border border-[#991B1B]/40 bg-[#FEE2E2] p-3 text-xs font-medium text-[#991B1B]"
                            >
                                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>{toggleError}</span>
                            </div>
                        )}

                        <p className="text-sm text-[#1E2420]">
                            {toggleTarget.is_active
                                ? `Kategori "${toggleTarget.name}" tidak akan muncul pada pilihan input pengeluaran baru. Seluruh ${formatAmount(toggleTarget.expenses_count ?? 0)} catatan transaksi lama tetap tersimpan rapi.`
                                : `Kategori "${toggleTarget.name}" akan muncul kembali sebagai pilihan aktif pada formulir pencatatan pengeluaran.`}
                        </p>

                        <div className="flex flex-col-reverse gap-2 border-t border-[#E3DED4] pt-4 sm:flex-row sm:justify-end">
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
        </AppLayout>
    );
}
