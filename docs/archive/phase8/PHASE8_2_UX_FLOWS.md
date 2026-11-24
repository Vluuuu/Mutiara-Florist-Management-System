# Phase 8.2 UX Flows: Penyederhanaan Alur Operator & Pencegahan Error

Tanggal: 17 November 2026
Branch: `design/phase8-human-centered-refinement`
Basis: Hasil audit `docs/PHASE7_USER_FLOWS.md` + perbaikan ergonomi Phase 8.2

---

## 1. Enam Pertanyaan Desain Manusia per Layar Inti

| Layar | 1. Dilihat Pertama Kali | 2. Keputusan dalam 3 Detik | 3. Aksi Terdekat | 4. Disembunyikan ke Detail | 5. Error Dicegah Sebelum Simpan | 6. Pengalaman HP Toko/Kurir |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard (Hari Ini)** | Jumlah kiriman hari ini, 1 item terlambat, agenda hari ini terurut waktu. | Mana kiriman yang terlambat atau harus dirangkai sekarang. | `Tandai Terkirim` / `Tandai Siap`, `+ Catat Pelunasan`, `+ Pesanan Baru`. | Riwayat item selesai minggu lalu, rincian histori void. | Tidak bisa melompati status kerja (hanya tampil 1 langkah berikutnya yang sah). | Bottom bar 4 tab (`Hari Ini`, `Pesanan`, `Buat`, `Menu`), semua tombol min 44px, 1 kolom tanpa tabel melebar. |
| **Daftar Pesanan** | Chip status cepat (`Semua`, `Belum Lunas`, `Siap Kirim`, `Diproses`) + kotak cari. | Pesanan mana yang masih punya tagihan atau belum dikirim. | `Buka` detail atau tombol langsung `Bayar`. | Alamat lengkap multi-penerima dan isi pita ucapan panjang. | State `Empty`, `Loading`, dan `Error` dengan tombol `Coba Muat Ulang` yang jelas. | Beralih otomatis dari tabel desktop (`>= 900px`) ke kartu terstruktur (`< 900px`) dengan nominal dan sisa bayar terbaca langsung. |
| **Buat / Edit Pesanan** | Blok `1. Informasi Pemesan & Nota` + `2. Daftar Item` + ringkasan total kanan/bawah. | Apakah pelanggan sudah terdaftar, dan berapa estimasi total tagihan sementara. | `Duplikat Item`, `+ Pelanggan Baru`, `Simpan Pesanan`. | Detail akuntansi backend; yang muncul hanya subtotal item + ongkir terpisah. | Ringkasan error GOV.UK di atas form, `CurrencyInput` bulat tanpa koma, `INCLUDED` otomatis mengunci ongkir Rp0, tambah pelanggan baru tanpa menghapus item. | 1 kolom vertikal bersih, keyboard numerik HP (`inputmode="numeric"`), tombol simpan di akhir form tanpa menutup field di atasnya. |
| **Detail Pesanan** | Nomor nota, pemesan, 4 kartu ringkas (`Total`, `Diterima`, `Sisa`, `Status`). | Apakah nota ini sudah lunas, dan item mana yang masih di workshop. | `Tandai Terkirim`, `+ Catat Pembayaran`, `Void / Koreksi`. | Log teknis/idempotency key. | Aksi linear `Baru -> Diproses -> Siap Kirim -> Terkirim` (tidak ada loncatan status) dan dialog `Void` memaksa isi alasan wajib. | Kartu ringkas 1 kolom (`360px`/`390px`) bebas bug lebar 652px; setiap item punya tombol langkah berikut 44px. |
| **Pembayaran & Piutang** | Filter `Semua` / `POSTED` / `VOIDED` dan daftar transaksi dengan status audit. | Transaksi mana yang sah masuk kas (`POSTED`) dan mana koreksi (`VOIDED`). | `+ Catat Pembayaran`, `Void / Koreksi`. | Form edit nominal pembayaran (ditolak demi integritas audit; koreksi wajib Void + catat ulang). | Pre-fill otomatis `Sisa Tagihan`, validasi > Rp0, input bulat Rupiah, konfirmasi alasan wajib saat Void. | Kartu audit vertikal: nominal `VOIDED` dicoret dengan alasan terbaca tanpa geser tabel horizontal. |

---

## 2. Alur Sebelum vs Sesudah Phase 8.2

