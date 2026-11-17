# Phase 7 — Anti-Slop Redesign Requirements & Phase 8 Design Direction
**Mutiara Florist Management System (MFMS)**

Dokumen ini menjadi kontrak desain dan spesifikasi teknis untuk **Phase 8 (UI/UX Redesign)**. Tujuannya adalah mengubah MFMS dari kumpulan halaman hasil migrasi bertahap yang terasa seperti *generic AI/SaaS dashboard* menjadi sistem kerja **toko bunga profesional yang hangat, cepat untuk operator kasir/admin nonteknis, nyaman di desktop maupun smartphone, dan siap diakses online.**

---

## 1. Arah Desain Phase 8 (Anti-Slop Design Direction)

### 1.1 Mengapa Desain Saat Ini Terasa "Slop" dan Harus Diubah
1. **Header & Kartu Monoton:** Semua halaman memakai rumus identik (`EYEBROW` uppercase + `text-3xl` + subjudul + kotak `Card` putih di atas `stone-50`). Semua KPI pada Dashboard berukuran dan berbobot visual sama sehingga mata operator tidak tahu harus melihat apa terlebih dahulu.
2. **Sisa Scaffolding Migrasi:** Sidebar masih menampilkan 6 tautan `FALLBACK BLADE LAMA`, tombol `Tampilan Blade lama` hadir di 5+ halaman, dan Dashboard masih menampilkan badge `Phase 3.3 · React` + teks `Pengembangan berikutnya`.
3. **Bahasa Teknis Bocor ke Kasir:** Kode internal `(NEW)`, `(PROCESSING)`, `(READY)`, `(COMPLETED)`, `(UNPAID)`, `(PARTIAL)`, `(PAID)`, `POSTED`, `VOIDED`, `order_date`, `ID #2`, ULID 36 karakter, dan pesan validasi Inggris (`The items.0.flower_type field is required.`) ditampilkan langsung ke operator toko.
4. **Identitas Florist Absen:** Tidak ada nuansa bengkel/toko bunga (*atelier / florist ledger*). Tampilan lebih mirip aplikasi akuntansi generik daripada alat kerja toko karangan bunga yang berpacu dengan jadwal pengiriman acara.

### 1.2 Karakter Visual Target: *"Warm Florist Ledger & Workshop Desk"*
- **Prinsip Utama:** Hangat, bersih, berstruktur seperti buku catatan pesanan toko bunga modern (*craft editorial*), dengan ketegasan kontras tinggi untuk angka uang dan jadwal kirim.
- **Palet Warna yang Terarah (Terukur, Bukan Generik):**
  - **Kanvas & Permukaan:** Latar utama kertas hangat (`#FAF8F4` / warm ivory) dengan permukaan kartu putih bersih (`#FFFFFF`) dan aksen permukaan sekunder krem lembut (`#F3EFE7`) untuk ringkasan finansial/catatan ucapan, menggantikan `stone-50` datar di mana-mana.
  - **Primer (Botanical Deep Pine):** `#143A2B` (hijau botani dalam, bukan sekadar `emerald-950` default Tailwind) untuk CTA utama, fokus aktif, dan angka tagihan.
  - **Aksen Sekunder (Terracotta / Marigold Florist):** `#B45309` (amber hangat) untuk progres *Diproses*, `#9F3A26` / `#B91C1C` (terracotta/crimson terkendali) untuk *Piutang / Void / Wajib*.
  - **Status Semantik Konsisten (1 sistem warna untuk 1 arti di seluruh aplikasi):**
    - Pengerjaan: `Baru` (netral batu), `Diproses` (amber hangat), `Siap kirim` (biru langit), `Terkirim / Selesai` (hijau botani).
    - Pembayaran: `Belum bayar` (rose/coral lembut), `Sebagian` (amber), `Lunas` (hijau botani).
- **Tipografi & Angka:**
  - Gunakan pasangan font lokal/self-hosted yang berkarakter namun ringan (atau fallback aman offline-first): *Plus Jakarta Sans* / *Inter* untuk UI + *Instrument Serif* atau *Fraunces* secara sangat hemat hanya pada brand/heading tertentu jika di-bundle lokal (tanpa ketergantungan CDN agar `local-first` tetap jalan offline!).
  - **Wajib `tabular-nums`** (`font-variant-numeric: tabular-nums`) untuk seluruh nominal Rupiah, kuantitas, tanggal, dan sel tabel laporan.
  - **Standar Tunggal Format Rupiah (`formatRupiah`):** Tanpa spasi setelah `Rp` untuk kepadatan tabel yang rapi (`Rp1.500.000`, negatif `-Rp55.000`), konsisten di seluruh modul termasuk Pengeluaran dan Laporan.
