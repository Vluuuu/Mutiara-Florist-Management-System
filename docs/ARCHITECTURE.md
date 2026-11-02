# Arsitektur Sistem
**Status:** Baseline arsitektur v0.5 (DP opsional, pembatalan/refund ditunda), belum diimplementasikan.

## 1. Pilihan arsitektur
**Laravel monolith dengan pola MVC**, Blade untuk server-rendered UI, Tailwind CSS + Alpine.js untuk komponen, MySQL lokal sebagai sumber data utama. Tidak ada layanan Next.js terpisah dan tidak membutuhkan API publik pada tahap awal.

```text
Operator (laptop) -> Browser (localhost)
                     |
                     v
          Laravel (routing + middleware)
                     |
           Form Request + Controller
                     |
               Domain Service
                     |
              Eloquent Models
                     |
                 MySQL lokal
                     |
              Backup konsisten
                     +-- arsip lokal terenkripsi
                     +-- salinan Google Drive (saat online)
```

Lampiran (jika digunakan) disimpan di Laravel storage dengan akses terkontrol, bukan GitHub. Backup harus mencakup database **dan** lampiran yang relevan.

## 2. Tanggung jawab lapisan
- **Routes / Middleware:** pemetaan URL, autentikasi/sesi, otorisasi dasar.
- **Controllers:** permintaan HTTP dan pemilihan response/Blade view; tidak menaruh kalkulasi uang di view.
- **Form Requests:** validasi format, batas nilai, dan kewajiban input.
- **Services:** create/update order, hitung tagihan, posting/void koreksi pembayaran, laporan dan backup; tidak ada service pembatalan/refund pada MVP.
- **Eloquent Models:** relasi dan persistence MySQL.
- **Blade UI:** tabel, form, status, dashboard, dan chart; angka bersumber dari backend.

## 3. Modul
1. Identity: akun admin dan sesi lokal.
2. Customers: profil dan pencarian pelanggan.
3. Orders: header pesanan; tanggal/lokasi pengiriman, penerima, pengirim ucapan, harga dan **ongkir INCLUDED/SEPARATE per item**; status order diringkas dari item; status bayar tetap independen.
4. Payments: **nol payment saat order dibuat diperbolehkan**; lunas awal, bayar akhir, DP opsional. Catatan penerimaan POSTED/VOIDED, idempotency key, kalkulasi status bayar/piutang; tidak menangani refund di MVP.
5. Expenses: pengeluaran dan kategori.
6. Reports: penjualan menurut order_date, penerimaan menurut payment_date, pengeluaran menurut expense_date, piutang snapshot saat ini, ekspor Excel.
7. Backup: dump terverifikasi, enkripsi, restore aman.
8. Audit: append-only log untuk tindakan keuangan penting, tanpa rahasia atau PII berlebihan.

## 4. Operasi yang harus atomik
- Saat menyimpan pesanan: validasi tanggal, tujuan, mode ongkir dan biaya per item; hitung total tagihan dari nilai bunga + ongkir tambahan; simpan header dan item dalam satu transaksi database. Saat item berubah status, ringkasan status order disinkronkan secara konsisten; jangan menganggap seluruh order selesai bila baru sebagian item DELIVERED.
- Saat mencatat pembayaran: lock baris order di MySQL transaction, hitung outstanding **termasuk ongkir tambahan**, validasi amount, simpan POSTED payment, gunakan idempotency key unik untuk aksi. Dua request paralel tidak boleh mencatat uang melebihi tagihan.
- **Pembatalan/refund tidak menjadi fitur MVP**, baik pesanan belum dibayar maupun berbayar. Tidak ada tombol/route CANCELLED atau hard delete untuk mengakali pembatalan. Void payment hanya koreksi pencatatan yang salah dengan audit, bukan bukti uang dikembalikan.

## 5. Struktur kode usulan
```text
app/
  Http/Controllers/
  Http/Requests/
  Models/
  Services/
resources/
  views/layouts/
  views/dashboard/
  views/orders/
  views/customers/
  views/payments/
  views/expenses/
  views/reports/
routes/web.php
database/migrations/
database/seeders/
tests/Feature/
docs/
```
Struktur persisnya akan ditetapkan saat scaffold Laravel dibuat. Service adalah pemisahan domain praktis, bukan keharusan membuat abstraksi berlapis berlebihan.

## 6. Konfigurasi dan pengoperasian
- Server PHP/Laravel, MySQL, dan browser berjalan di laptop yang sama.
- Database menyimpan catatan bisnis; GitHub hanya menyimpan kode/dokumen nonrahasia.
- Kredensial ditempatkan pada `.env` lokal dan tidak di-commit.
- Jika server/laptop tidak berjalan, aplikasi tidak bisa diakses.
- Backup Drive memerlukan internet; transaksi lokal tetap tersedia ketika offline dari internet.
- Scheduler tidak dapat berjalan selama laptop mati; jika otomatisasi dipakai, gunakan task scheduler sistem dan verifikasi hasil backup.

## 7. Keamanan dan verifikasi
CSRF bawaan Laravel, validasi input di server, session cookie aman, akses dokumen transaksi terproteksi, parameter query yang aman (Eloquent), dan logging tanpa data sensitif. Backup dienkripsi sebelum disalin ke Drive; kunci enkripsi disimpan terpisah. Restore harus diuji pada database terpisah sebelum diperlukan di lingkungan utama.

## 8. Referensi internal
- [PRD](PRD.md)
- [Rancangan database](DATABASE.md)
- [Aturan bisnis](BUSINESS_RULES.md)
- [Use cases & workflows](WORKFLOWS.md)
- [Test plan](TEST_PLAN.md)
- [Decision log](DECISIONS.md)
- [Pricing & shipping](PRICING_AND_SHIPPING.md)
