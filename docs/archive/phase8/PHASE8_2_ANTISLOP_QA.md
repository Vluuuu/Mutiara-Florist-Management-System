# Phase 8.2 Final QA & Backend Contract Checklist Report

Tanggal: 17 November 2026 (Revisi Final Sebelum Design Approval)
Branch: `design/phase8-human-centered-refinement`
Kandidat Utama: **Arah 2 - Botanical Studio Workspace** (`docs/phase8-2/direction-2-botanical-studio.html`)
Status Desain: **BELUM MENDAPAT FINAL DESIGN APPROVAL (Menunggu Tinjauan Ulang Pemilik)**

---

## 1. Acceptance Checklist: Kontrak Backend vs Prototipe Form

Diperiksa langsung terhadap `app/Http/Requests/OrderRequest.php`, `StorePaymentRequest.php`, `VoidPaymentRequest.php`, `CustomerRequest.php`, `app/Services/OrderService.php`, dan migrasi `2026_11_02_000001_create_mfms_core_tables.php`.

### 1.1 `OrderRequest` (Buat & Edit Pesanan)

| Field Backend & Aturan (`OrderRequest.php`) | Input pada Prototipe Revisi (`direction-2-botanical-studio.html`) | Status |
| :--- | :--- | :--- |
| `customer_id` (`required \| integer \| exists:customers`) | Combobox pencarian pelanggan `#customer-search-input` + hidden `#selected-customer-id` (tanpa auto-select; wajib pilih) | **MATCH** |
| `order_date` (`required \| date_format:Y-m-d`) | Input tanggal `#order-date-input` (`type="date"`) | **MATCH** |
| `notes` (`nullable \| string \| max:2000`) | Input `#order-general-note` ("Catatan Pesanan (Opsional)") | **MATCH** |
| `change_reason` (`nullable \| string \| max:500`, dipakai saat Edit order berbayar) | Blok `#edit-change-reason-wrap` tampil saat Edit pesanan yang sudah menerima pembayaran | **MATCH** |
| `items.*.flower_type` (`required \| string \| max:255`) | `#f-flower-{i}` ("Jenis & Ukuran Bunga *") | **MATCH** |
| `items.*.recipient` (`required \| string \| max:255`) | `#f-recipient-{i}` ("Nama Penerima *") terpisah dari alamat | **MATCH** |
| `items.*.sender_name` (`required \| string \| max:255`) | `#f-sender-{i}` ("Nama Pengirim di Pita/Kartu *") terpisah | **MATCH** |
| `items.*.delivery_date` (`required \| date_format:Y-m-d`, DATE tanpa jam) | `#f-ddate-{i}` ("Tanggal Kirim *"), tanpa input/klaim jam-menit | **MATCH** |
| `items.*.delivery_location` (`required \| string \| max:1000`) | `#f-loc-{i}` ("Lokasi / Alamat Pengiriman *") terpisah dari penerima | **MATCH** |
| `items.*.quantity` (`required \| integer \| min:1`) | `#f-qty-{i}` (`type="number" min="1"`) | **MATCH** |
| `items.*.unit_price` (`required \| integer \| min:0`) | `#f-price-{i}` (`CurrencyInput` bulat Rupiah tanpa desimal) | **MATCH** |
| `items.*.shipping_mode` (`required \| in:INCLUDED,SEPARATE`) | `#f-shipmode-{i}` (Payload `SEPARATE` tampil `"Ditagih terpisah"`, payload `INCLUDED` tampil `"Sudah termasuk harga bunga"`) | **MATCH** |
| `items.*.shipping_fee` (`INCLUDED` -> `0`; `SEPARATE` -> `> 0`) | `#f-shipfee-{i}` terkunci `Rp0` saat `INCLUDED`; divalidasi `> Rp0` saat `SEPARATE` (`Ongkir terpisah harus lebih dari Rp0.`) | **MATCH** |
| `items.*.notes` (`nullable \| string \| max:2000`) | `#f-notes-{i}` ("Catatan Item / Isi Ucapan Pita (Opsional)") | **MATCH** |

### 1.2 `CustomerRequest`, `StorePaymentRequest`, & `VoidPaymentRequest`

| Kontrak Backend | Implementasi pada Prototipe Revisi | Status |
| :--- | :--- | :--- |
| `CustomerRequest`: `name` wajib, `phone` opsional (`nullable`), `notes` opsional (`nullable`) | Modal `#modal-customer`: `#qc-name` wajib, `#qc-phone` opsional, `#qc-notes` opsional; menyimpan tanpa mereset draf item | **MATCH** |
| `StorePaymentRequest`: `amount` int `>= 1` maks sisa tagihan, `method` (`CASH\|TRANSFER\|QRIS\|OTHER`), `payment_date`, `reference`, `idempotency_key` (di React) | Modal `#modal-payment`: pre-fill sisa tagihan, validasi integer bulat `1 .. remaining`, pilihan metode Bahasa Indonesia dengan value enum sah | **MATCH** |
| `VoidPaymentRequest`: `void_reason` (`required \| string \| min:10 \| max:1000`) | Modal `#modal-void`: textarea `#void-reason-input` dengan counter live `0/10 karakter minimum` dan blok submit jika `< 10` karakter | **MATCH** |

