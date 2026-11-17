# Phase 8.2 Anti-Slop & Usability QA Report

Tanggal: 17 November 2026
Branch: `design/phase8-human-centered-refinement`
Tools Verifikasi:
- `.agents/skills/antislop-human/contrast-check.py` (WCAG 2.x)
- `agent-browser` CLI v0.43.0 (Chromium nyata lintas 5 ukuran viewport)
- Inspeksi visual PNG langsung dan pembacaan header PNG (`IHDR` width x height)

---

## 1. Status Aktivasi Skill Anti-Slop (`.agents/skills/`)

Seluruh 5 skill proyek terverifikasi terbaca di repositori:
- `.agents/skills/antislop/SKILL.md` (`53,762` byte)
- `.agents/skills/antislop-ui/SKILL.md` (`30,486` byte)
- `.agents/skills/antislop-human/SKILL.md` (`15,921` byte)
- `.agents/skills/antislop-layoutmobile/SKILL.md` (`16,382` byte)
- `.agents/skills/antislop-copywriting/SKILL.md` (`27,974` byte)

Self-test contrast checker:
- Perintah: `python .agents/skills/antislop-human/contrast-check.py --selftest`
- Hasil: `selftest: 9 reference pairs OK`

---

## 2. Verifikasi Kontras Warna (WCAG AA & Non-Text 1.4.11)

Diukur aktual dengan `.agents/skills/antislop-human/contrast-check.py`:

| Pasangan Warna | FG / BG | Rasio Aktual | Hasil |
| :--- | :--- | :--- | :--- |
| D1 teks utama / kanvas | `#1C1917` / `#FAF7F2` | `16.37:1` | **PASS** (AA `4.5:1`) |
| D1 teks sekunder / kartu | `#57534E` / `#FFFFFF` | `7.63:1` | **PASS** |
| D1 tombol primer | `#FFFFFF` / `#163829` | `12.87:1` | **PASS** |
| D1 tombol terakota mendesak | `#FFFFFF` / `#B44D2B` | `5.20:1` | **PASS** |
| D1 batas input / putih | `#8E8577` / `#FFFFFF` | `3.64:1` | **PASS** non-text `3.0:1` (exit 1 pada uji normal text `4.5:1`, memang komponen border) |
| D2 teks utama / kanvas | `#1E2420` / `#FBF9F6` | `15.04:1` | **PASS** |
| D2 teks utama / kartu | `#1E2420` / `#FFFFFF` | `15.81:1` | **PASS** |
| D2 teks sekunder / kanvas | `#525B54` / `#FBF9F6` | `6.70:1` | **PASS** |
| D2 teks sidebar / rel botani | `#F6F4EF` / `#143326` | `12.48:1` | **PASS** |
| D2 label grup sidebar / rel | `#C6D7CE` / `#143326` | `9.15:1` | **PASS** |
| D2 item sidebar aktif | `#143326` / `#E6EFEA` | `11.69:1` | **PASS** |
| D2 tombol primer | `#FFFFFF` / `#143326` | `13.71:1` | **PASS** |
| D2 tombol mawar mendesak | `#FFFFFF` / `#8C3B4A` | `7.40:1` | **PASS** |
| D2 batas input / putih | `#858E87` / `#FFFFFF` | `3.38:1` | **PASS** non-text `3.0:1` |
| Lencana Paid / POSTED | `#166534` / `#DCFCE7` | `6.49:1` | **PASS** |
| Lencana Sebagian / Warn | `#92400E` / `#FEF3C7` | `6.37:1` | **PASS** |
| Lencana Siap Kirim | `#1E40AF` / `#DBEAFE` | `7.15:1` | **PASS** |
| Lencana Terlambat / Danger | `#991B1B` / `#FEE2E2` | `6.80:1` | **PASS** |
| Lencana VOIDED / Neutral | `#374151` / `#E5E7EB` | `8.33:1` | **PASS** |

---

## 3. Pengujian Browser Nyata, Temuan Bug & Perbaikan

### Masalah yang Tertangkap Saat Inspeksi Visual Screenshot Awal
1. **Spesifisitas tombol `.tablet-menu-btn`:** Awalnya `.btn { display: inline-flex; }` menimpa `.tablet-menu-btn { display: none; }` sehingga tombol `Menu` muncul ganda pada desktop (`1440px`) dan mobile (`390px`). **Diperbaiki** dengan selektor `.btn.tablet-menu-btn` sehingga hanya tampil pada `768px-1023px`.
2. **Bilah Simpan Form `position: sticky`:** Pada form panjang yang belum digulir ke bawah (`1440x900` & `360x780`), `.sticky-save-bar` mengambang menutupi baris input `Jumlah` dan `Harga Satuan`. **Diperbaiki** dengan memindahkan aksi `Simpan Pesanan` ke panel ringkasan kanan yang sejajar (desktop) dan menempatkan bar simpan sebagai kartu aksi non-tumpang-tindih di bagian bawah form.

### Hasil Pengujian Matrix Lintas Viewport (Setelah Perbaikan Final)

Seluruh pengukuran di bawah berasal dari jalankan `agent-browser` setelah edit CSS terakhir:

