<div id="pembayaran" class="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
    <section class="rounded-xl border border-stone-200 bg-white p-5 sm:p-7">
        <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-emerald-950">Catat pembayaran</h2>
            <span class="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">{{ $outstanding > 0 ? 'Tagihan terbuka' : 'Lunas' }}</span>
        </div>
        @if ($outstanding > 0)
            <p class="mt-2 text-sm text-stone-500">Masukkan nominal DP atau pelunasan yang benar-benar sudah diterima. Maksimal sisa Rp{{ number_format($outstanding, 0, ',', '.') }}.</p>
            @if ($errors->any())
                <div role="alert" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <p class="font-semibold">Pembayaran belum disimpan:</p>
                    <ul class="mt-2 list-inside list-disc">
                        @foreach ($errors->all() as $error) <li>{{ $error }}</li> @endforeach
                    </ul>
                </div>
            @endif
            <form method="POST" action="{{ route('orders.payments.store', $order) }}" class="mt-5 space-y-4">
                @csrf
                <input type="hidden" name="idempotency_key" value="{{ old('idempotency_key', $newPaymentKey) }}">
                <div>
                    <label for="amount" class="mb-1.5 block text-sm font-medium text-stone-800">Jumlah diterima (Rp) *</label>
                    <input id="amount" name="amount" type="number" min="1" max="1000000000000000" step="1" required value="{{ old('amount', $outstanding) }}" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                    @error('amount') <p class="mt-1 text-xs text-red-700">{{ $message }}</p> @enderror
                    <p class="mt-1 text-xs text-stone-500">Nilai ini sudah terisi untuk pelunasan. Ganti jika hanya menerima DP atau cicilan.</p>
                </div>
                <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label for="payment_date" class="mb-1.5 block text-sm font-medium text-stone-800">Tanggal uang diterima *</label>
                        <input id="payment_date" name="payment_date" type="date" required value="{{ old('payment_date', now()->toDateString()) }}" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                    </div>
                    <div>
                        <label for="method" class="mb-1.5 block text-sm font-medium text-stone-800">Metode pembayaran *</label>
                        <select id="method" name="method" required class="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                            @foreach (['CASH' => 'Tunai', 'TRANSFER' => 'Transfer bank', 'QRIS' => 'QRIS', 'OTHER' => 'Lainnya'] as $value => $label)
                                <option value="{{ $value }}" @selected(old('method') === $value)>{{ $label }}</option>
                            @endforeach
                        </select>
                    </div>
                </div>
                <div>
                    <label for="reference" class="mb-1.5 block text-sm font-medium text-stone-800">Referensi transaksi (opsional)</label>
                    <input id="reference" name="reference" type="text" maxlength="255" value="{{ old('reference') }}" placeholder="Contoh: nomor bukti transfer" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">
                </div>
                <div>
                    <label for="payment_notes" class="mb-1.5 block text-sm font-medium text-stone-800">Catatan (opsional)</label>
                    <textarea id="payment_notes" name="notes" rows="2" maxlength="2000" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-emerald-800 focus:outline-none">{{ old('notes') }}</textarea>
                </div>
                <button type="submit" class="rounded-lg bg-emerald-950 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Simpan pembayaran</button>
                <p class="text-xs text-stone-500">Pastikan uang benar-benar diterima sebelum menekan Simpan. Koreksi selanjutnya wajib menggunakan void dengan alasan.</p>
            </form>
        @else
            <p class="mt-3 text-sm text-stone-600">Tidak ada tagihan tersisa. Riwayat pembayaran tetap tersedia di sebelahnya.</p>
        @endif
    </section>

    <section class="rounded-xl border border-stone-200 bg-white p-5 sm:p-7">
        <h2 class="text-lg font-semibold text-emerald-950">Riwayat pembayaran</h2>
        <p class="mt-2 text-xs text-stone-500">POSTED dihitung sebagai uang masuk. VOIDED hanya menandai kesalahan pencatatan, bukan refund.</p>
        @if ($order->payments->isEmpty())
            <p class="mt-6 rounded-lg bg-stone-50 px-4 py-5 text-sm text-stone-500">Belum ada pembayaran. Pesanan boleh dikerjakan dan diselesaikan meskipun belum lunas.</p>
        @else
            <div class="mt-5 divide-y divide-stone-200">
                @foreach ($order->payments as $payment)
                    <div class="py-5 first:pt-0">
                        <div class="flex flex-wrap justify-between gap-3">
                            <div>
                                <p class="text-base font-semibold text-stone-900">Rp{{ number_format($payment->amount, 0, ',', '.') }}</p>
                                <p class="mt-1 text-xs text-stone-500">{{ $payment->payment_date->format('d/m/Y') }} · {{ ['CASH' => 'Tunai', 'TRANSFER' => 'Transfer bank', 'QRIS' => 'QRIS', 'OTHER' => 'Lainnya'][$payment->method] ?? $payment->method }}</p>
                            </div>
                            <span class="h-fit rounded-full px-3 py-1 text-xs font-semibold {{ $payment->status === 'POSTED' ? 'bg-emerald-50 text-emerald-900' : 'bg-stone-100 text-stone-600' }}">{{ $payment->status === 'POSTED' ? 'Tercatat' : 'VOIDED' }}</span>
                        </div>
                        @if ($payment->reference)
                            <p class="mt-2 break-all text-xs text-stone-500">Referensi: {{ $payment->reference }}</p>
                        @endif
                        @if ($payment->notes)
                            <p class="mt-2 whitespace-pre-wrap break-words text-xs text-stone-600">{{ $payment->notes }}</p>
                        @endif
                        <p class="mt-2 text-xs text-stone-400">Dicatat oleh {{ $payment->recordedBy?->name ?? 'Operator' }}</p>
                        @if ($payment->status === 'VOIDED')
                            <div class="mt-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
                                <p class="font-semibold">Koreksi: {{ $payment->void_reason }}</p>
                                <p class="mt-1">{{ $payment->voided_at?->timezone('Asia/Jakarta')->format('d/m/Y H:i') }} WIB</p>
                            </div>
                        @else
                            <details class="mt-3 rounded-lg border border-red-100 p-3">
                                <summary class="cursor-pointer text-xs font-medium text-red-700">Koreksi kesalahan pencatatan</summary>
                                <p class="mt-3 text-xs text-stone-500">Gunakan hanya jika nominal/metode/entri salah dicatat. Tidak mengembalikan uang kepada pelanggan.</p>
                                <form method="POST" action="{{ route('orders.payments.void', [$order, $payment]) }}" class="mt-3 space-y-3">
                                    @csrf
                                    <label for="void_reason_{{ $payment->id }}" class="block text-xs font-semibold text-stone-700">Alasan koreksi (minimal 10 karakter)</label>
                                    <textarea id="void_reason_{{ $payment->id }}" name="void_reason" required minlength="10" maxlength="1000" rows="2" class="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none" placeholder="Contoh: nominal salah input, akan dicatat ulang"></textarea>
                                    <button type="submit" onclick="return confirm('Void pencatatan ini? Ini bukan refund. Riwayat akan tetap tersimpan.')" class="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Void pencatatan</button>
                                </form>
                            </details>
                        @endif
                    </div>
                @endforeach
            </div>
        @endif
    </section>
</div>
