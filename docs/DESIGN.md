# DESIGN SYSTEM: Mutiara Florist Management System (MFMS)

- **Status:** **ACTIVE DIRECTION (Calm Botanical Workspace)**
- **Arah Dasar:** **Calm Botanical Workspace ("Ruang Kerja Operasional Florist Mutiara")** (latar kertas hangat `#F7F3EC`, permukaan bersih `#FFFDF9`, hijau botani `#182920`/`#1D3B2A` sebagai jangkar merek dan aksi utama, warna peringatan terakota `#9A3B22` khusus kondisi mendesak, serta warna okera hangat `#8F4B1E` khusus arus biaya/kas keluar agar tidak bercampur dengan peringatan piutang).
- **Design Read:** Reading this as: Calm, Restrained Florist Operations & Financial Ledger for Indonesian flower shop staff and senior operators, in a Clean Warm Paper, Botanical Cypress & Typographic Hierarchy language, dial `ENERGY 2 / RHYTHM 3 / MOTION 1`.
- **Referensi Sejarah Sebelumnya:** Diarsipkan pada `docs/phase8-2/direction-2-botanical-studio.html`, `docs/PHASE8_DESIGN_EXPLORATION.md`, dan `docs/PHASE8_2_DESIGN_COMPARISON.md`.

---

## 1. Identitas, Dial, & Prinsip Ramah Operator (`R-01` .. `R-40`)

- **Tipografi Ramah Orang Tua:** Semua judul (`h1`, `h2`, `h3`), label form, tombol, dan nominal memakai **Plus Jakarta Sans Variable** yang bersih, jelas, tanpa huruf sambung/serif hiasan, dengan `tabular-nums` agar nominal Rupiah lurus dan cepat dibaca. Ukuran teks utama `15px–16px` dan label/keterangan minimal `13px–14px`.
- **Alur Kerja Alami & Bebas Penumpukan Teks:** Kalimat penjelas diringkas, ruang kosong (*whitespace*) diperluas, dan tombol tambah rangkaian berikutnya pada formulir pesanan diletakkan **selebar penuh tepat di bawah kartu rangkaian (di luar kartu item)** agar alur mengisi atas-ke-bawah mengalir alami.
- **Simetri & Paginasi Jelas:** Kotak pencarian sejajar lurus dengan tombol `Cari` (`h-11` / `44px`), seluruh tombol aksi berpasangan berimbang, dan kontrol paginasi kiri/kanan (`Sebelumnya` / nomor halaman / `Berikutnya`) selalu tampil jelas di bawah daftar selama data ada.
- **Dial Liveliness Terkunci:** `ENERGY 2 / RHYTHM 3 / MOTION 1`.
- **Prinsip Pengendalian Warna & Hierarki (*Calm Botanical*):**
  - Maksimal 4 KPI utama pada strip ringkasan menggunakan permukaan seragam `#FFFDF9` dan angka `#1C211E` (tanpa latar warna-warni per kotak).
  - Konsistensi makna warna lintas halaman & grafik: **Nilai Pesanan** = abu batu tulis (`#545852`), **Kas Masuk (POSTED)** = hijau botani (`#1D3B2A`), **Kas Keluar (POSTED)** = okera hangat (`#8F4B1E`), **Siap Kirim** = biru batu (`#193F66`), dan **Terlambat / Belum Lunas** = terakota terukur (`#9A3B22` / `#8A2619`, tidak pernah mewarnai seluruh kartu dengan blok merah).
  - *Progressive disclosure* untuk rincian padat (tabel angka di Laporan) dan pengelompokan item per nota yang ringkas pada antrean kerja.
- **Larangan Wajib (Hard Gate):**
  - Tidak ada karakter em dash (`U+2014`) di teks UI maupun dokumentasi (`R-02`).
  - Tidak ada awalan simbol AI-slop (`■`, `◆`, `▲`, `○`), titik dekoratif pada tag status, maupun label gabungan garis miring (`Lunas / Selesai / Tercatat`, `Cicilan / DP`).
  - Tidak ada pil dekoratif ("Pelanggan Aktif", "Setiap item punya status...", "Sheet Excel...") maupun kotak monogram `"M"` buatan (`R-23`).

### 1.1 Alasan Keputusan Desain Satu Baris (`R-31`)

1. **Kertas Katun Hangat (`#F7F3EC`) & Lembar Gading (`#FFFDF9`):** Mengurangi silau putih murni bagi mata operator toko yang bekerja seharian penuh.
2. **Tinta Cemara Tua (`#182920` / `#1D3B2A`):** Memberi kontras tombol utama dan navigasi desktop di atas `12:1` tanpa kesan gelap generik.
3. **Satu Aksen Terukur Terakota (`#9A3B22`):** Mengarahkan perhatian operator seketika pada satu prioritas mendesak (piutang terbuka atau jadwal terlambat).
4. **Tipografi Bersih *Plus Jakarta Sans Variable* + *JetBrains Mono Variable*:** Dibundel lokal via Vite agar bekerja 100% offline dan sangat mudah dibaca oleh pengguna lanjut usia (`>= 1.25x` skala judul ke isi).
5. **Simetri Pencarian, Tombol Aksi, & Paginasi Selalu Terlihat:** Menyatukan tinggi kontrol (`44px`), radius seragam (`8px`), menyelaraskan kolom cari dan tombol aksi sebaris, serta menampilkan navigasi halaman kiri/kanan pada seluruh tabel daftar.
6. **Label Status Profesional Buku Pembukuan (`rounded-[4px]`, Border `1px`, Tanpa Titik/Simbol):** Membedakan status melalui teks singkat satu-arti (`Baru`, `Diproses`, `Siap Kirim`, `Terkirim`, `Selesai`, `Belum Lunas`, `Dibayar Sebagian`, `Lunas`, `Tercatat`, `Dibatalkan`, `Aktif`, `Nonaktif`) pada tag persegi bersih berukuran `13px`.
7. **Alur Formulir Pesanan Atas-ke-Bawah + Wordmark Tipografi Murni (`Mutiara Florist`):** Tiap rangkaian menempati kartu tersendiri dengan satu tombol panjang penuh tepat di bawahnya untuk menambah rangkaian kedua, tanpa kotak inisial buatan (`R-23`).

