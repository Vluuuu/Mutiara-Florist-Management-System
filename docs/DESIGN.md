# DRAFT DESIGN SYSTEM: Mutiara Florist Management System (MFMS)

- **Status:** **DRAFT (Menunggu Konfirmasi Pilihan Visual Pemilik: Opsi A, Opsi B, atau Opsi C)**
- **Arah Dasar:** *"Warm Florist Ledger & Workshop Desk"*
- **Cakupan:** Fondasi sistem desain bersama serta varian token untuk Opsi A (*Atelier Ledger*), Opsi B (*Meja Kasir Cepat*), dan Opsi C (*Studio Mutiara*). Setelah pemilik memilih satu opsi, bagian token aktif pada dokumen ini dikunci sebelum Phase 9 dimulai.

---

## 1. Identitas, Dial, & Aturan Anti-Slop

- **Prinsip Penggerak:** Antarmuka bekerja seperti buku catatan pesanan dan meja kerja toko bunga yang cepat dipindai, jujur secara akuntansi, dan bebas jargon teknis.
- **Dial Liveliness (per opsi):**
  - Opsi A (*Atelier Ledger*): `ENERGY 2 / RHYTHM 3 / MOTION 1`
  - Opsi B (*Meja Kasir Cepat*): `ENERGY 1 / RHYTHM 2 / MOTION 1`
  - Opsi C (*Studio Mutiara*): `ENERGY 2 / RHYTHM 2 / MOTION 1`
- **Larangan Wajib (Anti-Slop Hard Gate):**
  - Tidak ada karakter em dash (`—`) pada teks UI (R-02).
  - Tidak ada tautan `Blade lama`, `Phase 3.3`, atau status pengembangan di UI operasional.
  - Tidak ada kode enum mentah (`NEW`, `PROCESSING`, `UNPAID`, `POSTED`, `VOIDED`, `order_date`) di label utama operator; seluruh status memakai Bahasa Indonesia yang jelas.
  - Tidak ada angka statistik buatan atau dekorasi ikon/gradien tanpa fungsi hierarki.

---

## 2. Color Tokens & Status Semantik (WCAG AA Terverifikasi)

Seluruh pasangan warna di bawah telah diuji memakai `.agents/skills/antislop-human/contrast-check.py` (minimal `4.5:1` teks normal, `3.0:1` teks besar >= 18px dan batas komponen input).

### 2.1 Token Kanvas & Merek (Tergantung Opsi Terpilih)

| Token CSS | Opsi A (*Atelier Ledger*) | Opsi B (*Meja Kasir Cepat*) | Opsi C (*Studio Mutiara*) | Fungsi |
| :--- | :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#FAF7F2` | `#F7F8F5` | `#FBF9F6` | Latar utama halaman |
| `--bg-rail` | `#F3EFE6` | `#FFFFFF` (Topbar) | `#143326` (Dark Rail) | Permukaan navigasi utama |
| `--bg-surface` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | Permukaan kartu & form |
| `--bg-subtle` | `#F7F4EC` | `#EFF2EC` | `#E6EFEA` / `#FDF2F4` | Panel ringkasan & struk |
| `--ink-main` | `#1C1917` | `#111827` | `#1E2420` | Teks primer (kontras >= `15:1`) |
| `--ink-muted` | `#57534E` | `#4B5563` | `#525B54` | Teks sekunder (kontras >= `6.7:1`) |
| `--primary` | `#163829` | `#123524` | `#143326` | Aksi utama & heading merek |
| `--accent` | `#B44D2B` (`5.20:1`) | `#9A5B06` (`5.42:1`) | `#8C3B4A` (`7.40:1`) | 1 aksen terukur: piutang terbuka / agenda mendesak |
| `--border-soft` | `#D6D0C4` | `#D1D5DB` | `#D6D3CE` | Garis pemisah kartu/tabel |
| `--border-input` | `#78716C` (`4.80:1`) | `#6B7280` (`4.83:1`) | `#6B7280` (`4.83:1`) | Batas input & tombol sekunder (>= `3.0:1`) |

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
- **Skala Tipografi Responsif:**
  - `h1` Halaman: `clamp(1.5rem, 2.5vw, 2rem)` (`24px` mobile -> `32px` desktop), `line-height: 1.2`, bobot `700`. Hanya satu `<h1>` per halaman, tanpa `<h2>` topbar di atasnya.
  - `h2` Seksi/Kartu: `1.125rem - 1.25rem` (`18px - 20px`), bobot `700`.
  - Body & Input: `0.9375rem` (`15px`) atau `0.875rem` (`14px`), minimal `16px` pada input mobile iOS/Android atau cukup jelas agar tidak auto-zoom paksa.
  - Keterangan / Hint: minimal `0.75rem` (`12px`), dilarang teks `< 12px` pada konten informasi utama.
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
  - **Mobile (`< 768px`, diuji pada `390×844`):** 1 kolom penuh, tabel beralih ke **Mobile Card List**, tombol aksi `min-height: 44px`, padding konten `16px`.
  - **Tablet (`768px - 1039px`, diuji pada `768×1024`):** Grid 2 kolom untuk KPI/kartu, tabel ringkas atau kartu 2 kolom agar kolom kanan tidak pernah terpotong, navigasi memakai trigger drawer yang jelas.
  - **Desktop (`>= 1040px`, diuji pada `1440×900`):** Layout kerja 2 kolom asimetris (`minmax(0, 1fr) 340px`) untuk form/detail pesanan agar ringkasan tagihan selalu *sticky* di kanan; maks lebar kontainer `1220px - 1320px`.

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
   - `<Head title="Masuk" />` (tab: `Masuk — MFMS`), hapus tautan Blade fallback, tambahkan toggle lihat/sembunyikan password (`aria-label`), fokus otomatis pada email, dan pesan error throttling/kredensial dalam bahasa jelas.
