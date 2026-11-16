import { useState, type FormEvent } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    Edit2,
    Plus,
    Power,
    ShieldAlert,
    Tags,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Card } from '@/components/ui/card';
import type { ExpenseCategoryItem } from '@/types';

type ExpenseCategoriesIndexProps = {
    categories: ExpenseCategoryItem[];
};

export default function ExpenseCategoriesIndex({
    categories,
}: ExpenseCategoriesIndexProps) {
    // Create form
    const {
        data: createData,
        setData: setCreateData,
        post: postCreate,
        processing: createProcessing,
        errors: createErrors,
        reset: resetCreate,
    } = useForm({
        name: '',
    });

    const handleCreateSubmit = (e: FormEvent) => {
        e.preventDefault();
        postCreate('/ui-expense-categories', {
            onSuccess: () => resetCreate(),
        });
    };

    // Category renaming state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editError, setEditError] = useState<string | null>(null);
    const [renaming, setRenaming] = useState(false);

    const startEditing = (category: ExpenseCategoryItem) => {
        setEditingId(category.id);
        setEditName(category.name);
        setEditError(null);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
        setEditError(null);
    };

    const handleRenameSubmit = (e: FormEvent, categoryId: number) => {
        e.preventDefault();
        if (editName.trim().length < 2) {
            setEditError('Nama kategori minimal 2 karakter.');
            return;
        }

        setRenaming(true);
        router.put(
            `/ui-expense-categories/${categoryId}`,
            { name: editName.trim() },
            {
                onSuccess: () => {
                    setEditingId(null);
                    setRenaming(false);
                },
                onError: (errors) => {
                    setRenaming(false);
                    if (errors.name) {
                        setEditError(errors.name);
                    }
                },
            },
        );
    };

    const handleToggleStatus = (category: ExpenseCategoryItem) => {
        if (
            category.is_active &&
            !confirm(
                'Nonaktifkan kategori ini? Pengeluaran yang sudah dicatat sebelumnya tetap aman dan tersimpan.',
            )
        ) {
            return;
        }

        router.patch(`/ui-expense-categories/${category.id}/status`, {
            is_active: !category.is_active,
        });
    };

    return (
        <AppLayout title="Kategori Pengeluaran">
            <Head title="Kategori Pengeluaran" />

            <div className="mb-6">
                <Link
                    href="/ui-expenses"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:text-emerald-950"
                >
                    <ArrowLeft className="size-4" />
                    Kembali ke pengeluaran
                </Link>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">
                    Kategori pengeluaran
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                    Kategori tidak dihapus permanen. Kategori yang sudah tidak dipakai bisa dinonaktifkan tanpa mengubah riwayat biaya.
                </p>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
                {/* Categories List */}
                <Card className="overflow-hidden">
                    <div className="border-b border-stone-100 bg-stone-50/50 px-5 py-4">
                        <div className="flex items-center gap-2">
                            <Tags className="size-4 text-emerald-800" />
                            <h2 className="font-semibold text-emerald-950">Daftar kategori</h2>
                        </div>
                    </div>

                    {categories.length === 0 ? (
                        <div className="p-8 text-center text-sm text-stone-500">
                            Belum ada kategori pengeluaran. Tambahkan kategori pertama melalui form di sebelah kanan.
                        </div>
                    ) : (
                        <div className="divide-y divide-stone-100">
                            {categories.map((category) => {
                                const isEditing = editingId === category.id;
                                return (
                                    <div key={category.id} className="p-5 hover:bg-stone-50/50">
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-xs font-medium text-stone-500">
                                                {category.expenses_count ?? 0} pengeluaran tercatat
                                            </span>
                                            <span
                                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                    category.is_active
                                                        ? 'bg-emerald-50 text-emerald-900'
                                                        : 'bg-stone-100 text-stone-500'
                                                }`}
                                            >
                                                {category.is_active ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </div>

                                        {isEditing ? (
                                            <form
                                                onSubmit={(e) => handleRenameSubmit(e, category.id)}
                                                className="space-y-2"
                                            >
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        min={2}
                                                        maxLength={100}
                                                        required
                                                        className="flex-1 rounded-lg border border-stone-300 p-2 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={renaming}
                                                        className="rounded-lg bg-emerald-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                                                    >
                                                        {renaming ? 'Menyimpan...' : 'Simpan'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEditing}
                                                        className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100"
                                                    >
                                                        Batal
                                                    </button>
                                                </div>
                                                {editError && (
                                                    <p className="text-xs text-red-600">{editError}</p>
                                                )}
                                            </form>
                                        ) : (
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-stone-900">
                                                        {category.name}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEditing(category)}
                                                        className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                                                        title="Ubah nama"
                                                    >
                                                        <Edit2 className="size-3.5" />
                                                    </button>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStatus(category)}
                                                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                                        category.is_active
                                                            ? 'text-red-700 hover:underline'
                                                            : 'text-emerald-800 hover:underline'
                                                    }`}
                                                >
                                                    <Power className="size-3" />
                                                    {category.is_active
                                                        ? 'Nonaktifkan'
                                                        : 'Aktifkan'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>

                {/* Create Form */}
                <Card className="p-6">
                    <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
                        <Plus className="size-4 text-emerald-800" />
                        <h2 className="font-semibold text-emerald-950">Tambah kategori baru</h2>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-stone-500">
                        Contoh: Bahan Bunga Segar, Pengiriman/Kurir, Sewa Tempat, Operasional Toko, atau Perlengkapan Dekorasi.
                    </p>

                    <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
                        <div>
                            <label
                                htmlFor="new_category_name"
                                className="mb-1.5 block text-xs font-semibold text-stone-800"
                            >
                                Nama kategori <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="new_category_name"
                                type="text"
                                required
                                minLength={2}
                                maxLength={100}
                                placeholder="Contoh: Pengiriman / Kurir"
                                value={createData.name}
                                onChange={(e) => setCreateData('name', e.target.value)}
                                className="w-full rounded-lg border border-stone-300 p-2.5 text-sm focus:border-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                            />
                            {createErrors.name && (
                                <p className="mt-1 text-xs text-red-600">{createErrors.name}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={createProcessing}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-900 disabled:opacity-50"
                        >
                            <Plus className="size-4" />
                            {createProcessing ? 'Menambahkan...' : 'Tambah kategori'}
                        </button>
                    </form>
                </Card>
            </div>
        </AppLayout>
    );
}