- **Aturan Anti-Slop Layout:**
  - Hapus bar atas desktop yang hanya mengulang `<h2>{title}</h2>` tepat di atas `<h1>{title}</h1>`.
  - Hapus semua `EYEBROW` dekoratif yang berulang-ulang kecuali benar-benar berfungsi sebagai breadcrumb atau konteks navigasi.
  - Gunakan **2-column asymmetric workspace** pada form/detail desktop (`lg:grid-cols-[minmax(0,1fr)_360px]`) agar ringkasan tagihan dan tombol simpan/bayar selalu terlihat tanpa scroll 2.500px.

---

## 2. Kebutuhan Arsitektur UI & Komponen Bersama

1. **Shell & Navigasi (`AppLayout` & `SidebarContent`):**
   - Hapus blok `FALLBACK BLADE LAMA` dari sidebar dan hapus tombol `Tampilan Blade lama` / `Buka di Blade lama` dari semua halaman React.
   - Sidebar desktop menampilkan: Brand `Mutiara Florist`, 7 menu utama dengan badge hitung opsional (mis. jumlah pesanan `Baru` atau piutang terbuka bila relevan), info operator aktif, dan tombol `Keluar` di footer sidebar.
   - **Perbaiki Mobile Drawer (`390×844`):** Kontainer drawer wajib `flex h-dvh flex-col` dengan area navigasi `flex-1 overflow-y-auto` dan footer akun + tombol `Keluar` `shrink-0` selalu terlihat di bagian bawah. Wajib mendukung penutupan dengan tombol `Escape` dan memindahkan fokus ke dalam drawer saat dibuka.
   - Tambahkan **Mobile Quick Action / Bottom Bar** atau header action cepat (`+ Pesanan`) di layar kecil sehingga operator HP bisa langsung mencatat transaksi dalam 1 ketukan.
