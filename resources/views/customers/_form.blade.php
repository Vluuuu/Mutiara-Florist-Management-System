<form method="POST" action="{{ $customer ? route('customers.update', $customer) : route('customers.store') }}" class="space-y-6">
    @csrf
    @if ($customer)
        @method('PUT')
    @endif

    <div>
        <label for="name" class="mb-1.5 block text-sm font-medium text-stone-800">Nama pelanggan <span class="text-red-700">*</span></label>
        <input type="text" id="name" name="name" value="{{ old('name', $customer?->name) }}" maxlength="255" required autofocus autocomplete="name" class="w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10">
        @error('name') <p role="alert" class="mt-1.5 text-xs text-red-700">{{ $message }}</p> @enderror
    </div>

    <div>
        <label for="phone" class="mb-1.5 block text-sm font-medium text-stone-800">Nomor telepon <span class="font-normal text-stone-400">(opsional)</span></label>
        <input type="tel" id="phone" name="phone" value="{{ old('phone', $customer?->phone) }}" maxlength="50" autocomplete="tel" placeholder="Contoh: 081234567890" class="w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10">
        <p class="mt-1.5 text-xs text-stone-500">Nomor telepon tidak harus unik. Dua pelanggan boleh menggunakan nomor yang sama.</p>
        @error('phone') <p role="alert" class="mt-1.5 text-xs text-red-700">{{ $message }}</p> @enderror
    </div>

    <div>
        <label for="notes" class="mb-1.5 block text-sm font-medium text-stone-800">Catatan <span class="font-normal text-stone-400">(opsional)</span></label>
        <textarea id="notes" name="notes" maxlength="2000" rows="4" placeholder="Contoh: instruksi khusus pelanggan" class="w-full rounded-lg border border-stone-300 px-3.5 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10">{{ old('notes', $customer?->notes) }}</textarea>
        @error('notes') <p role="alert" class="mt-1.5 text-xs text-red-700">{{ $message }}</p> @enderror
    </div>

    <div class="flex flex-wrap items-center gap-3 border-t border-stone-200 pt-5">
        <button type="submit" class="rounded-lg bg-emerald-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">Simpan pelanggan</button>
        <a href="{{ $customer ? route('customers.show', $customer) : route('customers.index') }}" class="rounded-lg border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50">Batal</a>
    </div>
</form>
