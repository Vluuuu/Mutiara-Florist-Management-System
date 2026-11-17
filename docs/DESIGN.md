# DRAFT DESIGN SYSTEM: Mutiara Florist Management System (MFMS)

- **Status:** **PENDING OWNER FINAL DESIGN APPROVAL (Kandidat Utama: Arah 2 *Botanical Studio Workspace* setelah Revisi Phase 8.2)**
- **Arah Dasar:** *"Warm Florist Ledger & Workshop Desk"* (dipadukan dengan riset Shopify Polaris, Material 3, Atlassian, GOV.UK, Square POS, NN/g, serta diselaraskan 1:1 terhadap `OrderRequest`, `OrderService`, dan `PaymentService`)
- **Cakupan:** Token warna terukur WCAG AA, sistem navigasi 5-breakpoint (`360px` s.d. `1440px`), kontrak field form tanpa kehilangan data wajib backend, larangan kode enum mentah di teks UI, serta spesifikasi halaman untuk Phase 9. Bagian token final baru dikunci setelah pemilik memberi persetujuan akhir.

---

## 1. Identitas, Dial, & Aturan Anti-Slop

- **Prinsip Penggerak:** Antarmuka bekerja seperti buku catatan pesanan dan meja kerja toko bunga yang cepat dipindai, jujur secara akuntansi, dan bebas jargon teknis.
- **Dial Liveliness (per opsi):**
  - Opsi A (*Atelier Ledger*): `ENERGY 2 / RHYTHM 3 / MOTION 1`
  - Opsi B (*Meja Kasir Cepat*): `ENERGY 1 / RHYTHM 2 / MOTION 1`
  - Opsi C (*Studio Mutiara*): `ENERGY 2 / RHYTHM 2 / MOTION 1`
- **Larangan Wajib (Anti-Slop Hard Gate):**
  - Tidak ada karakter em dash (`U+2014`) pada teks UI (R-02).
  - Tidak ada tautan `Blade lama`, `Phase 3.3`, atau status pengembangan di UI operasional.
  - Tidak ada kode enum mentah (`NEW`, `PROCESSING`, `UNPAID`, `POSTED`, `VOIDED`, `order_date`) di label utama operator; seluruh status memakai Bahasa Indonesia yang jelas.
  - Tidak ada angka statistik buatan atau dekorasi ikon/gradien tanpa fungsi hierarki.

---

## 2. Color Tokens & Status Semantik (WCAG AA Terverifikasi)

Seluruh pasangan warna di bawah telah diuji memakai `.agents/skills/antislop-human/contrast-check.py` (minimal `4.5:1` teks normal, `3.0:1` teks besar >= 18px dan batas komponen input).

### 2.1 Token Kanvas & Merek (Varian Phase 8.2 Menunggu Persetujuan Pemilik)

| Token CSS | Arah 1 (*Warm Atelier Workspace*) | Arah 2 (*Botanical Studio Workspace* - Rekomendasi) | Fungsi |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#FAF7F2` | `#FBF9F6` | Latar utama halaman |
| `--bg-rail` | `#F5EFE6` | `#143326` (Dark Spruce Rail) | Permukaan sidebar desktop |
| `--bg-surface` | `#FFFFFF` | `#FFFFFF` | Permukaan kartu & form |
| `--bg-sunken` | `#F2ECE3` | `#F1EDE6` | Baki ringkasan & header tabel |
| `--text-primary` | `#1C1917` (`16.37:1`) | `#1E2420` (`15.04:1`) | Teks primer |
| `--text-secondary` | `#57534E` (`7.14:1`) | `#525B54` (`6.70:1`) | Teks sekunder & subjudul |
| `--brand-primary` | `#163829` (`12.87:1`) | `#143326` (`13.71:1`) | Aksi utama & focus ring |
| `--brand-urgent` | `#B44D2B` (`5.20:1`) | `#8C3B4A` (`7.40:1`) | Aksen prioritas/terlambat/void |
| `--border-hairline` | `#E2D9CB` | `#E3DED4` | Garis pemisah kartu/tabel |
| `--border-input` | `#8E8577` (`3.64:1`) | `#858E87` (`3.38:1`) | Batas input & tombol sekunder (lulus WCAG 1.4.11 >= `3.0:1`) |

### 2.2 Status Semantik (Konsisten Lintas Semua Opsi)

