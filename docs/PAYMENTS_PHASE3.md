# Phase 3.1 — Pembayaran & Piutang

**Status (2 November 2026):** Kode backend/UI, autentikasi, transaksi, dan 16 tes fitur baru sudah ditulis di GitHub. **Belum ada hasil eksekusi tes baru di laptop**. Baseline Phase 2.2: 34 PASS / 193 assertions.

## Cakupan implementasi
- Menu **Pembayaran & Piutang** di sidebar: `/payments`. Halaman ini berisi **hanya pesanan dengan sisa tagihan positif**, pencarian nomor/pelanggan, pagination, jumlah piutang terkini, dan tautan untuk membayar.
- Pada `/orders/{id}`: form pencatatan pembayaran. Isi nilai rupiah positif, tanggal uang benar-benar diterima, metode Tunai/Transfer/QRIS/Lainnya, referensi dan catatan opsional. Default jumlah = sisa tagihan; operator dapat menggantinya untuk DP atau cicilan. **DP tidak wajib**.
- Setelah order dibuat, operator bisa langsung mencatat pembayaran penuh atau sebagian. Order yang selesai dikirim tetapi belum lunas tetap dapat dibayar. **Pembuatan order dan pembayaran masih dua request/form berbeda**, belum atomik dalam satu submit (T-35).
- Pembayaran disimpan sebagai baris `payments` berstatus `POSTED`. **UNPAID** jika dibayar nol, **PARTIAL** bila 0 < dibayar < total, dan **PAID** jika sudah dibayar sebesar total.
- Saldo dihitung dari `orders.total_amount - SUM(payments.amount WHERE status = 'POSTED')`. Dashboard menggunakan pembayaran POSTED, bukan nilai pesanan, sebagai kas masuk.
- Satu `idempotency_key` UUID per form mencegah replay yang sama dihitung dua kali; request berulang identik mendapat event lama, tidak membuat event baru. UUID yang sama dengan data berbeda, order lain, atau event VOIDED ditolak.
- Pencatatan berlebih atau baru pada order sudah lunas ditolak; server mengunci baris order dalam transaksi sebelum memeriksa saldo, menggunakan pola lock yang sama dengan `OrderService::update`.
- Koreksi salah input: **VOID** dengan alasan wajib (minimal 10 karakter), waktu void, dan audit actor. Baris awal tidak dihapus; VOIDED tidak dihitung sebagai uang masuk/piutang. Koreksi **bukan refund**, tidak memindahkan uang dan tidak membuat status CANCELLED.
- Tidak ada penghapusan pembayaran melalui endpoint CRUD. Semua POST memakai CSRF dan auth; pemilihan pembayaran untuk void harus sesuai dengan order pada URL.
- Metode pembayaran awal dibatasi ke CASH, TRANSFER, QRIS, OTHER. Bila praktik usaha membutuhkan metode lain, revisi daftar ini secara eksplisit.

## Perintah menjalankan di Windows
Di PowerShell baru (server Laravel di terminal lain tetap berjalan):

```powershell
cd D:\xampp\htdocs\Mutiara-Florist-Management-System
git pull --ff-only origin main
npm run build
php artisan test
php artisan route:list --path=payments
php artisan route:list --path=orders
git status --short
```

**Tidak ada migrasi baru** karena tabel `payments` dan indeks UUID sudah dibuat dalam migrasi inti sebelumnya. Jangan gunakan `migrate:fresh` pada database yang telah memiliki akun/data.

## QA browser dengan data fiktif (jangan uang sungguhan)
1. Pastikan XAMPP MySQL (MariaDB port 3307) dan `php artisan serve` menyala. Login dan buka pesanan fiktif bernilai Rp800.000.
2. Klik area **Catat pembayaran** pada detail; ganti Rp800.000 menjadi **Rp200.000**, pilih tanggal dan metode lalu Simpan. Status seharusnya **Sebagian**, uang diterima Rp200.000 dan sisa **Rp600.000**. Piutang di `/payments` bertambah.
3. Catat Rp600.000 dengan form baru. Status jadi **Lunas**; pesanan hilang dari daftar Piutang (namun tetap di /orders); dashboard kas masuk bertambah Rp800.000.
4. Order fiktif lain bisa langsung dilunasi satu kali (tanpa DP). Coba juga order yang status pengerjaannya Selesai tetapi belum dibayar.
5. Pilih satu pembayaran lalu **Koreksi kesalahan pencatatan**, tulis alasan ≥10 karakter. Pastikan riwayat menunjukkan VOIDED, saldo kas masuk berkurang dan piutang naik kembali. Ini hanya uji pencatatan; bukan refund.
6. Pastikan percobaan nominal berlebih/saat lunas ditolak, dan refresh/submit ulang tidak membuat dua transaksi. Logout lalu kunjungi /payments; harus diarahkan login.
7. Verifikasi UI mobile/desktop, tampilan kesalahan validasi, dan laporan angka.

## Pengujian yang masih wajib sebelum data nyata
- `php artisan test` pada laptop: 16 skenario PaymentManagementTest baru, selain 34 tes baseline. **Jumlah 50 PASS hanya boleh diklaim jika benar-benar muncul.**
- **T-11 concurrency MariaDB**: dua request simultan pada saldo yang sama dari dua koneksi/proses sungguhan, disertai verifikasi row count, saldo dan audit. SQLite in-memory PHPUnit tidak cukup.
- Pengujian pengubahan total order saat transaksi pembayaran bersamaan, dan retry UUID lintas order. Bukti manual/integrasi perlu dikumpulkan.
- **T-35**: create order dan initial payment dalam satu submit atomik belum tersedia.
- Backup terenkripsi beserta uji restore ke database terpisah. Belum boleh memindahkan data pelanggan/transaksi nyata ke sistem.

## Tahap berikutnya
Pengembangan **Phase 3.2**: kategori dan pencatatan pengeluaran, void pengeluaran, audit; lalu integrasi dashboard/laporan, ekspor Excel, dan backup/restore.
