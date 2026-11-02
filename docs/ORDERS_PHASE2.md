# Phase 2.2 — Pesanan Bunga Multi-Item

**Status (2 November 2026):** Modul pesanan telah diperbarui dan diuji pada laptop operator: Vite build berhasil, **34 tests PASS / 193 assertions**, 6 route `orders` terdaftar, serta operator mengonfirmasi uji web berhasil. QA rinci di bawah tetap merupakan checklist, bukan semua skenario telah dibuktikan manual.

## Fitur
- Masuk sebagai admin; sidebar **Pesanan** dan rute `/orders` kini aktif.
- Buat pesanan berdasarkan **pelanggan aktif**, tanggal order, catatan opsional.
- Hingga **20 bunga/pengiriman** dalam satu order; tiap item memiliki jenis bunga, untuk/penerima, dari/pengirim ucapan, tanggal kirim, alamat tujuan, kuantitas, harga satuan, mode dan nominal ongkir, serta catatan.
- Nomor pesanan otomatis berbasis ULID; tidak dapat dipalsukan lewat form.
- Ongkir **INCLUDED** = Rp0 tambahan; **SEPARATE** = nominal lebih besar dari Rp0, dihitung hanya sekali per item/pengiriman. Total order dihitung ulang dari item oleh server dengan integer Rupiah, tanpa diskon/pajak.
- Daftar dapat difilter berdasarkan nomor/pelanggan dan status; detail memperlihatkan tagihan, penerimaan POSTED, dan sisa.
- Status item `NEW` → `PROCESSING` → `READY` → `DELIVERED` dan ringkasan status order. Hanya boleh tetap atau maju satu tahap setiap edit; order baru berstatus NEW. Jika semua DELIVERED maka order COMPLETED, **terlepas dari apakah sudah dibayar**.
- Edit menggunakan transaksi database. Item yang telah mulai diproses tidak dapat dihapus. Total baru tidak boleh di bawah pembayaran POSTED; jika mengubah komponen harga setelah pembayaran, **alasan perubahan wajib diisi**. Setiap edit diberi audit ringkas tanpa menyalin identitas penerima/alamat ke audit.
- **Tidak ada endpoint penghapusan/pembatalan pesanan**, refund, diskon/pajak, atau input DP pada fase ini; modul pembayaran menyusul di Phase 3.

## Perintah pada laptop Windows

Gunakan PowerShell baru, sementara `php artisan serve` berjalan di terminal lain:

```powershell
cd D:\xampp\htdocs\Mutiara-Florist-Management-System
git pull --ff-only origin main
npm run build
php artisan route:list --path=orders
php artisan test
git status --short
```

Tidak ada migrasi baru pada Phase 2.2. Untuk berjaga-jaga, `php artisan migrate:status` boleh dijalankan. **Jangan gunakan `php artisan migrate:fresh`** pada database dengan akun admin/data lama. PHPUnit memakai SQLite memory; data MariaDB operasional tidak dihapus oleh tes.

## QA browser (data fiktif)
1. Pastikan XAMPP MySQL berjalan di port **3307** dan `php artisan serve` menampilkan `127.0.0.1:8000`.
2. Login, tambahkan pelanggan **fiktif** melalui `/customers` jika belum tersedia.
3. Buka `http://127.0.0.1:8000/orders`, klik **Buat pesanan**.
4. Item 1: Papan Ucapan, qty 1, harga 800000, ongkir INCLUDED Rp0, kirim 5 Nov ke Lokasi A.
5. Item 2: Buket, qty 2, harga 250000, ongkir SEPARATE Rp75000, kirim 7 Nov ke Lokasi B; isi penerima dan pengirim berbeda.
6. Pastikan pratinjau total = **Rp1.375.000**. Simpan. Di detail, pastikan dua pengiriman terpisah, tagihan Rp1.375.000, dan uang diterima Rp0.
7. Edit pesanan: perbarui harga satuan buket menjadi Rp300.000; total baru seharusnya **Rp1.475.000**. Cek nomor order dan item tetap konsisten.
8. Uji filter daftar, edit status bunga bertahap, refresh dan kembali ke detail. Status keseluruhan harus COMPLETED **hanya** setelah semua item DELIVERED.
9. Logout, akses `/orders` secara langsung; harus kembali ke login.

Hasil `php artisan test` terbaru telah dikonfirmasi **34 PASS / 193 assertions**. Jika ada bug pada QA browser berikutnya, simpan output error tanpa password dan jangan gunakan pelanggan nyata dulu.

## Batasan dan langkah berikutnya
- Pembayaran/DP **sudah tersedia di detail order melalui Phase 3.1** (kode belum diuji di laptop). Pesanan baru tidak otomatis dianggap lunas. Operator bisa mencatat pembayaran setelah order disimpan. Status pembayaran dihitung dari data POSTED.
- Kuitansi, pembatalan/refund, ekspor, dan backup belum tersedia.
- Gunakan data simulasi sampai QA, backup, dan restore dipastikan berhasil. Pengembangan berikutnya adalah modul **Pembayaran dan Piutang**.