1. **Status Pengerjaan Item & Order:**
   - **Baru (`NEW`):** Latar `#E7E5E4`, Teks `#1C1917`.
   - **Diproses (`PROCESSING`):** Latar `#FEF3C7`, Teks `#92400E` (`6.37:1`).
   - **Siap kirim (`READY`):** Latar `#DBEAFE`, Teks `#1E40AF` (`7.15:1`).
   - **Terkirim / Selesai (`DELIVERED` / `COMPLETED`):** Latar `#DCFCE7`, Teks `#166534` (`6.49:1`).
2. **Status Pembayaran & Audit:**
   - **Lunas / Tercatat (`PAID` / `POSTED`):** Latar `#DCFCE7`, Teks `#166534`.
   - **Sebagian (`PARTIAL`):** Latar `#FEF3C7`, Teks `#92400E`.
   - **Belum bayar (`UNPAID`):** Latar `#FFF7ED` / `#FDF2F4`, Teks `#9A3412` / `#8C3B4A`.
   - **Dibatalkan / Void (`VOIDED`):** Latar `#F3F4F6`, Teks `#374151`, nominal dicoret (`<del>`) + blok alasan koreksi.
   - **Error / Destructive:** Latar `#FEE2E2`, Batas `#FCA5A5`, Teks `#991B1B` (`6.80:1`).

---

## 3. Typography & Numerical Styles

- **Keluarga Font (Local-First, Tanpa CDN Wajib):**
  - *Opsi A Heading (`h1`, `h2` bagian):* `Georgia, 'Times New Roman', serif` (memberi suara editorial buku catatan florist yang bekerja offline 100%).
  - *Opsi B & C + Seluruh UI Body/Form/Tabel:* `'Segoe UI', ui-sans-serif, system-ui, -apple-system, sans-serif`.
- **Skala Tipografi Bisnis Profesional (Revisi Phase 8.2):**
  - `h1` Halaman: `Fraunces` atau serif sistem hanya pada judul halaman dengan ukuran terkontrol `clamp(20px, 2.2vw, 25px)` (`20px` mobile -> `25px` desktop), `line-height: 1.25`, `font-weight: 600`, `letter-spacing: -0.015em` agar terasa seperti aplikasi operasional bisnis dan tidak terkesan blog/dekoratif. Hanya satu `<h1>` per halaman.
  - `h2` Seksi/Kartu: Sans-serif `1rem` (`16px`), bobot `700`.
  - Body & Input: `0.9375rem` (`15px`) atau `0.875rem` (`14px`).
  - Keterangan / Hint: minimal `0.75rem - 0.8125rem` (`12px - 13px`).
- **Kepatuhan Bahasa Operator (P1):**
  - Kode teknis internal (`POSTED`, `VOIDED`, `SEPARATE`, `INCLUDED`, `NEW`, `PROCESSING`, `READY`, `DELIVERED`) hanya dipakai di payload/value kode, **tidak pernah** ditampilkan sebagai kata teks kepada operator. Gunakan istilah alami: `Tercatat`, `Dibatalkan`, `Ditagih terpisah`, `Sudah termasuk harga bunga`, `Baru`, `Diproses`, `Siap kirim`, `Terkirim`.
  - Karena `order_items.delivery_date` bertipe `DATE` tanpa jam, dilarang menampilkan klaim jam/menit (`13:00 WIB`, `Lewat 30 mnt`) di antarmuka; gunakan status berbasis tanggal (`Terlambat (16/11/2026)`, `Kirim hari ini (17/11/2026)`).
- **Aturan Angka & Mata Uang (`tabular-nums` Wajib):**
  - Seluruh angka harga, kuantitas, kode pesanan, dan tanggal tabel wajib memakai `font-variant-numeric: tabular-nums`.
  - **Fungsi Tunggal `formatRupiah(amount)`:**
    - Nilai positif/nol: `Rp1.500.000`, `Rp0` (tanpa spasi setelah `Rp`).
    - Nilai negatif: `-Rp55.000` (tanda minus di depan `Rp`, bukan `Rp -55.000`).
  - **Format Tanggal & Zona Waktu:**
    - Tampilan tabel/kartu: `dd/mm/yyyy` (`17/11/2026`) atau `17 Nov 2026` di zona `Asia/Jakarta` (WIB).
    - Dilarang mengirim timestamp UTC ISO mentah (`...T17:00:00.000000Z`) ke antarmuka.

---

## 4. Spacing & Responsive Breakpoints