### Alur A: Membuat Pesanan Korporat Multi-Penerima untuk Pelanggan Baru
- **Sebelum (Baseline Phase 7):** Operator harus keluar ke halaman Pelanggan dulu, tambah pelanggan, kembali ke Pesanan, membuka form baru, mengetik manual ulang 3 cabang penerima yang produk dan harganya sama, dan rawan salah membaca ongkos kirim `INCLUDED` vs `SEPARATE` tanpa ringkasan langsung.
- **Sesudah (Phase 8.2 - Arah 2):**
  1. Buka `Buat Pesanan` (1 tap di topbar atau tab `Buat` HP).
  2. Klik `+ Pelanggan Baru` di kartu Pemesan -> isi Nama & WA -> Simpan & Pilih (pelanggan langsung terpilih di `Combobox` tanpa mereset form).
  3. Isi Item #1 -> pilih `SEPARATE` atau `INCLUDED` -> klik **`Duplikat Item`** untuk Item #2 dan #3, cukup ubah nama penerima & alamat.
  4. Cek ringkasan total sementara di panel kanan (desktop) / kartu ringkasan (HP) -> klik `Simpan Pesanan`.
- **Dampak:** Menghemat navigasi bolak-balik antar menu dan mencegah hilangnya draf item yang sudah diketik.

### Alur B: Memperbarui Status Pengerjaan & Pengiriman dari Meja Workshop / HP Kurir
- **Sebelum (Phase 7):** Harus masuk ke halaman Pesanan, buka detail, dan pada layar sempit tombol aksi berisiko tertutup atau tabel harus digeser kanan-kiri.
- **Sesudah (Phase 8.2):**
  1. Dari layar pembuka `Hari Ini`, kiriman yang melewati jam kirim muncul di urutan teratas dengan penanda jelas (`Lewat 30 mnt`).
  2. Operator/kurir langsung menekan 1 tombol tahap berikutnya yang valid (`Mulai Proses` -> `Tandai Siap` -> `Tandai Terkirim`) langsung dari agenda Dashboard atau kartu Item Detail Pesanan.
  3. Toast konfirmasi memberi umpan balik langsung tanpa keluar dari konteks layar.

### Alur C: Mencatat Pembayaran Pelunasan & Koreksi Salah Nominal (`POSTED` / `VOIDED`)
- **Sebelum (Phase 7):** Nominal tagihan dan sisa bayar tersebar; operator nonteknis ragu apakah salah ketik bayar harus dihapus atau ditambah baru.
- **Sesudah (Phase 8.2):**
  1. Pada kartu piutang Dashboard, Daftar Pesanan, atau Detail Pesanan, klik `Catat Pelunasan` -> modal langsung mengisi nominal sisa tagihan (`Rp1.175.000`).
  2. Jika terjadi salah input sebelumnya, operator menekan `Void / Koreksi`, wajib menuliskan alasan koreksi sebelum `VOIDED` disimpan, sehingga riwayat audit tetap utuh dengan coretan nominal dan alasan jelas.

---

## 3. Arsitektur Navigasi Lintas Ukuran Layar

| Ukuran Layar | Pola Navigasi | Lokasi Menu Sekunder & Keluar Akun |
| :--- | :--- | :--- |
| **Desktop (`>= 1024px`, diuji `1024×768` & `1440×900`)** | Left Sidebar Rail tetap (`248px`) dibagi 2 kelompok: `Operasional Harian` (`Hari Ini`, `Pesanan`, `Buat Pesanan`, `Pembayaran`) dan `Pelanggan & Biaya` (`Pelanggan`, `Pengeluaran`, `Kategori Biaya`, `Laporan`). | Seluruh 8 menu + tombol `Keluar Akun` tampil langsung di sidebar; tombol topbar `Menu` disembunyikan agar tidak ganda. |
| **Tablet (`768px - 1023px`, diuji `768×1024`)** | Topbar sticky berisi pencarian cepat + tombol eksplisit `Menu` + CTA `+ Pesanan Baru`. | Tombol `Menu` membuka dialog daftar seluruh halaman sekunder + `Keluar Akun`. |
| **Mobile (`< 768px`, diuji `360×780` & `390×844`)** | Bilah bawah tetap (`64px + safe-area`) berisi tepat **4 tujuan selevel**: `Hari Ini`, `Pesanan`, `Buat`, dan `Menu`. Tombol header `Menu` disembunyikan agar tidak duplikat. | Mengetuk tab `Menu` membuka modal daftar halaman (`Pembayaran`, `Detail Contoh`, `Pelanggan`, `Pengeluaran`, `Kategori Biaya`, `Laporan`, `Keluar Akun`). |