| File & Viewport | Ukuran PNG Aktual (px) | `docSW` / `bodySW` | `maxRight` | `inputsNoLabel` | `smallTargets (<44px)` | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Arah 1 Dashboard (`1440×900`) | `1440×937` | `1440` / `1440` | `1440` | `0` | N/A | **PASS** |
| Arah 1 Form (`1440×900`) | `1440×937` | `1440` / `1440` | `1440` | `0` | N/A | **PASS** |
| Arah 1 Detail (`1440×900`) | `1440×937` | `1440` / `1440` | `1440` | `0` | N/A | **PASS** |
| Arah 1 Dashboard (`390×844`) | `390×2102` | `390` / `390` | `390` | `0` | `0` | **PASS** |
| Arah 1 Detail (`390×844`) | `390×1609` | `390` / `390` | `390` | `0` | `0` | **PASS** |
| Arah 2 Dashboard (`1440×900`) | `1440×953` | `1440` / `1440` | `1440` | `0` | N/A | **PASS** |
| Arah 2 Pesanan (`1440×900`) | `1440×953` | `1440` / `1440` | `1440` | `0` | N/A | **PASS** |
| Arah 2 Form (`1440×900`) | `1440×1160` | `1440` / `1440` | `1440` | `0` | N/A | **PASS** |
| Arah 2 Detail (`1440×900`) | `1440×953` | `1440` / `1440` | `1440` | `0` | N/A | **PASS** |
| Arah 2 Pembayaran (`1440×900`) | `1440×953` | `1440` / `1440` | `1440` | `0` | N/A | **PASS** |
| Arah 2 Narrow Desktop (`1024×768`) | `1024×1184` | `1024` / `1024` | `1024` | `0` | N/A | **PASS** |
| Arah 2 Tablet Dashboard (`768×1024`) | `768×1474` | `768` / `768` | `768` | `0` | N/A | **PASS** |
| Arah 2 Tablet Form (`768×1024`) | `768×1513` | `768` / `768` | `768` | `0` | N/A | **PASS** |
| Arah 2 Dashboard (`390×844`) | `390×2212` | `390` / `390` | `390` | `0` | `0` | **PASS** |
| Arah 2 Pesanan (`390×844`) | `390×1417` | `390` / `390` | `390` | `0` | `0` | **PASS** |
| Arah 2 Form (`390×844`) | `390×2305` | `390` / `390` | `390` | `0` | `0` | **PASS** |
| Arah 2 Detail (`390×844`) | `390×2103` | `390` / `390` | `390` | `0` | `0` | **PASS** |
| Arah 2 Pembayaran (`390×844`) | `390×1100` | `390` / `390` | `390` | `0` | `0` | **PASS** |
| Arah 2 Small Mobile Dashboard (`360×780`) | `360×2262` | `360` / `360` | `360` | `0` | `0` | **PASS** |
| Arah 2 Small Mobile Detail (`360×780`) | `360×2209` | `360` / `360` | `360` | `0` | `0` | **PASS** |
| Arah 2 Small Mobile Form (`360×780`) | `360×2398` | `360` / `360` | `360` | `0` | `0` | **PASS** |

*Catatan jujur pengujian PNG ulang:* Setelah pemindahan CSS `.sticky-save-bar` dan `.btn.tablet-menu-btn`, pengambilan ulang PNG dilakukan pada seluruh tampilan utama yang berubah serta 3 modal/validasi (`d2-mobile-menu-drawer.png`, `d2-mobile-payment-modal.png`, `d2-desktop-validation-summary.png`); konsol browser tidak mencatat error JavaScript apa pun (`0` errors).

---

## 4. Uji Alur Interaktif & Anti-Slop Check

- **Duplikasi Item & Perhitungan Ongkir:** `Duplikat Item` menambah jumlah item `1 -> 2` dan total `Rp1.400.000 -> Rp2.800.000`; mengubah Item #2 ke `INCLUDED` otomatis menurunkan total menjadi `Rp2.650.000` dan mengunci kolom ongkir Item #2 ke `Rp0`. **PASS**
- **Modal `+ Pelanggan Baru` tanpa Reset Form:** Menambah `CV Mawar Indah (0819-0001-2233)` memperbarui input pelanggan terpilih dan mempertahankan `2` item yang sudah diisi (`countAfterCust: "2"`). **PASS**
- **Keyboard `Escape` & Modal Focus:** Drawer menu mobile terbuka saat diklik dan tertutup bersih saat tombol `Escape` ditekan (`open: true -> after Escape: false`). **PASS**
- **Simulasi Edge State (`Empty` / `Loading` / `Error`):** Ketiga state tampil tanpa error layout di Daftar Pesanan. **PASS**
- **R-02 Hygiene:** Pemeriksaan Python atas `direction-1-warm-atelier.html` dan `direction-2-botanical-studio.html` menghasilkan `em-dash: 0, en-dash: 0`. **PASS**

---

## 5. Risiko Sisa (Harus Ditjaga Saat Phase 9 React/Inertia)

1. **Tangkapan gambar penuh (`--full`) di browser untuk navbar `position: fixed`:** Pada screenshot penuh Chromium di halaman mobile panjang (`390×2305`), bilah bawah tetap (`position: fixed; bottom: 0`) dirender di lipatan layar pertama (`844px`), meskipun saat dipakai nyata oleh manusia di HP bilah tersebut selalu menempel rapi di dasar layar. Di Phase 9, pastikan `padding-bottom` konten utama tetap memberi ruang longgar agar item terbawah bisa digulir ke atas bilah.
2. **Combobox Keyboard Arrow Up/Down Lengkap:** Prototipe HTML sudah menyediakan filter ketik langsung, `aria-expanded`, `role="listbox"`, dan `Escape`; pada implementasi React Phase 9 nanti lengkapi navigasi tombol panah `ArrowDown`/`ArrowUp`/`Enter` sesuai WAI-ARIA Authoring Practices.
3. **Database & Logika Server:** Prototipe Phase 8.2 menggunakan kalkulasi pratinjau client-side sintetis. Saat Phase 9, sumber kebenaran total order, validasi status linear item, dan idempotency pembayaran tetap 100% di backend Laravel.