- **Skala Spasi:** `4px` base grid (`4, 8, 12, 16, 20, 24, 32, 48`).
- **Breakpoints Berbasis Konten (`antislop-layoutmobile`):**
  - **Mobile (`< 768px`, diuji pada `360×780` & `390×844`):** 1 kolom penuh, dilarang memakai inline `grid-template-columns`, tabel beralih ke **Mobile Card List**, tombol aksi `min-height: 44px`, bilah navigasi bawah tepat 4 destinasi (`Hari Ini`, `Pesanan`, `Buat`, `Menu`) dengan `env(safe-area-inset-bottom)` serta padding bawah `164px` agar bilah tidak menutupi tombol/input.
  - **Tablet (`768px - 1023px`, diuji pada `768×1024`):** Grid 2 kolom untuk KPI/kartu, tabel beralih ke kartu `< 900px`, topbar menampilkan tombol `.btn.tablet-menu-btn` (`Menu`) untuk membuka drawer navigasi sekunder & `Keluar Akun`.
  - **Desktop (`>= 1024px`, diuji pada `1024×768` & `1440×900`):** Left sidebar `248px` tampil penuh + `.btn.tablet-menu-btn` disembunyikan. Layout kerja 2 kolom asimetris (`minmax(0, 1.6fr) minmax(300px, 1fr)`) menempatkan ringkasan tagihan + tombol simpan utama *sticky* di kanan (tidak melayang di atas input form).

---

## 5. Spesifikasi Komponen Standar

### 5.1 Button
- Varian: `primary` (aksi utama halaman), `accent` (aksi finansial/mendesak seperti `+ Catat Pembayaran`), `secondary` / `outline`, `danger` (hanya untuk konfirmasi Void/Arsip di modal).
- Ukuran minimum: Desktop `min-h-[40px]` (`44px` untuk CTA utama), Mobile semua tombol/link aksi `min-h-[44px]`.
- Base CSS wajib: `cursor: pointer` pada enabled, `cursor: not-allowed` + `opacity-55` pada disabled, `:focus-visible` ring 3px kontras >= `3:1`.
- Tidak boleh ada simbol `+` ganda (`+ + Buat pesanan`) atau panah dekoratif di setiap tombol.

### 5.2 Input, Select, & `<SearchableSelect>` (Combobox Pelanggan)
- Tinggi minimum `44px`, border `--border-input` (`>= 3:1` kontras terhadap latar), wajib memiliki `<label htmlFor>` yang cocok ke `id` unik.
- **Combobox Pelanggan (`Orders/Create`):**
  - Nilai awal kosong (`""`), placeholder `"Pilih atau cari nama/telepon pelanggan..."`.
  - Pencarian *client-side* instan berdasarkan nama & nomor telepon.
  - Menyediakan tombol `+ Pelanggan Baru` yang membuka modal tanpa mengosongkan form pesanan.

### 5.3 `<CurrencyInput>` (Komponen Wajib untuk Nominal Rupiah)
- **Perilaku:**
  - Menerima `value: number | null` (integer Rupiah) dan `onChange(intValue: number | null)`.
  - Input type `text` dengan `inputMode="numeric"` agar keyboard angka muncul di smartphone dan pemisah titik ribuan (`650.000`) tampil langsung saat mengetik.
  - Default untuk field harga baru: kosong (`""`) dengan placeholder `"Contoh: 500.000"` (bukan angka `0` yang menyulitkan penghapusan digit).
  - Menyimpan/mengirim integer murni ke payload Inertia (`650000`) tanpa titik.

### 5.4 `<Modal>` (Komponen Dialog Aksesibel Tunggal)
- Memakai native `<dialog>` atau kontainer terkontrol dengan `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- Menangani: `Escape` untuk menutup (kecuali saat request sedang berjalan `isSubmitting`), tombol tutup `X` ber-`aria-label="Tutup"`, *focus trap* `Tab`/`Shift+Tab`, dan mengembalikan fokus ke tombol pemicu saat ditutup.
- Membersihkan error modal lokal saat ditutup/dibuka ulang.

### 5.5 `<Badge>` & `<OrderCodeBadge>`
- `<Badge>` selalu memadukan warna + teks bahasa Indonesia (bukan warna saja, tidak ada kapsul glow/pulsing dot).
- `<OrderCodeBadge>` menampilkan format ringkas mudah dibaca (`MF-261117 · #XY7ETE`) dengan tombol salin kode lengkap jika dibutuhkan, tanpa memecah lebar tabel/mobile.

