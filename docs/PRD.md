# Product Requirements Document (PRD)
**Produk:** Mutiara Florist Management System (MFMS)  
**Status:** Draft v0.4 — tanggal/lokasi kirim dan pilihan ongkir termasuk/terpisah telah dikonfirmasi; refund/diskon/pajak masih Open

## 1. Konteks dan masalah
Mutiara Indah Florist saat ini mencatat pemesanan secara manual di Google Sheets. Kolom acuan: tanggal, pemesan, untuk/penerima, dari/pengirim ucapan, jenis bunga, quantity, penanda pembayaran, keterangan, dan harga. Terdapat tab bulanan (contoh Mei dan Juni 2025). Struktur ini menjadi referensi kebutuhan, **bukan** data yang harus langsung dipindahkan ke repository.

## 2. Target produk
Aplikasi administrasi internal yang berjalan di laptop operator dan mengintegrasikan pesanan, riwayat pembayaran, pengeluaran, piutang, serta laporan. Target pengembangan adalah sistem full-stack fungsional. Tidak ada pelanggan yang login atau checkout mandiri.

**Pengguna tahap awal:** satu operator/admin yang mencatat transaksi dari laptop. Pemilik usaha dapat menerima hasil laporan, tidak perlu akun tersendiri pada versi awal.

## 3. Alur utama
1. Operator mencari atau menambahkan pelanggan.
2. Operator membuat pesanan dengan tanggal order dan satu atau banyak item; **setiap item memiliki tanggal pengiriman, lokasi tujuan, penerima, pengirim ucapan, kuantitas, harga, serta mode ongkir termasuk/terpisah dan nominal tambahan jika terpisah**.
3. Operator mengubah status pengerjaan secara independen dari pembayaran.
4. Operator mencatat DP atau pelunasan; sistem menghitung sisa tagihan dan status bayar.
5. Operator mencatat pengeluaran usaha dan melihat rekap piutang, penerimaan, serta pengeluaran.
6. Operator mengekspor laporan dan membuat/memulihkan backup terverifikasi.

## 4. Kebutuhan fungsional
| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| FR-01 | Login/logout satu akun operator, sesi aman | P0 |
| FR-02 | CRUD pelanggan dan pencarian nama/telepon | P0 |
| FR-03 | CRUD pesanan dan item bunga, termasuk **tanggal kirim, tujuan, dan ongkir per item** | P0 |
| FR-04 | Filter pesanan menurut tanggal, status, jenis, dan pelanggan | P0 |
| FR-05 | Status pengerjaan per item dan ringkasan order, terpisah dari status pembayaran | P0 |
| FR-06 | Catat pembayaran sebagian/pelunasan dengan riwayat | P0 |
| FR-07 | Hitung tagihan dari nilai bunga + ongkir SEPARATE, lalu sudah dibayar, sisa/piutang | P0 |
| FR-08 | CRUD pengeluaran dengan kategori dan tanggal | P0 |
| FR-09 | Dashboard total nilai pesanan, nilai bunga, ongkir tambahan, penerimaan, pengeluaran, piutang | P0 |
| FR-10 | Laporan bulanan dan ekspor Excel | P0 |
| FR-11 | Backup lokal, salinan off-device, dan alur restore | P0, wajib sebelum memakai data nyata |
| FR-12 | Bukti pembayaran/foto pesanan sebagai lampiran | P1 |
| FR-13 | Impor data Google Sheets/Excel dengan pratinjau | P1 |
| FR-14 | Invoice PDF | P1 |
| FR-15 | Backup Drive otomatis | P1; manual dulu bila perlu |

## 5. Kebutuhan nonfungsional
- **Local-first:** halaman dan database lokal tidak memerlukan internet untuk proses utama.
- **Integritas:** nominal uang integer Rupiah; perubahan keuangan memiliki audit; operasi multi-tabel atomik, penguncian saldo dan idempotency untuk pembayaran.
- **Keamanan:** login, validasi server, CSRF, escape output, larangan commit data sensitif.
- **Kegunaan:** antarmuka bahasa Indonesia, Rupiah, tabel yang bisa dicari, mobile responsive meskipun laptop prioritas.
- **Keandalan:** backup database beserta lampiran dan uji pemulihan berkala.
- **Audit:** tabel audit_logs untuk pencatatan koreksi keuangan; void input salah tidak disamakan dengan refund uang nyata.

## 6. Struktur halaman
Dashboard; Pesanan (daftar, buat, detail, edit); Pelanggan; Pembayaran/Piutang; Keuangan (pengeluaran); Laporan; Pengaturan/Backup.

## 7. Di luar ruang lingkup awal
Website pemesanan publik, payment gateway, POS multi-cabang, inventory bunga, HR/penggajian, multi-tenant, mobile native, hosting online, otomasi WhatsApp, dan pembukuan akuntansi double-entry penuh.

## 8. Kriteria penerimaan awal
- Pesanan dengan beberapa item **berbeda tanggal/lokasi kirim dan mode ongkir** tersimpan benar; total = jumlah (quantity × harga bunga + ongkir tambahan per item). Order dinyatakan selesai hanya setelah seluruh item dikirim.
- DP dan pelunasan menghasilkan saldo dan status yang benar; pembayaran berlebih dan submit ganda ditolak.
- Transaksi pembayaran tidak dihitung ganda sebagai pemasukan.
- Pengeluaran memengaruhi ringkasan kas, bukan nilai penjualan. Order berbayar tidak dapat dibatalkan hingga kebijakan refund disetujui.
- Filter tanggal laporan konsisten dengan tanggal peristiwa tiap metrik.
- Data tetap ada setelah aplikasi direstart.
- Backup dapat dipulihkan pada basis data uji dan hasilnya diverifikasi.

## 9. Hal yang perlu dikonfirmasi ke operator/pemilik
- **Potongan harga dan pajak** belum diputuskan; ongkir sudah dipastikan kadang termasuk dan kadang terpisah. Apakah pelanggan pernah membayar kurir langsung (di luar kas florist)?
- Aturan pembatalan, refund, koreksi pembayaran, dan deposit hangus?
- Metode pembayaran dan rekening apa saja yang diperlukan?
- Apakah pengeluaran mencakup utang pemasok, atau hanya uang yang sudah keluar?
- Jadwal backup yang sesuai pola pemakaian laptop.

**Baseline teknis:** 8 tabel termasuk audit_logs; status pesanan dan bayar terpisah; piutang historis as-of belum tersedia. Lihat [DATABASE](DATABASE.md), [BUSINESS_RULES](BUSINESS_RULES.md), [PRICING_AND_SHIPPING](PRICING_AND_SHIPPING.md), [WORKFLOWS](WORKFLOWS.md), [TEST_PLAN](TEST_PLAN.md), dan [DECISIONS](DECISIONS.md).
