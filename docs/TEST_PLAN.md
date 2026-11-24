# Rencana Pengujian & Matriks Penerimaan MFMS

**Versi Dokumen:** Phase 13 (`release/phase13-ui-bi`, baseline rilis `0b436a9`)  
**Status Verifikasi Rilis (Bukti Phase 13E):** **236 automated tests PASS** (0 fail, 0 error) terverifikasi lintas tiga mesin database (**SQLite `:memory:`**, **PostgreSQL 17**, dan **MariaDB 10.11**), dilengkapi `npm run typecheck` (0 error), `npm run build` PASS, dan verifikasi visual lintas viewport. Detail lengkap tersedia di [PHASE13E_FULL_REGRESSION_AND_RELEASE_READINESS_REPORT.md](phase13/PHASE13E_FULL_REGRESSION_AND_RELEASE_READINESS_REPORT.md).

## 1. Pendekatan Pengujian

1. **Automated Unit & Feature Tests (PHPUnit):** Mencakup autentikasi, proteksi tamu, CRUD pelanggan, pesanan multi-item, perhitungan server-side, status linier item, pembayaran & piutang, konkurensi baris `lockForUpdate`, idempotensi UUID, pengeluaran & kategori biaya, laporan keuangan & ekspor Excel, middleware `VerifyCloudflareAccessJwt`, `DatabaseTargetGuard`, serta backup/restore terenkripsi AES-256-GCM.
2. **Isolasi Database Pengujian:** File `phpunit.xml` secara default memaksa `DB_CONNECTION=sqlite` dan `DB_DATABASE=:memory:` sehingga perintah `php artisan test` aman dijalankan tanpa menyentuh database lokal atau produksi pada `.env`.
3. **Verifikasi Frontend & Visual:** `npm run typecheck` (`tsc --noEmit`), `npm run build` (Vite 8), dan inspeksi visual browser pada resolusi desktop (`1440px`), laptop (`1024px`/`1366px`), tablet (`768px`), dan mobile (`390px`) menggunakan data sintetis.

## 2. Perintah Eksekusi Pengujian

```bash
# 1. Jalankan seluruh suite pengujian terisolasi (SQLite in-memory)
php artisan test

# 2. Verifikasi tipe TypeScript
npm run typecheck

# 3. Verifikasi build aset produksi Vite
npm run build
```

Catatan: Pengujian paritas lintas mesin (PostgreSQL 17 pada koneksi `pgsql_testing` dan MariaDB 10.11 pada koneksi `mariadb_testing`) dijalankan menggunakan container/instance database uji terisolasi sebagaimana didokumentasikan pada laporan Phase 13E.

## 3. Matriks Skenario Penerimaan (T-01 sampai T-38)