---

## 2. Catatan Kebutuhan Desain yang Belum Didukung Backend

Hasil audit langsung controller dan service backend saat ini (tanpa mengubah schema atau logika bisnis pada Phase 8.2):

1. **Daftar Antrean Kiriman Terlambat & Hari Ini di Dashboard:** `DashboardService::stats()` dan `UiDashboardController` baru mengirim 6 angka statistik kumulatif (`orders`, `billed`, `received`, `outstanding`, `expenses`, `cash_flow`) ke halaman Dashboard, belum mengirim daftar item kiriman terlambat/hari ini maupun daftar tagihan belum lunas teratas. Pada Phase 9 perlu tambahan query read-only di `DashboardService` / `UiDashboardController`.
2. **Ketidakhadiran Jam Kirim pada `order_items.delivery_date`:** Kolom database bertipe `DATE` saja (tanpa waktu). Desain Phase 8.2 telah menghapus seluruh penanda jam/menit (`13:00 WIB`, `Lewat 30 mnt`) dan memakai indikator berbasis tanggal (`Terlambat (16/11/2026)`, `Kirim hari ini (17/11/2026)`). Jika toko suatu saat butuh jadwal per jam, diperlukan migrasi terpisah di luar Phase 9.
3. **Riwayat Transaksi Pembayaran Gabungan pada `/ui-payments`:** `UiPaymentController::index()` saat ini mengirim daftar tagihan belum lunas (`PaymentService::getReceivables()`) + `outstanding`, belum mengirim daftar riwayat transaksi individual (`Tercatat`/`Dibatalkan`) ke halaman index Piutang (riwayat pembayaran saat ini hanya dimuat per order di `OrderService::getOrderDetail()`). Desain halaman `Piutang & Pembayaran` telah mengutamakan **Tagihan Belum Lunas** di atas dan menempatkan **Riwayat Transaksi** sebagai blok sekunder yang dapat ditambah read-only query di Phase 9 bila disetujui pemilik.
4. **Nomor Telepon pada Ringkasan Pencarian Order List:** `OrderService::paginate()` baru memuat `customer:id,name`, belum memuat `phone`.
5. **Status Blueprint Halaman Pendukung:** Halaman `Pelanggan`, `Pengeluaran`, `Kategori Biaya`, dan `Laporan` pada prototipe masih berstatus *Blueprint Layout Pendukung* dan telah diberi banner penjelas agar tidak dianggap alur produksi penuh.

---

## 3. Verifikasi Skill Anti-Slop & Kontras Warna

- `.agents/skills/antislop-human/contrast-check.py --selftest` -> `selftest: 9 reference pairs OK`.
- Seluruh token Arah 2 lulus WCAG AA (`#1E2420`/`#FBF9F6` `15.04:1`, `#525B54`/`#FFFFFF` `7.04:1`, `#F6F4EF`/`#143326` `12.48:1`, `#FFFFFF`/`#143326` `13.71:1`, `#FFFFFF`/`#8C3B4A` `7.40:1`, batas input `#858E87`/`#FFFFFF` `3.38:1` non-text `>= 3.0:1`).
- Pemeriksaan karakter tipografi & teks kode internal: `em-dash: 0`, `en-dash: 0`, `Uji Validasi Kosong: 0`, dan `leakedTechCodes: []` (nol kemunculan `POSTED`, `VOIDED`, `SEPARATE`, `INCLUDED`, atau klaim jam/menit `13:00`/`15:30`/`17:00`/`mnt` di teks operator `#main-content`).

---

## 4. Hasil Uji Browser Multi-Viewport & Interaksi (Setelah Revisi Final)

Dijalankan melalui `agent-browser` CLI v0.43.0 terhadap `direction-2-botanical-studio.html`:

| Viewport & Layar | Ukuran PNG Aktual | Overflow (`docSW/maxRight`) | `inputsNoLabel` | `smallTargets (<44px)` | Urutan Mobile / Tombol Simpan | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `1440×900` Dashboard | `1440×953` | `1440 / 1440` (`0` overflow) | `0` | N/A | KPI atas, antrean + piutang split | **PASS** |
| `1440×900` Pesanan | `1440×953` | `1440 / 1440` (`0` overflow) | `0` | N/A | Tabel desktop lengkap | **PASS** |
| `1440×900` Buat Pesanan | `1440×1201` | `1440 / 1440` (`0` overflow) | `0` | N/A | **1** tombol `Simpan Pesanan` (`deskBtns: 1`) | **PASS** |
| `1440×900` Detail (`MF-261116-09`) | `1440×900` | `1440 / 1440` (`0` overflow) | `0` | N/A | `Salin Ringkasan WA` tampil pratinjau real | **PASS** |
| `1440×900` Piutang & Bayar | `1440×1109` | `1440 / 1440` (`0` overflow) | `0` | N/A | Tagihan Belum Lunas di atas + riwayat di bawah | **PASS** |
| `1024×768` Dashboard | `1024×1202` | `1024 / 1024` (`0` overflow) | `0` | N/A | Sidebar rail aktif tanpa tombol Menu ganda | **PASS** |
| `768×1024` Dashboard & Form | `768×1467`, `768×1582` | `768 / 768` (`0` overflow) | `0` | N/A | Tombol `Menu` tablet tampil; **1** tombol Simpan | **PASS** |
| `390×844` Dashboard | `390×1865` | `390 / 390` (`0` overflow) | `0` | `0` | **`queueBeforeKpi: true`** (Antrean di paling atas!) | **PASS** |
| `390×844` Pesanan & Pembayaran | `390×1343`, `390×1788` | `390 / 390` (`0` overflow) | `0` | `0` | Mobile card list rapi | **PASS** |
| `390×844` Form & Detail | `390×2363`, `390×1831` | `390 / 390` (`0` overflow) | `0` | `0` | **1** tombol `Simpan Pesanan` bawah | **PASS** |
| `360×780` Dashboard, Detail, Form | `360×2019`, `360×1959`, `360×2410` | `360 / 360` (`0` overflow) | `0` | `0` | **`queueBeforeKpi: true`**, **1** tombol Simpan | **PASS** |

### Uji Interaksi Fungsional
- **`Tandai Terkirim`:** Membuka modal konfirmasi `#modal-deliver-confirm` (`deliverConfirmOpen: true`) yang memperingatkan bahwa status bersifat final sebelum mengubah data. **PASS**
- **Pilih Nota Dinamis & `Salin Ringkasan WA`:** Klik nota `MF-261116-09` membuka detail nota Hotel Puri Anggrek (`openedOrderNo: "MF-261116-09"`), dan klik `Salin Ringkasan WA` menyalin serta menampilkan teks rincian nota aktual (`waVisible: true`, `waContains: true`). **PASS**
- **Validasi Ongkir Terpisah (`SEPARATE` `> 0`) & `Void` Min 10 Karakter:** Mengisi ongkir `Rp0` saat mode `Ditagih terpisah` memicu pesan persis backend `"Bunga #1: Ongkir terpisah harus lebih dari Rp0."`, dan alasan pembatalan `< 10` karakter ditolak (`voidBlockedShort: true`). **PASS**
- **Mode Edit Pesanan Berbayar:** Skenario `Demo Edit Pesanan Berbayar` dari bilah demo memunculkan kolom wajib `Alasan Perubahan Nominal / Pesanan *` (`editReasonVisible: true`). **PASS**

---

## 5. Screenshot Sebelum vs Sesudah Revisi

| Layar | Sebelum Revisi (`docs/phase8-2/screenshots/before/`) | Sesudah Revisi (`docs/phase8-2/screenshots/`) | Ringkasan Perubahan |
| :--- | :--- | :--- | :--- |
| Desktop Dashboard | `before/d2-desktop-dashboard-before.png` | `d2-desktop-dashboard.png` | Hapus menit/jam (`13:00`, `Lewat 30 mnt`), ganti tanggal nyata; hapus `POSTED` dari teks UI; rapikan ukuran heading serif |
| Desktop Form Pesanan | `before/d2-desktop-order-form-before.png` | `d2-desktop-order-form.png` | Field lengkap 1:1 `OrderRequest` (`sender_name`, `delivery_location` & `recipient` terpisah, `notes`); hapus tombol `Simpan Pesanan` ganda & `Uji Validasi Kosong`; hapus `SEPARATE`/`INCLUDED` dari label |
| Desktop Piutang & Bayar | `before/d2-desktop-payments-before.png` | `d2-desktop-payments.png` | Dahulukan daftar **Tagihan Belum Lunas (Piutang Aktif)** sesuai `UiPaymentController`; riwayat transaksi di bawah memakai label `Tercatat`/`Dibatalkan` |
| Mobile Dashboard | `before/d2-mobile-dashboard-before.png` | `d2-mobile-dashboard.png` | **Antrean Kiriman Terlambat & Hari Ini** kini tampil paling atas sebelum 4 kartu KPI ringkas (`2x2`) |
| Mobile Form Pesanan | `before/d2-mobile-order-form-before.png` | `d2-mobile-order-form.png` | Seluruh field wajib `OrderRequest` terpisah rapi 1 kolom dengan **1** tombol `Simpan Pesanan` di bawah |
| Bukti Tambahan Revisi | - | `d2-desktop-order-detail.png`, `d2-desktop-deliver-confirm.png` | Bukti `Salin Ringkasan WA` aktual & modal konfirmasi final `Tandai Terkirim` |