### 5.6 `<ResponsiveDataList>` (Table Desktop & Mobile Card)
- **Desktop (`>= 1040px` atau tabel sempit `>= 768px`):** `<table>` semantik dengan `tabular-nums`, `whitespace-nowrap` pada kolom harga/tanggal, dan area klik baris atau tombol aksi minimal `38–40px`.
- **Mobile & Tablet Sempit (`< 768px` / `< 1040px` untuk tabel > 4 kolom):** Dirender sebagai daftar `<article>` kartu berjarak `12px`, menampilkan judul item, badge status, nilai Rupiah mencolok, dan tombol aksi penuh lebar `min-h-[44px]`. **Zero horizontal overflow.**

---

## 6. Form Validation, Feedback & UI States

### 6.1 Validasi Bahasa Indonesia
- Seluruh `FormRequest` di `app/Http/Requests/` wajib menyediakan `messages()` dan `attributes()` Bahasa Indonesia.
- Untuk error array item pesanan (`items.{i}.{field}`), pesan dipetakan ke label manusia: misalnya `"Bunga #1: Jenis bunga wajib diisi."` (dilarang menampilkan `items.0.flower_type`).
- Pada `Orders/Edit`, jika order sudah menerima pembayaran (`received > 0`) dan nilai item/ongkir diubah secara live, field `Alasan perubahan` otomatis menampilkan indikator **Wajib diisi karena nominal pesanan berubah**.

### 6.2 Empat State Wajib di Setiap Halaman Data (R-27)
1. **Empty State (Data Kosong vs Hasil Filter Kosong):**
   - Kosong awal: jelaskan sebabnya + 1 CTA langsung (`"Belum ada pelanggan. Tambahkan pelanggan pertama untuk mulai mencatat pesanan."` + tombol `+ Tambah Pelanggan`).
   - Filter kosong: jelaskan kata kunci/filter tidak cocok + 1 tombol `Reset Filter`.
2. **Loading State:**
   - Tombol submit menampilkan spinner + teks progres spesifik (`"Menyimpan pesanan..."`, `"Memproses pembayaran..."`) dan terkunci (`disabled`) agar tidak terjadi double-submit; navigasi Inertia memakai progress bar atas.
3. **Error State:**
   - Ringkasan error di atas form (dengan `role="alert"`) + pesan error spesifik tepat di bawah field terkait (`aria-describedby`).
   - Penjelasan eksplisit bila tombol aksi dinonaktifkan (misal: *"Isi minimal 1 item bunga dengan harga > Rp0"* atau counter *"7/10 karakter minimum"* pada modal Void).
4. **Success State:**
   - Flash banner di `AppLayout` di-key secara unik per pesan/navigasi agar selalu muncul setelah aksi berulang pada halaman yang sama, serta dapat ditutup dengan tombol ber-`aria-label`.

---

## 7. Interaction Patterns & Keyboard Accessibility

- **Urutan Tab & Skip Link:** `Langsung ke konten utama` -> Navigasi -> Konten utama (`<h1>` pertama).
- **Navigasi Keyboard Penuh:** Seluruh item drawer, modal, combobox, toggle ongkir (`aria-pressed`), dan filter chip dapat dioperasikan dengan `Tab`, `Enter`, `Space`, dan `Escape`.
- **Prefers Reduced Motion:** Semua transisi non-esensial dimatikan di bawah `@media (prefers-reduced-motion: reduce)`.

---

## 8. Spesifikasi Desain Tiap Halaman (Untuk Phase 9)

1. **Login (`/login`):**
   - `<Head title="Masuk" />` (tab: `Masuk - MFMS`), hapus tautan Blade fallback, tambahkan toggle lihat/sembunyikan password (`aria-label`), fokus otomatis pada email, dan pesan error throttling/kredensial dalam bahasa jelas.
2. **Dashboard (`/dashboard` & `/ui-dashboard`):**
   - Pada mobile (`< 768px`), urutan visual mendahulukan **Antrean Kiriman Terlambat & Hari Ini** dan **Piutang Belum Lunas** di atas ringkasan KPI 2x2 agar operator kurir/kasir tidak perlu menggulir melewati 4 kartu statistik terlebih dahulu.
   - Hapus badge `Phase 3.3 · React` dan kartu `Pengembangan berikutnya`. Samakan props `nav` antara `UiDashboardController` dan `HandleInertiaRequests`. Catatan Phase 9: perlu query read-only tambahan di `DashboardService` untuk mengirim antrean `delivery_date` dan daftar piutang teratas.
