# Phase 8.2 Design Comparison: Arah 1 vs Arah 2

Tanggal: 17 November 2026
Branch: `design/phase8-human-centered-refinement`
Status: **MENUNGGU TINJAUAN & PERSETUJUAN PEMILIK (BELUM MASUK PHASE 9)**

---

## 1. Tujuan Eksplorasi Ulang (Phase 8.2)

Phase 8 sebelumnya menghasilkan Opsi A (*Atelier Ledger*), Opsi B (*Workshop Desk*), dan Opsi C (*Studio Mutiara*). Dari hasil tinjauan pemilik dan audit Phase 8:
- **Yang terbaik dari Opsi A:** kehangatan nuansa buku catatan toko bunga, prioritas agenda pengiriman di paling atas, serta navigasi operasional harian yang ringkas.
- **Yang terbaik dari Opsi C:** keterbacaan teks arang `#1E2420` di atas kartu putih `#FFFFFF`, hierarki status bayar/pengerjaan yang sangat tegas, serta kartu mobile yang rapi.
- **Kelemahan Phase 8 yang wajib diperbaiki:** bug CSS inline `grid-template-columns: repeat(4, 1fr)` pada Opsi B yang membocorkan lebar mobile menjadi ~652px, keberadaan tab ambigu `"Detail"` pada bilah bawah mobile, tombol `Menu` yang muncul ganda pada breakpoint desktop/mobile, serta bilah simpan sticky yang sempat tumpang tindih di tengah form saat halaman panjang.

Phase 8.2 tidak sekadar menggabungkan template A dan C, melainkan menyusun **dua arah desain matang** yang sama-sama menyelesaikan seluruh masalah tersebut dan menjawab enam pertanyaan UX manusia:
1. Apa yang dilihat operator pertama kali?
2. Keputusan apa yang harus bisa diambil dalam 3 detik?
3. Aksi utama apa yang paling dekat dan cepat diakses?
4. Informasi apa yang cukup muncul di halaman detail?
5. Kesalahan input apa yang dicegah sistem sebelum tersimpan?
6. Bagaimana pengalaman saat memakai HP di meja kasir atau saat pengiriman?

---

## 2. Perbandingan Arah 1 vs Arah 2

| Aspek Evaluasi | Arah 1: Warm Atelier Workspace (`direction-1-warm-atelier.html`) | Arah 2: Botanical Studio Workspace (`direction-2-botanical-studio.html`) |
| :--- | :--- | :--- |
| **Karakter Visual** | Kertas linen hangat (`#FAF7F2`) dengan rel kiri krem lembut (`#F5EFE6`), aksen hijau hutan (`#163829`), dan terakota (`#B44D2B`) khusus peringatan terlambat/piutang. | Kanvas studio netral-hangat (`#FBF9F6`), kartu putih bersih (`#FFFFFF`), rel kiri hijau botani pekat (`#143326`), dan aksen mawar burgundy (`#8C3B4A`) khusus prioritas tinggi. |
| **Pemisahan Zona Navigasi & Kerja** | Halus via garis batas `#E2D9CB` dan latar krem `#F5EFE6`. | Sangat tegas berkat kontras tinggi rel `#143326` terhadap area kerja `#FBF9F6` (`12.48:1`). |
| **Ergonomi Form Pesanan** | Seksi kartu bertumpuk 1 kolom penuh dengan bilah simpan ringkasan di bagian bawah form. | Split desktop 2 kolom (`Form Utama` di kiri + `Ringkasan Hitungan Nota` sticky lengkap tombol `Simpan Pesanan` di kanan), plus bilah simpan bawah bebas tumpang tindih. |
| **Pencegahan Error & Validasi** | Validasi standar per input + toast umpan balik. | Ringkasan error GOV.UK di puncak form (`role="alert"` + tautan lompat ke field error), `Customer Combobox` + modal `+ Pelanggan Baru` tanpa mereset item, dan mode simulasi `Empty / Loading / Error`. |
| **Integritas Keuangan & Audit** | Kartu status `POSTED`/`VOIDED` dengan coretan nominal void. | Lengkap modal `+ Catat Pembayaran` (pre-fill sisa tagihan, `CurrencyInput`) dan modal `Void / Koreksi` dengan alasan wajib tervalidasi. |
| **Kesiapan Cakupan Halaman** | 5 layar inti interaktif (`Dashboard`, `Pesanan`, `Buat Pesanan`, `Detail Pesanan`, `Pembayaran`). | 5 layar inti interaktif penuh + 4 halaman blueprint pendukung (`Pelanggan`, `Pengeluaran`, `Kategori Biaya`, `Laporan`) + tombol `Keluar Akun` di sidebar & Menu mobile. |
| **Skor Kesesuaian Pencahayaan Toko / Luar Ruangan** | Sangat nyaman di dalam ruang kasir redup-sedang, namun rel krem terasa agak menyatu saat layar terkena silau sinar matahari di luar ruangan. | Unggul di dalam ruang ber-AC lampu toko maupun di luar ruangan saat kurir mengecek HP karena kontras antar blok jauh lebih tajam. |

