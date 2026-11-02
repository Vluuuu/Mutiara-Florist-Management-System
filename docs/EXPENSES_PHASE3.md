# Phase 3.2 — Pengeluaran Usaha

**Status (2 November 2026):** Kode sudah ditambahkan ke GitHub. 15 tes fitur baru dan satu migrasi database **belum dijalankan di laptop**. Baseline Phase 3.1: 50 PASS / 324 assertions.

## Fitur
- Menu **Pengeluaran**: `/expenses` — riwayat kas keluar, pencarian keterangan, filter kategori/status/tanggal, pagination, dan total POSTED untuk hasil filter.
- Menu **Kategori Biaya**: `/expense-categories` — buat kategori unik, ubah nama, nonaktifkan/aktifkan kembali. Tidak ada hard delete; biaya lama tetap terkait dengan kategori.
- Form `/expenses/create`: kategori aktif, tanggal dibayar, nominal positif Rupiah, keterangan wajib, UUID tersembunyi untuk pencegahan submit ganda.
- Koreksi salah input dengan **VOIDED** dan alasan minimal 10 karakter, waktu koreksi dan audit. Baris pengeluaran tetap ada. Void bukan refund uang nyata.
- Dashboard hanya menjumlah pengeluaran POSTED. Biaya aktual kurir terpisah dari ongkir yang ditagih pelanggan.

## Migration tambahan
`2026_11_02_000003_add_idempotency_key_to_expenses.php` menambahkan `expenses.idempotency_key` UUID unik nullable. Data lama tetap valid (NULL); input baru wajib UUID. **Jangan jalankan `migrate:fresh`** pada database yang memiliki akun admin/pesanan.

## Perintah PowerShell (terminal baru)
```powershell
cd D:\xampp\htdocs\Mutiara-Florist-Management-System
git pull --ff-only origin main
php artisan migrate
npm run build
php artisan test
php artisan route:list --path=expenses
php artisan route:list --path=expense-categories
git status --short
```

Pastikan XAMPP MariaDB port 3307 berjalan, dan `php artisan serve` tetap aktif di terminal terpisah. PHPUnit memakai database SQLite in-memory; data MariaDB lokal tidak di-reset oleh pengujian.

## QA browser — data contoh saja
1. Buka `http://127.0.0.1:8000/expense-categories`, buat kategori fiktif **Pengiriman Kurir**.
2. Buka `/expenses/create`, catat biaya kurir fiktif **Rp55.000**, tanggal 2 November 2026. Pastikan halaman `/expenses` dan Dashboard menampilkan kas keluar Rp55.000, tanpa mengubah penjualan atau penerimaan.
3. Cek pencarian/filter. Nonaktifkan kategori, pastikan riwayat tetap ada dan kategori itu tak dapat dipakai untuk input baru; aktifkan kembali bila perlu.
4. Void pengeluaran dengan alasan panjang minimal 10 karakter. Baris tetap ada, tetapi tidak lagi dihitung sebagai kas keluar. Jangan gunakan void untuk refund.
5. Uji validasi nominal negatif, akses setelah logout, dan tampilan desktop/mobile.

## Exit gate
- Jika 15 tes baru lulus bersama 50 sebelumnya, target **65 PASS**, tetapi **belum dikonfirmasi**.
- Migrasi + pengujian MariaDB dan QA browser perlu dibuktikan.
- Tes concurrency pembayaran pada MariaDB serta backup/restore belum selesai. Jangan masukkan data usaha asli terlebih dahulu.
