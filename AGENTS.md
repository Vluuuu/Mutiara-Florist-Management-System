# Mutiara Florist Management System (MFMS) - Agent & Engineering Guidelines

Repositori ini menggunakan pengembangan berbantuan AI secara transparan. Panduan ini menetapkan aturan teknik proyek, arah visual, dan invarian bisnis MFMS yang wajib dipatuhi oleh pengembang maupun agen AI saat bekerja pada codebase ini.

## 1. Aturan UI/UX & Konsistensi Desain

Untuk setiap pekerjaan antarmuka, salinan teks (copywriting), aksesibilitas, atau tata letak responsif:

1. Baca [docs/DESIGN.md](docs/DESIGN.md) terlebih dahulu untuk arah visual (*Calm Botanical Workspace V2*), token warna WCAG AA, tipografi (*Plus Jakarta Sans Variable* dan *JetBrains Mono Variable*), serta aturan komponen.
2. Pertahankan bahasa Indonesia operasional yang ringkas, jelas, dan ramah operator toko (hindari simbol dekoratif generik, karakter em dash `U+2014`, label gabungan garis miring yang ambigu, serta kartu warna-warni non-semantik).
3. Pastikan rasio kontras memenuhi WCAG AA, ukuran target sentuh minimal `44x44px`, dan tidak ada horizontal overflow pada viewport mobile (`390px`), tablet (`768px`), laptop (`1024px`), dan desktop (`1440px`).

### Keterampilan Anti-Slop Lokal (Opsional)

Pengembangan UI MFMS memanfaatkan paket keterampilan lokal **Anti-Slop** (`miqdadbadjuber/anti-slop`, yang turut menyertakan komponen pemeriksaan kualitas dan aksesibilitas berlisensi MIT dari `web-quality-skills` oleh Addy Osmani). Demi kebersihan repositori publik dan atribusi lisensi hulu, berkas vendor di `.agents/skills/` **tidak dilacak di Git** (dikecualikan di `.gitignore`).

Jika ingin memasang keterampilan tersebut secara lokal untuk pengembangan lanjutan:

```bash
# Menggunakan installer Anti-Slop
npx antislop-ai

# Atau melalui direktori skills
npx skills add miqdadbadjuber/anti-slop
```

Jika salinan lokal tersedia pada `.agents/skills/`, agen dapat memuat aturan `antislop`, `antislop-ui`, `antislop-human`, `antislop-layoutmobile`, dan `antislop-copywriting` sesuai kebutuhan tugas.

## 2. Invarian Bisnis & Integritas Keuangan MFMS

Seluruh perubahan kode wajib menjaga invarian bisnis yang terdokumentasi di [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) dan [docs/PRICING_AND_SHIPPING.md](docs/PRICING_AND_SHIPPING.md):

1. **Matematika Rupiah Bulat (`BIGINT`):** Tidak ada tipe `FLOAT`/`DOUBLE` untuk nominal uang.
2. **Perhitungan Total di Sisi Server:** `orders.total_amount` selalu dihitung di backend (`OrderService`) dari `quantity * unit_price + shipping_charge` tanpa diskon maupun pajak.
3. **Alur Status Item Linier:** `order_items.fulfillment_status` bergerak berurutan `NEW` -> `PROCESSING` -> `READY` -> `DELIVERED`; `orders.status` menjadi `COMPLETED` hanya bila seluruh item `DELIVERED`. Tidak ada fitur `CANCELLED` atau refund pada rilis saat ini.
4. **Konkurensi & Idempotensi:** Mutasi pesanan dan pencatatan pembayaran wajib mengunci baris order (`lockForUpdate()`) dalam transaksi ACID; `payments` dan `expenses` wajib menjaga kunci idempotensi UUID unik.
5. **Integritas Audit `POSTED`/`VOIDED`:** Transaksi keuangan tidak pernah dihapus fisik (*no hard delete*). Koreksi memakai status `VOIDED` dengan alasan minimal 10 karakter dan dicatat di `audit_logs`.
6. **Keamanan Data & Pengujian:** Jangan pernah menyertakan data pelanggan nyata, catatan keuangan operasional, file `.env`, atau arsip backup `.enc`/`.meta.json` ke Git. Pengujian otomatis selalu dijalankan pada lingkungan database uji terisolasi (default SQLite `:memory:` pada `phpunit.xml`).
