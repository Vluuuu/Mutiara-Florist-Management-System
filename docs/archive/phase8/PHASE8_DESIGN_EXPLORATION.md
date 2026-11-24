# Phase 8: Anti-Slop Design Exploration & Option Comparison
**Mutiara Florist Management System (MFMS)**

- **Branch:** `design/phase8-antislop-system` (dibuat dari baseline `audit/phase7-ui-ux` `f16a861`, karena PR #6 pada `origin/main` masih berstatus OPEN; `main` tidak diubah)
- **Status:** **Menunggu Pemilihan Pemilik** (DESIGN FIRST, belum diimplementasikan ke codebase React produksi)
- **Skill Anti-Slop Terpasang (Project Scope `.agents/skills/`):** `antislop` (core v3.2.30), `antislop-ui`, `antislop-human`, `antislop-layoutmobile`, `antislop-copywriting`. Terverifikasi lewat `contrast-check.py --selftest` (`9 reference pairs OK`).

---

## 1. Tiga Opsi Desain yang Dieksplorasi

Ketiga opsi dibangun dari arah dasar **"Warm Florist Ledger & Workshop Desk"** dan data sintetis Phase 7, namun sengaja dibedakan pada **arsitektur navigasi**, **karakter tipografi**, **palet aksen**, dan **pola mobile**:

| Aspek | Opsi A: **Atelier Ledger** ("Buku Pesanan Bengkel") | Opsi B: **Meja Kasir Cepat** ("Workshop Desk") | Opsi C: **Studio Mutiara** ("Botanical Atelier Split") |
| :--- | :--- | :--- | :--- |
| **Konsep Visual** | Buku register toko bunga klasik: kertas gading hangat (`#FAF7F2`), rail krem (`#F3EFE6`), tinta hijau pinus (`#163829`), aksen terakota (`#B44D2B`) | Meja kasir berkecepatan tinggi: kanvas putih-krem bersih (`#F7F8F5`), garis atas hutan tegas (`#123524`), aksen kuningan/ochre (`#9A5B06`) | Studio bunga modern berkontras: sidebar botani gelap penuh (`#143326`), kertas hangat (`#FBF9F6`), aksen mawar tua (`#8C3B4A`) |
| **Arsitektur Desktop** | Rail samping kiri ramping (`236px`) dikelompokkan *Operasional* vs *Pembukuan* + 2 kolom asimetris | **Top Horizontal Workspace Bar** tanpa sidebar permanen, memberi lebar penuh (`1320px`) untuk form padat & split queue | **Dark Botanical Left Rail** (`244px`) membingkai kanvas studio terang + overview band kas & tabel/kartu |
| **Tipografi** | Heading serif editorial (`Georgia`) + body sans-serif + `tabular-nums` | Sans-serif tegas berbobokan tinggi + `tabular-nums` | Sans-serif modern kontras + `tabular-nums` + aksen kartu blush/sage |
| **Navigasi Mobile (`390×844`)** | Topbar ringkas + **Bottom Bar 4 pintasan** (`Hari Ini`, `Buat Order`, `Detail`, `Menu`) + Drawer slide-over | Topbar ringkas (`+ Pesanan` + `Menu`) membuka **Sheet Drawer** full-height tanpa bottom bar | Topbar botani gelap (`#143326`) + `+ Pesanan` + `Menu` membuka **Dark Drawer** serasi |
| **Dial Liveliness** | `ENERGY 2 / RHYTHM 3 / MOTION 1` | `ENERGY 1 / RHYTHM 2 / MOTION 1` | `ENERGY 2 / RHYTHM 2 / MOTION 1` |
| **Prototipe Interaktif** | [option-a-atelier-ledger.html](design-options/option-a-atelier-ledger.html) | [option-b-workshop-desk.html](design-options/option-b-workshop-desk.html) | [option-c-studio-mutiara.html](design-options/option-c-studio-mutiara.html) |

---

## 2. Bukti Visual Desktop (`1440×900`) & Mobile (`390×844`)

### Opsi A: Atelier Ledger
- **Desktop (`1440×900`):** [Dashboard](design-options/screenshots/opt-a-dashboard-desktop.png) · [Buat Pesanan](design-options/screenshots/opt-a-order-create-desktop.png) · [Detail Pesanan](design-options/screenshots/opt-a-order-detail-desktop.png)
- **Mobile (`390×844`):** [Dashboard](design-options/screenshots/opt-a-dashboard-mobile.png) · [Drawer Menu](design-options/screenshots/opt-a-mobile-drawer.png) · [Buat Pesanan](design-options/screenshots/opt-a-order-create-mobile.png) · [Detail Pesanan](design-options/screenshots/opt-a-order-detail-mobile.png)

### Opsi B: Meja Kasir Cepat
- **Desktop (`1440×900`):** [Dashboard](design-options/screenshots/opt-b-dashboard-desktop.png) · [Buat Pesanan](design-options/screenshots/opt-b-order-create-desktop.png) · [Detail Pesanan](design-options/screenshots/opt-b-order-detail-desktop.png)
- **Mobile (`390×844`):** [Dashboard](design-options/screenshots/opt-b-dashboard-mobile.png) · [Drawer Menu](design-options/screenshots/opt-b-mobile-drawer.png) · [Buat Pesanan](design-options/screenshots/opt-b-order-create-mobile.png) · [Detail Pesanan](design-options/screenshots/opt-b-order-detail-mobile.png)

### Opsi C: Studio Mutiara
- **Desktop (`1440×900`):** [Dashboard](design-options/screenshots/opt-c-dashboard-desktop.png) · [Buat Pesanan](design-options/screenshots/opt-c-order-create-desktop.png) · [Detail Pesanan](design-options/screenshots/opt-c-order-detail-desktop.png)
- **Mobile (`390×844`):** [Dashboard](design-options/screenshots/opt-c-dashboard-mobile.png) · [Drawer Menu](design-options/screenshots/opt-c-mobile-drawer.png) · [Buat Pesanan](design-options/screenshots/opt-c-order-create-mobile.png) · [Detail Pesanan](design-options/screenshots/opt-c-order-detail-mobile.png)

---

## 3. Evaluasi Komparatif (8 Kriteria)

| Kriteria Audit | Opsi A (Atelier Ledger) | Opsi B (Meja Kasir Cepat) | Opsi C (Studio Mutiara) |
| :--- | :--- | :--- | :--- |
| **1. Kejelasan Hierarki Informasi** | **Sangat Baik.** Agenda kirim hari ini/besok dominan di kiri; buku kas & piutang terpisah rapi di kanan. | **Sangat Baik.** Strip kas 4 kotak proporsional di atas, diikuti antrean workshop vs piutang sejajar. | **Baik.** Band arus kas & piutang sangat jelas, diikuti tabel jadwal pengiriman terdekat. |
| **2. Kecepatan Menemukan Aksi Utama** | `+ Buat Pesanan` di header desktop, di topbar mobile, dan tab bawah mobile (1 ketukan). | `+ Pesanan` selalu menempel di topbar sticky pada desktop & mobile; tombol `Bayar` langsung di daftar piutang. | `+ Buat Pesanan` menonjol dalam warna rose-plum di header desktop & mobile. |
| **3. Keterbacaan Nominal & Tanggal** | Serif heading + `tabular-nums`, format konsisten `Rp...` dan `dd/mm/yyyy`. | Sangat tinggi kontrasnya (sampai `17.74:1`), padat, dan cepat dipindai di meja kasir. | Sangat baik; kartu blush memisahkan piutang secara visual tanpa bising. |
| **4. Kualitas Navigasi Mobile** | Paling lengkap untuk 1 tangan (bottom tab bar + drawer ber-scroll + `Keluar` tampak), namun bottom bar mengambil ~60px bawah. | Bersih & hemat ruang layar vertikal pada form panjang; sheet drawer kanan menutup via `Escape`. | Header botani gelap konsisten dengan desktop; tabel otomatis berubah menjadi kartu mobile. |
| **5. Konsistensi Komponen** | Tinggi: toggle segmen ongkir, modal `<dialog>`, kartu tiket seragam. | Tinggi: grid padat 3-kolom, tombol tegas, input ringkas. | Tinggi: kartu kertas & panel blush/sage konsisten. |
| **6. Identitas Visual Mutiara Florist** | **Paling Khas Florist:** Kertas gading, serif hangat, hijau pinus, dan terakota terasa seperti toko bunga artisanal. | Terasa seperti **alat kasir cepat**, sangat efisien tetapi karakter botani/floristnya lebih subtil. | **Kuat & Modern:** Kontras hijau botani gelap + mawar tua memberi kesan studio bunga profesional. |
| **7. Aksesibilitas (WCAG AA + Keyboard)** | Semua pasangan >= `5.20:1`, label terikat, `Escape` tutup drawer & modal, mobile target >= `44px`. | Semua pasangan >= `5.42:1`, kontras tertinggi, label terikat, mobile target >= `44px`. | Semua pasangan >= `6.70:1`, kontras tinggi di rail gelap maupun kertas terang, mobile target >= `44px`. |
| **8. Anti-Slop Verdict** | **PASS** (100% gate terverifikasi) | **PASS** (100% gate terverifikasi) | **PASS** (100% gate terverifikasi) |

---

## 4. Laporan Anti-Slop Delivery Gate (PASS / FAIL)

Seluruh pengecekan dijalankan langsung pada file prototipe interaktif melalui `agent-browser` (1440×900 & 390×844) serta `.agents/skills/antislop-human/contrast-check.py`.

### Verifikasi Kontras Warna (`contrast-check.py`)
- **Opsi A:** `#1C1917` on `#FAF7F2` = **16.37:1** (PASS) · `#57534E` on `#FAF7F2` = **7.14:1** (PASS) · `#FFFFFF` on `#163829` = **12.87:1** (PASS) · `#FFFFFF` on `#B44D2B` = **5.20:1** (PASS) · `#9A3412` on `#FFF7ED` = **6.88:1** (PASS).
- **Opsi B:** `#111827` on `#F7F8F5` = **16.64:1** (PASS) · `#4B5563` on `#F7F8F5` = **7.09:1** (PASS) · `#FFFFFF` on `#123524` = **13.46:1** (PASS) · `#FFFFFF` on `#9A5B06` = **5.42:1** (PASS) · `#854D0E` on `#FEF9C3` = **6.38:1** (PASS).
- **Opsi C:** `#1E2420` on `#FBF9F6` = **15.04:1** (PASS) · `#FFFFFF` on `#143326` = **13.71:1** (PASS) · `#D1E2D8` on `#143326` = **10.18:1** (PASS) · `#143326` on `#E6EFEA` = **11.69:1** (PASS) · `#FFFFFF` on `#8C3B4A` = **7.40:1** (PASS).

### Verifikasi Interaktif & Responsif (`agent-browser`)
- **Opsi A (`option-a-atelier-ledger.html`):**
  - Hard Gate: `R-02` PASS (`hasEmDash: false`), `R-03` PASS (`overflowX: false` pada 1440px & 390px; seluruh kontrol interaktif tampak >= `44px`), `R-24/R-26` PASS (tab switcher, shipping toggle, quick-customer modal, fulfillment modal, pay modal, drawer `Escape` -> `DRAWER_ESC_CLOSED: false`), `R-25` PASS, `R-32/R-39` PASS (`unlabeledBtns: 0`, `inputsNoLabel: 0`, `cursor: pointer`, `:focus-visible`, `prefers-reduced-motion`).
  - Purpose-Gate & Liveliness: Dial `ENERGY 2 / RHYTHM 3 / MOTION 1` konsisten; 1 aksen terakota hanya untuk urgensi/piutang; **PASS**.
- **Opsi B (`option-b-workshop-desk.html`):**
  - Hard Gate: `R-02` PASS (`hasEmDash: false`), `R-03` PASS (`overflowX: false` pada 1440px & 390px; setelah perbaikan CSS `.mobile-only-menu` dan `.btn-sm` 44px di mobile), `R-24/R-26/R-32/R-39` PASS (`unlabeledBtns: 0`, `inputsNoLabel: 0`, `DRAWER_ESC_CLOSED: false`).
  - Purpose-Gate & Liveliness: Dial `ENERGY 1 / RHYTHM 2 / MOTION 1` konsisten; **PASS**. *(Catatan minor evaluasi: pada 1024–1150px, topbar dengan 7 item perlu diuji agar tidak membungkus saat implementasi React penuh).*
- **Opsi C (`option-c-studio-mutiara.html`):**
  - Hard Gate: `R-02` PASS (`hasEmDash: false`), `R-03` PASS (`overflowX: false` pada 1440px & 390px; tabel desktop otomatis beralih menjadi kartu mobile), `R-24/R-26/R-32/R-39` PASS (`unlabeledBtns: 0`, `inputsNoLabel: 0`, `DRAWER_ESC_CLOSED: false`).
  - Purpose-Gate & Liveliness: Dial `ENERGY 2 / RHYTHM 2 / MOTION 1` konsisten; **PASS**.

---

## 5. Rekomendasi Analitis untuk Pemilik (Belum Diputuskan Sepihak)

1. **Rekomendasi Utama: Opsi A (*Atelier Ledger*) — atau Hibrida Opsi A + Elemen Tabel/Kartu Opsi C:**
   - **Alasan operasional:** Toko bunga bekerja dengan jadwal pengiriman fisik harian dan pencatatan pesanan multi-item. Opsi A memberi keseimbangan terbaik antara **identitas khas Mutiara Florist** (kertas gading + serif + terakota yang hangat dan mudah dibedakan dari SaaS generik) dan **efisiensi kerja** (agenda kirim jadi fokus utama dashboard, form pesanan 2 kolom dengan ringkasan struk sticky + toggle ongkir bersih, serta bottom bar mobile yang membuat operator HP cukup 1 ketukan jempol ke `Hari Ini`, `Buat Order`, atau `Menu`).
2. **Kapan Memilih Opsi B (*Meja Kasir Cepat*):**
   - Pilih Opsi B jika prioritas tertinggi toko adalah **desktop kasir berkecepatan maksimal** dengan lebar layar penuh untuk form multi-item dan daftar antrean sejajar tanpa sidebar samping.
3. **Kapan Memilih Opsi C (*Studio Mutiara*):**
   - Pilih Opsi C jika pemilik menginginkan **kontras visual studio butik yang tegas** (sidebar botani gelap permanen) tanpa serif dan tanpa bottom bar di mobile.

**Langkah Selanjutnya:** Pemilik meninjau visual dan memilih **Opsi A**, **Opsi B**, atau **Opsi C** (atau penyesuaian spesifik) sebelum Phase 9 mengimplementasikan desain ke aplikasi React/Inertia.
