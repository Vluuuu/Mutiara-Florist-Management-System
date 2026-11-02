@php
    $initialItems = old('items');

    if (! is_array($initialItems)) {
        $initialItems = $order
            ? $order->items->map(fn ($item) => [
                'id' => $item->id,
                'flower_type' => $item->flower_type,
                'recipient' => $item->recipient,
                'sender_name' => $item->sender_name,
                'delivery_date' => $item->delivery_date->format('Y-m-d'),
                'delivery_location' => $item->delivery_location,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'shipping_mode' => $item->shipping_mode,
                'shipping_fee' => $item->shipping_fee,
                'fulfillment_status' => $item->fulfillment_status,
                'notes' => $item->notes,
            ])->all()
            : [];
    }
@endphp

@if ($customers->isEmpty())
    <div class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        Belum ada pelanggan aktif. <a href="{{ route('customers.create') }}" class="font-semibold underline">Tambahkan pelanggan terlebih dahulu</a>.
    </div>
@else
<form method="POST" action="{{ $order ? route('orders.update', $order) : route('orders.store') }}" x-data="orderForm(@js($initialItems))" class="space-y-6">
    @csrf
    @if ($order)
        @method('PUT')
    @endif

    @if ($errors->any())
        <div role="alert" class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            <p class="font-semibold">Ada data yang perlu diperbaiki.</p>
            <ul class="mt-2 list-inside list-disc space-y-1">
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <section class="rounded-xl border border-stone-200 bg-white p-5 sm:p-7">
        <h2 class="text-base font-semibold text-emerald-950">Informasi pesanan</h2>
        <div class="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
                <label for="customer_id" class="mb-1.5 block text-sm font-medium text-stone-800">Pelanggan <span class="text-red-700">*</span></label>
                <select id="customer_id" name="customer_id" required class="w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm focus:border-emerald-800 focus:outline-none">
                    <option value="">Pilih pelanggan</option>
                    @foreach ($customers as $customer)
                        <option value="{{ $customer->id }}" @selected((string) old('customer_id', $order?->customer_id) === (string) $customer->id)>{{ $customer->name }}{{ $customer->phone ? ' · '.$customer->phone : '' }}</option>
                    @endforeach
                </select>
                <a href="{{ route('customers.create') }}" class="mt-2 inline-block text-xs font-medium text-emerald-800 hover:underline">+ Tambah pelanggan baru</a>
            </div>
            <div>
                <label for="order_date" class="mb-1.5 block text-sm font-medium text-stone-800">Tanggal pemesanan <span class="text-red-700">*</span></label>
                <input id="order_date" name="order_date" type="date" value="{{ old('order_date', $order?->order_date?->format('Y-m-d') ?? now()->toDateString()) }}" required class="w-full rounded-lg border border-stone-300 px-3 py-3 text-sm focus:border-emerald-800 focus:outline-none">
            </div>
        </div>
        <div class="mt-5">
            <label for="order_notes" class="mb-1.5 block text-sm font-medium text-stone-800">Catatan pesanan (opsional)</label>
            <textarea id="order_notes" name="notes" maxlength="2000" rows="2" class="w-full rounded-lg border border-stone-300 px-3 py-3 text-sm focus:border-emerald-800 focus:outline-none" placeholder="Informasi tambahan untuk seluruh pesanan">{{ old('notes', $order?->notes) }}</textarea>
        </div>
    </section>

    <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
            <h2 class="text-lg font-semibold text-emerald-950">Rincian bunga dan pengiriman</h2>
            <p class="mt-1 text-sm text-stone-500">Setiap baris bunga memiliki penerima, pengirim ucapan, jadwal, tujuan, dan ongkir sendiri.</p>
        </div>
        <button type="button" @click="addItem()" :disabled="items.length >= 20" class="rounded-lg border border-emerald-900 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">+ Tambah bunga</button>
    </div>

    <div class="space-y-5">
        <template x-for="(item, index) in items" :key="item._key">
            <section class="rounded-xl border border-stone-200 bg-white p-5 sm:p-7">
                <input type="hidden" :name="'items[' + index + '][id]'" :value="item.id" :disabled="!item.id">
                <div class="mb-5 flex items-center justify-between gap-4">
                    <h3 class="font-semibold text-stone-900">Bunga <span x-text="index + 1"></span></h3>
                    <button type="button" @click="removeItem(index)" :disabled="items.length === 1 || (item.id && item._initialStatus !== 'NEW')" class="text-sm font-medium text-red-700 hover:underline disabled:cursor-not-allowed disabled:text-stone-300" title="Item yang sudah diproses tidak bisa dihapus">Hapus baris</button>
                </div>

                <div class="grid gap-5 sm:grid-cols-2">
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-stone-800">Jenis bunga <span class="text-red-700">*</span></label>
                        <input type="text" :name="'items[' + index + '][flower_type]'" x-model="item.flower_type" maxlength="255" required placeholder="Contoh: Papan ucapan" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-stone-800">Tanggal kirim <span class="text-red-700">*</span></label>
                        <input type="date" :name="'items[' + index + '][delivery_date]'" x-model="item.delivery_date" required class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-stone-800">Untuk / penerima <span class="text-red-700">*</span></label>
                        <input type="text" :name="'items[' + index + '][recipient]'" x-model="item.recipient" maxlength="255" required class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-stone-800">Dari / pengirim ucapan <span class="text-red-700">*</span></label>
                        <input type="text" :name="'items[' + index + '][sender_name]'" x-model="item.sender_name" maxlength="255" required class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="mb-1.5 block text-sm font-medium text-stone-800">Lokasi pengiriman <span class="text-red-700">*</span></label>
                        <textarea :name="'items[' + index + '][delivery_location]'" x-model="item.delivery_location" maxlength="1000" rows="2" required class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none"></textarea>
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-stone-800">Kuantitas <span class="text-red-700">*</span></label>
                        <input type="number" :name="'items[' + index + '][quantity]'" x-model.number="item.quantity" min="1" max="10000" step="1" required class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-stone-800">Harga satuan (Rp) <span class="text-red-700">*</span></label>
                        <input type="number" :name="'items[' + index + '][unit_price]'" x-model.number="item.unit_price" min="0" max="1000000000" step="1" required class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-stone-800">Mode ongkir <span class="text-red-700">*</span></label>
                        <select :name="'items[' + index + '][shipping_mode]'" x-model="item.shipping_mode" @change="shippingChanged(item)" required class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                            <option value="INCLUDED">Sudah termasuk harga bunga</option>
                            <option value="SEPARATE">Ditagih terpisah</option>
                        </select>
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-stone-800">Tambahan ongkir (Rp)</label>
                        <input type="number" :name="'items[' + index + '][shipping_fee]'" x-model.number="item.shipping_fee" :readonly="item.shipping_mode === 'INCLUDED'" min="0" max="1000000000" step="1" required class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none read-only:bg-stone-100">
                        <p class="mt-1 text-xs text-stone-500">Ongkir sekali per item/pengiriman, bukan dikalikan kuantitas.</p>
                    </div>
                    @if ($order)
                        <div>
                            <label class="mb-1.5 block text-sm font-medium text-stone-800">Status pengerjaan</label>
                            <select :name="'items[' + index + '][fulfillment_status]'" x-model="item.fulfillment_status" class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                                <template x-for="step in allowedStatuses(item)" :key="step.value">
                                    <option :value="step.value" x-text="step.label"></option>
                                </template>
                            </select>
                            <p class="mt-1 text-xs text-stone-500">Status hanya bisa maju satu tahap setiap penyimpanan.</p>
                        </div>
                    @endif
                    <div>
                        <label class="mb-1.5 block text-sm font-medium text-stone-800">Catatan bunga (opsional)</label>
                        <textarea :name="'items[' + index + '][notes]'" x-model="item.notes" maxlength="2000" rows="2" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none"></textarea>
                    </div>
                </div>
                <div class="mt-5 rounded-lg bg-stone-50 px-4 py-3 text-right text-sm font-semibold text-emerald-950">
                    Subtotal item: <span x-text="money(asInt(item.quantity) * asInt(item.unit_price) + (item.shipping_mode === 'SEPARATE' ? asInt(item.shipping_fee) : 0))"></span>
                </div>
            </section>
        </template>
    </div>

    <section class="rounded-xl border border-stone-200 bg-white p-5 sm:p-7">
        <h2 class="text-base font-semibold text-emerald-950">Ringkasan tagihan</h2>
        <div class="mt-5 space-y-3 text-sm">
            <div class="flex justify-between gap-4"><span class="text-stone-600">Nilai bunga</span><strong x-text="money(productTotal())"></strong></div>
            <div class="flex justify-between gap-4"><span class="text-stone-600">Ongkir terpisah</span><strong x-text="money(shippingTotal())"></strong></div>
            <div class="flex justify-between gap-4 border-t border-stone-200 pt-4 text-lg font-semibold text-emerald-950"><span>Total pesanan</span><span x-text="money(productTotal() + shippingTotal())"></span></div>
        </div>
        <p class="mt-3 text-xs leading-5 text-stone-500">Pratinjau saja. Server memvalidasi dan menghitung ulang tagihan sebelum menyimpan. DP tidak wajib; pencatatan pembayaran tersedia pada fase berikutnya.</p>
    </section>

    <div class="flex flex-wrap items-center gap-3">
        <button type="submit" class="rounded-lg bg-emerald-950 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Simpan pesanan</button>
        <a href="{{ $order ? route('orders.show', $order) : route('orders.index') }}" class="rounded-lg border border-stone-200 px-6 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50">Batal</a>
    </div>
</form>
@endif