2. **Komponen UI Standar (Mengakhiri Inline Styling Ad-hoc):**
   - `<Modal>`: Komponen tunggal aksesibel (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Escape` handler, close button `aria-label="Tutup"`, initial focus management, backdrop click guard saat `isSubmitting`). Dipakai seragam oleh: Modal Arsip Pelanggan, Modal Tambah Pelanggan Cepat, Modal Kemajuan Status Bunga, Modal Catat Pembayaran, Modal Void Pembayaran, Modal Void Pengeluaran, Modal Konfirmasi Nonaktif Kategori.
   - `<CurrencyInput>`: Menampilkan pemisah ribuan (`1.050.000`) secara real-time saat mengetik, placeholder kosong (bukan default `0` yang sulit dihapus), dan tetap mengirim nilai integer murni ke backend.
   - `<SearchableSelect>` / Combobox Pelanggan: Mendukung pencarian nama & telepon secara instan tanpa scroll dropdown panjang.
   - `<ResponsiveDataList>`: Merender tabel bersih di `md:`/`lg:` ke atas, dan otomatis berubah menjadi **kartu ringkas yang terbaca utuh tanpa horizontal scroll** di `< 768px` (mobile & tablet sempit), dengan area klik minimal `44×44px` per aksi.
   - `<OrderCodeBadge>`: Memformat nomor order ULID agar mudah dibaca manusia (misal menampilkan tanggal + 6 karakter akhir yang kontras + tombol salin kode lengkap), tidak mematahkan baris di mobile.
   - `<CharCounterTextarea>`: Untuk seluruh form Void (minimal 10 karakter) dengan indikator progres langsung (`7/10 karakter minimum`).
3. **Lokalisasi Validasi Backend (`FormRequest`):**
   - Tambahkan `messages()` dan `attributes()` Bahasa Indonesia pada seluruh `FormRequest`: `CustomerRequest`, `OrderRequest`, `StorePaymentRequest`, `VoidPaymentRequest`, `StoreExpenseRequest`, `VoidExpenseRequest`, `ExpenseCategoryRequest`.
   - Tidak boleh ada teks Inggris atau key teknis (`items.0.flower_type`) tampil ke layar operator.
4. **Reset Flash & State Modal:**
   - Flash message di `AppLayout` di-key berdasarkan isi/timestamp navigasi agar pemberitahuan baru selalu tampil meski pemberitahuan sebelumnya pernah ditutup (`dismissFlash`).
   - Error modal pembayaran/void dibersihkan saat modal ditutup agar tidak terbawa ke pembukaan modal berikutnya.

---

## 3. Spesifikasi Redesign Per Halaman (Phase 8)

### 3.1 Login (`/login`)
- Perbaiki `<Head title="Masuk" />` agar tab browser menjadi `Masuk — MFMS`.
- Hapus link `Tampilan Login Klasik (Blade Fallback) →`.
- Tambahkan toggle **Tampilkan/Sembunyikan Password** dengan `aria-label`.
- Tambahkan sentuhan identitas visual Mutiara Florist (ilustrasi/ornamen botani tipis yang elegan, bukan ikon kotak generik saja) sambil menjaga kontras AA dan form cepat.

### 3.2 Dashboard (`/dashboard` & `/ui-dashboard`)
- Hapus badge `Phase 3.3 · React` dan kotak `Pengembangan berikutnya`.
- Samakan prop `nav` di `UiDashboardController` dengan `HandleInertiaRequests` (atau hapus duplikasi override `nav` di `UiDashboardController`).
- **Struktur Baru (Tanpa Ubah Definisi Metrik `DashboardService`):**
  1. **Bar Aksi Cepat:** Judul selamat datang + tanggal hari ini (WIB) + 2 CTA utama: `+ Buat Pesanan` dan `+ Catat Pengeluaran`.
  2. **Hierarki KPI yang Jelas:**
     - **2 Metrik Utama (Highlight):** `Uang Diterima` & `Piutang Saat Ini` (dengan link langsung ke `/ui-payments`) dan `Selisih Kas Sederhana` (dengan label jelas *"Bukan laba bersih akuntansi"*).
     - **3 Metrik Sekunder (Ringkas):** `Total Pesanan`, `Nilai Pesanan`, `Pengeluaran Kas`.
  3. **Panel Operasional Harian (Nilai Tambah Tinggi untuk Operator):**
     - **Jadwal Kirim Hari Ini & Besok** (daftar item bunga aktif yang tanggal kirimnya hari ini/H+1 lengkap dengan penerima & tombol buka pesanan).
     - **Pesanan Terbaru / Menunggu Diproses** (status `Baru` & `Diproses` dengan tautan 1 klik ke detail pesanan).

### 3.3 Pelanggan (`/ui-customers`, `/create`, `/{id}`, `/{id}/edit`)
- **Daftar (`/ui-customers`):**
  - Pencarian dengan debounce ringan (atau tombol `Cari` + `Reset` yang sejajar rapi).
  - Pada `< 768px`, tampilkan kartu pelanggan (Nama, Telepon clickable `tel:`, badge jumlah pesanan, tombol `Detail` & `Edit` >= 44px).
- **Detail (`/ui-customers/{id}`):**
  - Hapus teks usang `"Riwayat pesanan akan dapat dibuka setelah modul Pesanan tersedia."`.
  - Tambahkan CTA utama **`+ Buat Pesanan`** yang mengarah ke `/ui-orders/create?customer_id={id}`.
  - Tampilkan **daftar riwayat pesanan pelanggan tersebut** (tanggal, kode ringkas, total, status pengerjaan, status bayar, tautan ke `/ui-orders/{id}`).
  - Pertahankan aturan arsip: pelanggan dengan `orders_count > 0` tidak dapat diarsipkan; pelanggan `0` pesanan memakai `<Modal>` konfirmasi arsip.

### 3.4 Pesanan — Daftar (`/ui-orders`)
- Perbaiki teks tombol menjadi `+ Buat Pesanan` (tanpa `+` ganda).
- Tambahkan **chip filter cepat 1-klik** status pengerjaan (`Semua`, `Baru`, `Diproses`, `Siap Kirim`, `Selesai`) di atas/dalam bar filter agar tidak perlu buka dropdown + klik `Terapkan`.
- Tampilkan **ringkasan item & jadwal kirim** (misal: *"Papan Ucapan (+1 item) · Kirim 18/11"* dan nama penerima utama) di setiap baris/kartu agar operator langsung mengenali pesanan tanpa menghafal ULID.
- Gunakan `<ResponsiveDataList>` untuk mobile & tablet (`< 1024px`) sehingga Status Pengerjaan, Tagihan, Status Bayar, dan tombol `Detail` selalu terlihat tanpa scroll samping.

### 3.5 Pesanan — Buat (`/ui-orders/create`) & Edit (`/ui-orders/{id}/edit`)
- **Combobox Pelanggan:** Kosongkan pilihan default (`""`), sediakan pencarian nama/telepon instan, serta tombol **`+ Pelanggan Baru`** yang membuka **Quick-Create Customer Modal** di halaman yang sama (tidak menghapus isian bunga!).
- **Dukung Pre-fill `customer_id` dari Query String** (ketika datang dari halaman Detail Pelanggan).
- **Layout Desktop 2 Kolom (`1fr` + `360px` Sticky Summary):**
  - Kolom kiri: Info Pemesan & Tanggal + Kartu Item Bunga (`Bunga 1`, `Bunga 2`, dst.).
  - Kolom kanan (sticky di desktop, sticky bottom bar atau ringkasan ringkas di mobile): Total Nilai Bunga, Total Ongkir Terpisah, **Total Tagihan**, penjelasan penyebab jika tombol simpan belum aktif, dan tombol `Simpan Pesanan`.
- **Ergonomi Kartu Item Bunga:**
  - Hubungkan semua `<label htmlFor>` ke `id` unik per item (`_key`).
  - Gunakan `<CurrencyInput>` untuk Harga Satuan dan Ongkir Tambahan.
  - **Sembunyikan field `Ongkir tambahan`** saat `Mode ongkir = Termasuk harga bunga (Rp0)`, dan tampilkan hanya ketika memilih `Ditagihkan terpisah`.
  - Tambahkan tombol **`Duplikat bunga`** di header kartu item untuk mempercepat pencatatan order multi-item (yang berbeda hanya tanggal/tujuan atau penerima).
  - Perbaiki typo spasi `Ongkir ( Rp0)`.
- **Khusus Edit (`/ui-orders/{id}/edit`):**
  - Hapus tampilan teknis `· ID #2`.
  - Untuk item yang sudah berstatus `DELIVERED` (`Terkirim`), tampilkan badge statis `"Terkirim (Final)"` alih-alih `<select>` dengan 1 opsi.
  - Hitung secara live apakah susunan finansial berubah pada order yang sudah punya pembayaran (`order.received > 0`): jika berubah, tandai field `Alasan perubahan` dengan badge **Wajib** (`*`) dan pesan inline sebelum submit; jika tidak berubah, tetap opsional.

### 3.6 Pesanan — Detail & Modal (`/ui-orders/{id}`)
- **Layout 2 Kolom di Desktop:**
  - Header: Kode order ringkas (dengan tombol salin kode lengkap), nama pelanggan (link ke `/ui-customers/{id}` + nomor telepon clickable), tanggal pesan, dan tombol `Edit Pesanan`.
  - Kolom kanan (Ringkasan Finansial & Pembayaran): Total Tagihan, Sudah Dibayar, Sisa Tagihan (highlight bila > 0), Status Bayar, **1 tombol utama `+ Catat Pembayaran`** (hilangkan duplikasi 2 tombol identik!), Rincian Bunga vs Ongkir, dan Riwayat Pembayaran.
  - Kolom kiri: Status Pengerjaan Pesanan + Catatan Pesanan + Kartu Rincian Item Bunga.
- **Kartu Item Bunga yang Lebih Bersih:**
  - Tampilkan status item **1 kali** di header kartu + stepper visual kecil 4 tahap (`Baru → Diproses → Siap Kirim → Terkirim`).
  - Perbaiki copy deskripsi aksi: pisahkan label *"Tahap saat ini: Siap kirim"* dan tombol aksi *"Tandai Terkirim di Lokasi"*, sehingga tidak terjadi kebingungan seperti copy saat ini pada `READY`.
- **Modal Pembayaran & Modal Void:**
  - Memakai `<CurrencyInput>` di Modal Pembayaran, `aria-label="Tutup"` pada tombol `X`, dan regenerasi `idempotency_key` saat modal dibuka ulang atau setelah error non-idempotent.
  - Modal Void menampilkan penghitung karakter `x/10 karakter minimum` dan peringatan non-refund yang jelas.

### 3.7 Pembayaran & Piutang (`/ui-payments`)
- Tambahkan tombol **`Catat Bayar`** langsung pada setiap baris/kartu piutang untuk membuka Modal Catat Pembayaran tanpa wajib pindah halaman ke Detail Pesanan dahulu (mengirim ke endpoint yang sama `POST /ui-orders/{order}/payments`), tetap sediakan link `Detail` untuk melihat item atau void.
- Terapkan `<ResponsiveDataList>` agar di mobile `390×844` operator langsung melihat: Nama Pelanggan, Kode Pesanan, Total, Sudah Dibayar, **Sisa Piutang** (menonjol), dan tombol `Catat Bayar`.

### 3.8 Pengeluaran (`/ui-expenses`, `/ui-expenses/create`) & Kategori Biaya (`/ui-expense-categories`)
- **Backend Formatter (`UiExpenseController::index`):** Format `expense_date` ke `d/m/Y` (atau kirim `expense_date` terformat + `expense_date_raw` `Y-m-d` seperti `UiOrderController`), dan format `voided_at` ke `d/m/Y H:i` zona `Asia/Jakarta` agar **tidak tampil ISO UTC yang bergeser tanggal**.
- **Format `Rp` & Tampilan Mobile:** Gunakan `formatRupiah()` pada Total Pengeluaran, kolom Nominal, dan Modal Void Pengeluaran. Terapkan `<ResponsiveDataList>` untuk `< 768px`.
- **Validasi Filter Tanggal:** Render pesan error `errors.to` jika pengguna memasukkan `Sampai < Dari`.
- **Modal Void & Kategori:** Gunakan `<Modal>` aksesibel pada Void Pengeluaran (ganti div manual tanpa `role="dialog"`/`Escape`) dan pada Konfirmasi Nonaktifkan Kategori (ganti `window.confirm()`).
- **Kategori Biaya:** Beri `aria-label` dan ukuran sentuh >= 40×40px pada tombol Ubah Nama; dukung tombol `Escape` saat batal edit inline; tambahkan opsi tambah kategori cepat via modal dari `/ui-expenses/create` agar isian form pengeluaran tidak hilang.

### 3.9 Laporan (`/ui-reports`)
- **Bahasa Non-Teknis:** Hapus istilah SQL (`kolom order_date` → `"berdasarkan tanggal pemesanan"`) dan hapus kode enum Inggris (`(NEW)`, `(PROCESSING)`, `(READY)`, `(COMPLETED)`, `(UNPAID)`, `(PARTIAL)`, `(PAID)` → gunakan label Bahasa Indonesia saja).
- **Format Angka Konsisten:** Gunakan `Rp16.470.000` (tanpa spasi) dan `-Rp55.000` untuk selisih negatif; wajib `tabular-nums` dan `whitespace-nowrap` pada semua sel nominal.
- **Tabel Harian yang Lebih Efisien:**
  - Format tanggal tabel menjadi `dd/mm/yyyy` (atau `17 Nov 2026`).
  - Sediakan filter tampilan **"Hanya hari aktif (ada transaksi)"** sebagai default (atau toggle *"Tampilkan seluruh hari kosong"*), agar tabel 30 hari tidak dipenuhi belasan baris `-` yang memaksa scroll panjang.
  - Pada mobile `< 768px`, tampilkan ringkasan harian per hari aktif dalam format kartu ringkas alih-alih tabel 6 kolom yang memotong kolom kanan.
- **Target Sentuh Filter Preset:** Perbesar tinggi tombol preset (`Hari Ini`, `7 Hari`, `30 Hari`, `Bulan Ini`, `Bulan Lalu`, `Kustom`) dari `28px` menjadi minimal `38–40px`.

---

## 4. Kriteria Penerimaan Phase 8 (Definition of Done Redesign)

1. **Zero English/Technical Leaks:** 100% pesan validasi form, label status, tanggal (`Asia/Jakarta`), dan pesan error tampil dalam Bahasa Indonesia yang dipahami operator nonteknis.
2. **Zero Migration Scaffolding:** Tidak ada tautan `Blade lama` atau teks `Phase 3.3` / `Pengembangan berikutnya` di UI operasional.
3. **Mobile-First & Tablet Ready (`390×844` & `768×1024`):**
   - Tidak ada kolom nominal, status, atau tombol aksi yang terpotong di luar viewport.
   - Tombol `Keluar` di mobile drawer selalu terlihat dan dapat dijangkau; drawer menutup dengan `Escape`.
   - Seluruh tombol aksi dan filter memiliki target sentuh >= `40px` (`44px` pada mobile).
4. **Aksesibilitas Terverifikasi:**
   - `unlabeledBtns = 0`, `inputsNoLabel = 0`, `unassociatedLabels = 0` di seluruh halaman.
   - Seluruh modal memakai `role="dialog"`, `aria-modal="true"`, handler `Escape`, dan fokus terjaga.
   - Urutan heading valid (`<h1>` sebagai judul utama halaman sebelum `<h2>`).
5. **Integritas Finansial Terjaga Penuh:** Seluruh 149+ tes PHPUnit backend & fitur existing tetap lulus tanpa perubahan rumus total, ongkir, pembayaran idempoten, status linier, atau laporan Excel.