---

## 3. Rekomendasi Desain Terkuat

Rekomendasi utama untuk dipilih menuju Phase 9 adalah **Arah 2: Botanical Studio Workspace** (`docs/phase8-2/direction-2-botanical-studio.html`), karena:
1. **Pemisahan fokus tercepat (uji 3 detik):** Operator nonteknis langsung membedakan menu navigasi (rel gelap `#143326`) dari daftar kiriman dan nominal tagihan (kartu terang `#FFFFFF`) tanpa berpikir.
2. **Keamanan input & pencatatan uang lebih tinggi:** Kombinasi `Error Summary`, `Customer Combobox + Modal Tambah Pelanggan tanpa reset form`, `Duplikat Item`, toggle ongkir `SEPARATE`/`INCLUDED`, `CurrencyInput` bulat Rupiah, dan modal `Void` beralasan mengurangi risiko kesalahan kasir harian.
3. **Skalabilitas penuh ke seluruh 9 halaman MFMS:** Sudah mencakup pola 5 layar inti dan blueprint seragam untuk 4 layar administrasi serta `Keluar Akun`.

---

## 4. Bukti Visual Perbandingan (Desktop, Tablet, Narrow Desktop, Mobile, Small Mobile)

Seluruh file HTML dan PNG berada di folder `docs/phase8-2/`:

| Arah | Viewport | Layar | File Bukti |
| :--- | :--- | :--- | :--- |
| Arah 1 | Desktop `1440×900` | Dashboard | `docs/phase8-2/screenshots/d1-desktop-dashboard.png` |
| Arah 1 | Desktop `1440×900` | Buat Pesanan | `docs/phase8-2/screenshots/d1-desktop-order-form.png` |
| Arah 1 | Desktop `1440×900` | Detail Pesanan | `docs/phase8-2/screenshots/d1-desktop-order-detail.png` |
| Arah 1 | Mobile `390×844` | Dashboard & Detail | `d1-mobile-dashboard.png`, `d1-mobile-order-detail.png` |
| Arah 2 | Desktop `1440×900` | 5 Layar Inti + Validasi + Error | `d2-desktop-dashboard.png`, `d2-desktop-orders.png`, `d2-desktop-order-form.png`, `d2-desktop-order-detail.png`, `d2-desktop-payments.png`, `d2-desktop-validation-summary.png`, `d2-desktop-orders-error-state.png` |
| Arah 2 | Narrow Desktop `1024×768` | Dashboard | `docs/phase8-2/screenshots/d2-narrow-desktop-dashboard.png` |
| Arah 2 | Tablet `768×1024` | Dashboard & Form | `d2-tablet-dashboard.png`, `d2-tablet-order-form.png` |
| Arah 2 | Mobile `390×844` | 5 Layar + Drawer + Modal Bayar | `d2-mobile-dashboard.png`, `d2-mobile-orders.png`, `d2-mobile-order-form.png`, `d2-mobile-order-detail.png`, `d2-mobile-payments.png`, `d2-mobile-menu-drawer.png`, `d2-mobile-payment-modal.png` |
| Arah 2 | Small Mobile `360×780` | Dashboard, Detail, Form | `d2-360-dashboard.png`, `d2-360-order-detail.png`, `d2-360-order-form.png` |

**Keputusan diserahkan kepada pemilik toko untuk memilih Arah 1 atau Arah 2 (atau memberi catatan penyesuaian) sebelum implementasi React/Inertia Phase 9 dimulai.**