2. **Dashboard (`/dashboard` & `/ui-dashboard`):**
   - Hapus badge `Phase 3.3 · React` dan kartu `Pengembangan berikutnya`. Samakan props `nav` antara `UiDashboardController` dan `HandleInertiaRequests`.
   - Tampilkan CTA cepat (`+ Buat Pesanan`, `+ Catat Pengeluaran`), Agenda Pengiriman Hari Ini & Besok (dari `OrderItem` dengan `delivery_date` dekat dan belum `DELIVERED`), serta Ringkasan Kas & Piutang yang membedakan jelas `Uang Diterima`, `Piutang Saat Ini`, dan `Selisih Kas Sederhana (Bukan laba bersih akuntansi)`.
3. **Pelanggan Index (`/ui-customers`), Create, Edit, Detail (`/{id}`):**
   - Hapus tombol Blade lama. Index memakai `<ResponsiveDataList>` + search otomatis/debounce ringan + target klik >= `40px`.
   - Detail Pelanggan menampilkan **riwayat pesanan pelanggan tersebut** dan tombol **`+ Buat Pesanan`** (`/ui-orders/create?customer_id={id}`), serta menghapus teks usang `"setelah modul Pesanan tersedia"`. Modal Arsip memakai `<Modal>` standar.
4. **Pesanan Index (`/ui-orders`):**
   - Perbaiki tombol menjadi `+ Buat Pesanan`. Tambah chip filter cepat status (`Semua`, `Baru`, `Diproses`, `Siap Kirim`, `Selesai`). Tampilkan `<OrderCodeBadge>`, ringkasan bunga & jadwal kirim terdekat, serta `<ResponsiveDataList>` pada mobile/tablet.
5. **Pesanan Create (`/ui-orders/create`) & Edit (`/ui-orders/{id}/edit`):**
   - Layout 2 kolom desktop dengan ringkasan tagihan *sticky* di kanan.
   - `<SearchableSelect>` pelanggan (tanpa auto-pilih `customers[0]`), mendukung query `?customer_id=`, serta **Quick-Create Customer Modal** di halaman yang sama.
   - `<CurrencyInput>` pada harga satuan & ongkir; field `Ongkir tambahan` hanya tampil saat mode `Ditagihkan terpisah`; tombol `Duplikat Bunga` per item; ikat 100% `<label htmlFor>` ke `id` unik item.
   - Pada Edit: hapus tampilan `ID #...`, jadikan status item `DELIVERED` sebagai teks statis `"Terkirim (Final)"`, dan beri penanda wajib dinamis pada `Alasan perubahan` bila nominal berubah pada order berbayar.
6. **Pesanan Detail (`/ui-orders/{id}`):**
   - Layout 2 kolom (Item Bunga di kiri + Stepper 4 tahap, Ringkasan Finansial & Riwayat Pembayaran *sticky* di kanan).
   - Satu tombol `+ Catat Pembayaran` (hapus duplikasi). Link nama pelanggan ke profilnya + tampilkan nomor telepon. Perbaiki deskripsi status `Siap kirim` agar membedakan status saat ini vs aksi berikutnya. Modal Pembayaran memakai `<CurrencyInput>`, modal Void memakai `<CharCounterTextarea>` (`x/10 karakter`), dan regenerasi `idempotency_key` saat retry.
7. **Pembayaran & Piutang (`/ui-payments`):**
   - Hapus tombol Blade lama. Tambahkan tombol cepat **`Catat Bayar`** di setiap baris/kartu piutang yang langsung membuka Modal Catat Pembayaran (mengirim ke endpoint `POST /ui-orders/{order}/payments`), di samping tautan `Detail`. Pakai `<ResponsiveDataList>` untuk mobile.
8. **Pengeluaran (`/ui-expenses`, `/create`) & Kategori Biaya (`/ui-expense-categories`):**
   - Perbaiki `UiExpenseController::index()` agar memformat `expense_date` (`d/m/Y`) dan `voided_at` (`d/m/Y H:i` WIB), tidak mengirim UTC ISO. Gunakan `formatRupiah()` pada seluruh nominal. Render error filter tanggal `errors.to`. Ganti modal Void manual dan `window.confirm()` kategori dengan `<Modal>` standar. Beri `aria-label` dan target `>= 40px` pada tombol ubah nama kategori, serta dukung tambah kategori cepat dari form pengeluaran.
9. **Laporan (`/ui-reports`):**
   - Hapus istilah SQL (`kolom order_date`) dan kode enum Inggris `(NEW)`, `(UNPAID)`, dll. Seragamkan `Rp16.470.000` dan `-Rp55.000` dengan `tabular-nums`. Sediakan filter default *"Hanya hari dengan transaksi"* (dengan opsi tampilkan semua hari), format tanggal `dd/mm/yyyy`, kartu harian pada mobile `< 768px`, dan tombol preset filter tinggi >= `40px`.
