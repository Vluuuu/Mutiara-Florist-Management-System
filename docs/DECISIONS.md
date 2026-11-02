# Decision Log
Berisi keputusan yang sudah disepakati dan usulan yang **belum** final. Perbarui ketika scope berubah.

| ID | Status | Keputusan / Usulan | Alasan |
| --- | --- | --- | --- |
| D-001 | Accepted | Sistem khusus administrasi internal Mutiara Indah Florist, bukan toko online publik | Sesuai kebutuhan pencatatan pesanan |
| D-002 | Accepted | Target implementasi full-stack Laravel + MySQL, bukan mockup saja | Pengembangan nyata diizinkan untuk tugas PAW |
| D-003 | Accepted | Aplikasi digunakan dari satu laptop oleh satu operator pada fase awal | Pengguna saat ini yang mencatat pesanan |
| D-004 | Accepted | Database utama lokal; Google Drive untuk cadangan, Excel untuk ekspor | Pemisahan data operasional, backup, dan laporan |
| D-005 | Accepted | Modul utama: pelanggan, pesanan, pembayaran, pengeluaran, piutang, dashboard, laporan | Cakupan yang telah dipilih |
| D-006 | Proposed | Laravel monolith MVC + Blade + Tailwind + Alpine.js | Sederhana untuk aplikasi PHP server-rendered |
| D-007 | Proposed | Login satu akun administrator | Keamanan data lokal tanpa role multi-user |
| D-008 | Proposed | `orders` dan `order_items` terpisah; pembayaran sebagai riwayat | Mengakomodasi beberapa item/DP |
| D-009 | Proposed | Nominal disimpan sebagai Rupiah bulat; laporan kas dibedakan dari penjualan | Menghindari pecahan floating-point dan penghitungan ganda |
| D-010 | Open | Pembatalan, koreksi pembayaran, refund, dan penanganan DP hangus | Berpengaruh pada data dan piutang |
| D-011 | Open | Ongkir, diskon, pajak, lokasi/tanggal kirim per item | Berpengaruh pada skema dan total order |
| D-012 | Open | Pilihan server development Windows dan mekanisme backup Drive otomatis vs manual | Memerlukan verifikasi lingkungan |
| D-013 | Open | Jadwal rilis dan apakah impor Excel masuk MVP | Perlu prioritas pengerjaan |

**Catatan:** `Accepted` berarti keputusan arah proyek dalam percakapan; `Proposed` belum diuji di implementasi. Tidak ada kode aplikasi yang telah dibuat ketika log ini diinisialisasi.