3. **Pelanggan Index (`/ui-customers`), Create, Edit, Detail (`/{id}`):**
   - Sesuai `CustomerRequest`: `name` wajib, `phone` & `notes` opsional. Detail Pelanggan menampilkan **riwayat pesanan pelanggan** dan tombol **`+ Buat Pesanan`** (`/ui-orders/create?customer_id={id}`).
4. **Pesanan Index (`/ui-orders`):**
   - Perbaiki tombol menjadi `+ Buat Pesanan`. Tambah chip filter cepat status (`Semua`, `Belum Lunas`, `Siap Kirim`, `Diproses`). `<ResponsiveDataList>` pada mobile/tablet.
5. **Pesanan Create (`/ui-orders/create`) & Edit (`/ui-orders/{id}/edit`):**
   - **Tepat 1 tombol utama `Simpan Pesanan` per ukuran layar** (di dalam panel kanan *sticky* pada `>= 1024px`; di bilah simpan bawah pada `< 1024px`). Dilarang menampilkan tombol test/validasi dummy pada form produksi.
   - Seluruh field wajib `OrderRequest` tetap terpisah (tidak boleh digabung): `customer_id`, `order_date`, `notes`, `change_reason` (muncul saat Edit order berbayar), dan per item `flower_type`, `recipient`, `sender_name`, `delivery_date`, `delivery_location`, `quantity`, `unit_price`, `shipping_mode` (tampil `Ditagih terpisah` / `Sudah termasuk harga bunga`), `shipping_fee` (`Rp0` saat termasuk harga, wajib `> Rp0` saat ditagih terpisah), serta `notes` item.
   - `<SearchableSelect>` pelanggan tanpa auto-pilih, modal **+ Pelanggan Baru** tanpa menghapus item draf, dan tombol `Duplikat Item` per baris.
6. **Pesanan Detail (`/ui-orders/{id}`):**
   - Layout 2 kolom (Item Bunga di kiri + Stepper 4 tahap, Ringkasan Finansial & Riwayat Pembayaran di kanan).
   - Aksi final **`Tandai Terkirim`** wajib memicu **Modal Konfirmasi** (`Status Terkirim bersifat final dan tidak dapat dikembalikan`). Tombol `Salin Ringkasan WA` menyalin teks nota aktual ke clipboard dengan panel pratinjau manual fallback.
   - Modal Void wajib validasi minimal **10 karakter** (`VoidPaymentRequest`) lengkap counter `x/10 karakter minimum`.
7. **Pembayaran & Piutang (`/ui-payments`):**
   - Utamakan daftar **Tagihan Belum Lunas (Piutang Aktif)** di bagian teratas (`Order No`, `Pelanggan`, `Total`, `Terbayar`, `Sisa Tagihan`, tombol langsung `Catat Bayar` dan `Detail`), sesuai kontrak `UiPaymentController::index()`. Riwayat transaksi `Tercatat`/`Dibatalkan` disajikan sebagai seksi/tab sekunder terpisah di bawahnya agar audit tetap mudah ditemukan.
8. **Pengeluaran (`/ui-expenses`, `/create`) & Kategori Biaya (`/ui-expense-categories`):**
   - Perbaiki `UiExpenseController::index()` agar memformat `expense_date` (`d/m/Y`) dan `voided_at` (`d/m/Y H:i` WIB), tidak mengirim UTC ISO. Gunakan `formatRupiah()` pada seluruh nominal. Render error filter tanggal `errors.to`. Ganti modal Void manual dan `window.confirm()` kategori dengan `<Modal>` standar. Beri `aria-label` dan target `>= 40px` pada tombol ubah nama kategori, serta dukung tambah kategori cepat dari form pengeluaran.
9. **Laporan (`/ui-reports`):**
   - Hapus istilah SQL (`kolom order_date`) dan kode enum Inggris `(NEW)`, `(UNPAID)`, dll. Seragamkan `Rp16.470.000` dan `-Rp55.000` dengan `tabular-nums`. Sediakan filter default *"Hanya hari dengan transaksi"* (dengan opsi tampilkan semua hari), format tanggal `dd/mm/yyyy`, kartu harian pada mobile `< 768px`, dan tombol preset filter tinggi >= `40px`.