| ID | Modul | Skenario | Ekspektasi |
| --- | --- | --- | --- |
| T-01 | Authentication | Pengunjung belum login membuka halaman internal | Dialihkan ke `/login` |
| T-02 | Customers | Tambah, cari, dan edit pelanggan | Data tersimpan dan tampil kembali |
| T-03 | Orders | Order berisi 2 item dengan 1 pelanggan | 1 order + 2 item + total benar |
| T-04 | Orders | Satu item tidak valid | Rollback penuh, tidak ada data parsial |
| T-05 | Orders | Ubah harga ketika sudah DP melebihi total baru | Ditolak atomik tanpa mutasi data |
| T-06 | Payments | Order Rp800.000, DP Rp200.000 | `PARTIAL`, sisa Rp600.000 |
| T-07 | Payments | Pelunasan Rp600.000 | `PAID`, sisa Rp0 |
| T-08 | Payments | Pembayaran Rp10.000 setelah lunas | Ditolak |
| T-09 | Payments | Submit dua kali dengan idempotency key sama | Satu pembayaran tercatat |
| T-10 | Payments | Submit dua pembayaran valid dengan key berbeda | Keduanya tercatat bila saldo cukup |
| T-11 | Payments | Dua request paralel pada saldo Rp100.000 masing-masing Rp100.000 | Paling banyak satu diterima (verified `lockForUpdate`) |
| T-12 | Scope | Cari aksi pembatalan pada order belum dibayar | Tidak ada tombol/endpoint cancel |
| T-13 | Scope | Cari aksi pembatalan/refund pada order berbayar | Tidak ada tombol/endpoint cancel atau refund |
| T-14 | Audit | Void payment/expense salah input | Alasan minimal 10 karakter, waktu, dan aktor tercatat di `audit_logs` |
| T-15 | Expenses | Catat pengeluaran Rp100.000 | Kas keluar bertambah, nilai penjualan tetap |
| T-16 | Reports | Order tanggal A dibayar tanggal B | Masuk penjualan tanggal A, penerimaan tanggal B |
| T-17 | Reports | Filter periode laporan | Piutang diberi label snapshot berjalan saat ini |
| T-18 | Reports | Ekspor Excel `.xlsx` | Nilai numerik sesuai tampilan, bebas formula injection |
| T-19 | Data Safety | File `.env`, SQL dump, data pelanggan asli | Tidak masuk ke commit repository |
| T-20 | Restore | Backup terenkripsi AES-256-GCM diverifikasi | Restore sukses ke DB uji terisolasi, checksum/row count/FK/sequence valid |
| T-21 | Order Items | Dua bunga satu order, tanggal dan tujuan berbeda | Jadwal/tujuan setiap item konsisten pasca edit dan restore |
| T-22 | Order Items | Satu jenis bunga sama dikirim dua tanggal berbeda | Dua baris item terpisah, tidak digabung otomatis |
| T-23 | Fulfillment | Item A `DELIVERED`, item B belum `DELIVERED` | Status order bukan `COMPLETED` |
| T-24 | Fulfillment | Seluruh item `DELIVERED` | Status order otomatis `COMPLETED` |
| T-25 | Pricing | Bunga Rp800.000 mode `INCLUDED` dengan fee Rp0 | Total item Rp800.000 |
| T-26 | Pricing | 2 bunga @Rp250.000, ongkir `SEPARATE` Rp75.000 | Total item Rp575.000; ongkir tidak dikalikan qty |
| T-27 | Pricing | Order campuran item `INCLUDED` Rp800.000 + `SEPARATE` Rp575.000 | Total Rp1.375.000; nilai bunga Rp1.300.000; ongkir Rp75.000 |
| T-28 | Validation | `INCLUDED` dengan fee > 0 atau `SEPARATE` dengan fee 0 | Ditolak server tanpa penulisan parsial |
| T-29 | Pricing | Ubah ongkir setelah DP hingga total baru < payment `POSTED` | Ditolak atomik; revisi sah dicatat di audit |
| T-30 | Reports | Ongkir ditagihkan Rp75.000; biaya kurir dibayar Rp55.000 | Tagihan memuat Rp75.000, expense Rp55.000, kas masuk dari `POSTED` payments |
| T-31 | Pricing | Item jenis sama namun tanggal/lokasi berbeda | Ongkir dicatat sekali per pengiriman/item |
| T-32 | Pricing | Input pesanan normal | Total = jumlah `(qty * unit_price + ongkir SEPARATE)` tanpa diskon/pajak |
| T-33 | Scope | Form dan skema database | Tidak memiliki field atau perhitungan diskon/pajak |
| T-34 | Order & Payments | Simpan order tanpa pembayaran atau DP | Berhasil, status `UNPAID`, piutang = total tagihan |
| T-35 | Order & Payments | Bayar penuh segera setelah order tersimpan | Tercatat dalam dua langkah (simpan order, lalu catat payment penuh pada detail order) |
| T-36 | Order & Payments | Order seluruh item `DELIVERED` belum dibayar | Progres `COMPLETED`, status bayar `UNPAID`, piutang tetap ada |
| T-37 | Order & Payments | Order selesai dikirim lalu dibayar penuh | Status bayar `PAID`, sisa Rp0, progres tetap `COMPLETED` |
| T-38 | Order & Payments | DP dicatat hanya pada order tertentu | DP opsional; status `PARTIAL` hanya pada order yang dibayar sebagian |

## 4. Cakupan Suite Otomatis Phase 13 (236 Tests)

Berdasarkan laporan [Phase 13E](phase13/PHASE13E_FULL_REGRESSION_AND_RELEASE_READINESS_REPORT.md), 236 pengujian otomatis mencakup kelompok berikut:

- **Keamanan & Infrastruktur:** `AdminAccessTest`, `CloudflareAccessMiddlewareTest` (21 skenario RS256 JWKS & fail-closed), `DatabaseBackupTest` (17+ skenario AES-256-GCM, tamper detection, PostgreSQL/MariaDB/SQLite restore & sequence sync), `StagingMigrationAndAdminCommandTest` (`DatabaseTargetGuard`), `PaymentConcurrencyLockTest` (uji konkurensi nyata).
- **Domain & Layanan Inti:** `CustomerManagementTest`, `OrderManagementTest`, `PaymentManagementTest`, `ExpenseManagementTest`, `DashboardTest`, `PostgresStagingEndToEndTest`.
- **Antarmuka React/Inertia & BI Phase 13:** `UiAuthTest`, `UiCustomerTest`, `UiDashboardTest`, `UiOrderTest`, `UiOrderMutationTest`, `UiPaymentTest`, `UiExpenseTest`, `UiExpenseCategoryTest`, `UiReportTest`, `Phase9Sprint1LocalizationTest`, `Phase9Sprint2OperationsTest`, `Phase9Sprint3FinancialTest`, `Phase13BFoundationRegressionTest`, `Phase13CDashboardBiTest`, `Phase13DFinancialReportsTest`.

Rujukan terkait: [BUSINESS_RULES.md](BUSINESS_RULES.md), [PRICING_AND_SHIPPING.md](PRICING_AND_SHIPPING.md), [PHASE13E_FULL_REGRESSION_AND_RELEASE_READINESS_REPORT.md](phase13/PHASE13E_FULL_REGRESSION_AND_RELEASE_READINESS_REPORT.md).