---

## 2. Color Tokens & Status Semantik (WCAG AA Terverifikasi)

| Token CSS | Nilai Terkunci | Rasio Kontras Terukur | Fungsi |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#F7F3EC` | - | Kertas katun latar utama halaman |
| `--bg-surface` | `#FFFDF9` | - | Lembar gading kartu kerja, modal, tabel & input |
| `--bg-sunken` | `#EFE9DE` | - | Baki ringkasan linen & header tabel pembukuan |
| `--bg-rail` | `#182920` | - | Punggung jilid sidebar desktop (`>= 1024px`) |
| `--bg-rail-hover` | `#233B2E` | - | Hover item navigasi pada punggung cemara |
| `--bg-rail-active` | `#F2ECE1` | `12.97:1` vs `#182920` | Tab aktif sidebar (plus titik terakota) |
| `--text-primary` | `#1C211E` | `14.77:1` (`#F7F3EC`) / `16.08:1` (`#FFFDF9`) | Teks primer, nominal & heading |
| `--text-secondary` | `#545852` | `6.56:1` (`#F7F3EC`) / `7.14:1` (`#FFFDF9`) | Teks sekunder, subjudul & label kolom |
| `--text-placeholder` | `#60645E` | `5.94:1` vs `#FFFDF9` | Placeholder input solid |
| `--text-on-rail` | `#F5F1E8` | `13.53:1` vs `#182920` | Teks menu sidebar desktop |
| `--text-on-rail-muted` | `#B8C6BD` | `8.61:1` vs `#182920` | Label grup & peran operator pada sidebar |
| `--brand-primary` | `#1D3B2A` | `12.08:1` vs `#FFFDF9` | CTA utama, focus ring `3px`, & batas aktif |
| `--brand-urgent` | `#9A3B22` | `6.84:1` vs `#FFFDF9` | Segel Terakota: CTA mendesak/piutang/terlambat |
| `--danger-ink` | `#8A2619` | `8.71:1` vs `#FFFDF9` | Tombol pembatalan destruktif |
| `--border-hairline` | `#DED6C8` | - | Garis pemisah lembar, tabel, & seksi `divide-y` |
| `--border-input` | `#7D776C` | `4.37:1` (`#FFFDF9`) / `4.02:1` (`#F7F3EC`) | Batas input form & tombol sekunder (`>= 3.0:1`) |

### 2.1 Tag Status Profesional (`rounded-[4px]`, Border `1px`, Tanpa Titik/Simbol)

- **Baru (`Baru`, `Dibatalkan`, `Nonaktif`):** Latar `#EFE9DE`, Border `#CCC3B3`, Teks `#3D3A35` (`9.37:1`).
- **Diproses / Sebagian (`Diproses`, `Dibayar Sebagian`, `Hari Ini`):** Latar `#FAF1E1`, Border `#DFC393`, Teks `#6E3D09` (`8.03:1`).
- **Siap Kirim (`Siap Kirim`):** Latar `#EDF3F8`, Border `#B5CAE0`, Teks `#193F66` (`9.66:1`).
- **Terkirim / Lunas / Tercatat (`Terkirim`, `Selesai`, `Lunas`, `Tercatat`, `Aktif`):** Latar `#EEF5F0`, Border `#B8D0C0`, Teks `#164B2A` (`9.14:1`).
- **Belum Lunas / Terlambat (`Belum Lunas`, `Terlambat`):** Latar `#FCECE9`, Border `#E2B3AA`, Teks `#8A2619` (`7.72:1`).

---

## 3. Tipografi, Ukuran Kontrol, & Breakpoints

- **Font Utama (`--font-display` & `--font-sans`):** `'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', 'Segoe UI', ui-sans-serif, system-ui, sans-serif` (`tabular-nums`).
- **Font Kode Nota (`--font-mono`):** `'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace`.
- **Ukuran Nyaman Mata:** `h1` `clamp(26px, 2.2vw, 30px)` Bold, `h2` `19px` Bold, isi & input `15px–16px`, tombol minimal tinggi `44px` (`h-11`, `rounded-[8px]`, `14px–15px`).
- **Format Rupiah & WIB:** Integer Rupiah (`Rp1.500.000`, `Rp0`), zona waktu `Asia/Jakarta` (WIB).
- **Breakpoints (`390x844` Mobile, `768x1024` Tablet, `1440x900` Desktop):** Bebas horizontal overflow, target sentuh minimal `44x44px`, bilah navigasi bawah mobile 4 tujuan (`Hari Ini`, `Pesanan`, `Buat`, `Menu`).
