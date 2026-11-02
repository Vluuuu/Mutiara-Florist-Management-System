# Database Design & ERD — MFMS

**Versi rancangan:** v0.2 (2 November 2026)  
**Status:** Core schema siap menjadi acuan implementasi setelah keputusan bisnis terbuka disahkan. **Belum ada migration ataupun data nyata di repo.**

## 1. Konteks dan prinsip

- **Database:** MySQL lokal, Laravel migrations + Eloquent ORM.
- **Grain:** satu pelanggan memiliki banyak pesanan; satu pesanan memiliki satu atau banyak item bunga; satu pesanan memiliki nol atau banyak transaksi pembayaran.
- **Nominal:** semua uang disimpan dalam **Rupiah bulat** memakai BIGINT non-negatif. Dilarang menggunakan FLOAT/DOUBLE untuk nominal uang. Validasi batas perkalian untuk mencegah overflow.
- **Tanggal:** bedakan \`order_date\`, \`delivery_date\`, \`payment_date\`, dan \`expense_date\`; timezone aplikasi Asia/Jakarta. Simpan \`created_at\` dan \`updated_at\` untuk jejak sistem.
- **Status pesanan** dan **status bayar** terpisah. Status bayar dihitung dari nilai tagihan dan pembayaran POSTED, bukan dua checkbox.
- **Delete:** jangan menghapus permanen pesanan yang memiliki riwayat pembayaran; jangan menghapus permanen pembayaran atau pengeluaran. Void/koreksi wajib memiliki alasan dan jejak audit.
- **Data contoh:** seed sintetis saja, tidak memasukkan identitas asli pelanggan ke repository.

## 2. ERD

\`\`\`mermaid
erDiagram
  USERS ||--o{ ORDERS : created_by
  USERS ||--o{ PAYMENTS : recorded_by
  USERS ||--o{ EXPENSES : recorded_by
  USERS ||--o{ AUDIT_LOGS : actor
  CUSTOMERS ||--o{ ORDERS : places
  ORDERS ||--|{ ORDER_ITEMS : contains
  ORDERS ||--o{ PAYMENTS : receives
  EXPENSE_CATEGORIES ||--o{ EXPENSES : classifies

  USERS {
    bigint id PK
    varchar name
    varchar email UK
    varchar password
    datetime created_at
    datetime updated_at
  }
  CUSTOMERS {
    bigint id PK
    varchar name
    varchar phone "nullable, not unique"
    text notes "nullable"
    datetime created_at
    datetime updated_at
  }
  ORDERS {
    bigint id PK
    varchar order_number UK
    bigint customer_id FK
    bigint created_by FK
    date order_date
    date delivery_date "nullable"
    varchar status
    bigint total_amount
    text notes "nullable"
    datetime created_at
    datetime updated_at
  }
  ORDER_ITEMS {
    bigint id PK
    bigint order_id FK
    varchar flower_type
    varchar recipient
    varchar sender_name
    text delivery_address "nullable"
    int quantity
    bigint unit_price
    text notes "nullable"
    datetime created_at
    datetime updated_at
  }
  PAYMENTS {
    bigint id PK
    bigint order_id FK
    bigint recorded_by FK
    date payment_date
    bigint amount
    varchar method
    varchar reference "nullable"
    varchar idempotency_key UK
    varchar status
    text void_reason "nullable"
    datetime voided_at "nullable"
    datetime created_at
    datetime updated_at
  }
  EXPENSE_CATEGORIES {
    bigint id PK
    varchar name UK
    boolean is_active
    datetime created_at
    datetime updated_at
  }
  EXPENSES {
    bigint id PK
    bigint expense_category_id FK
    bigint recorded_by FK
    date expense_date
    bigint amount
    text description
    varchar status
    text void_reason "nullable"
    datetime voided_at "nullable"
    datetime created_at
    datetime updated_at
  }
  AUDIT_LOGS {
    bigint id PK
    bigint actor_user_id FK
    varchar action
    varchar subject_type
    bigint subject_id
    json change_summary "minimal, no secrets"
    datetime created_at
  }
\`\`\`

**Catatan:** relasi ORDERS–ORDER_ITEMS wajib memiliki minimal satu item pada saat order dinyatakan tersimpan; syarat jumlah minimal 1 ditegakkan di service/transaction, bukan oleh FK semata. Relasi actor audit bersifat internal dan perlu kebijakan jika akun user dinonaktifkan.

## 3. Tabel final untuk core flow

| Tabel | Fungsi | Kunci dan aturan |
| --- | --- | --- |
| \`users\` | Operator login | email unik; password di-hash |
| \`customers\` | Data nama/kontak pemesan | telepon boleh kosong dan tidak diasumsikan unik |
| \`orders\` | Header pesanan, status pengerjaan | order_number unik; customer_id wajib; total_amount dihitung backend |
| \`order_items\` | Detail masing-masing papan/buket | quantity > 0; unit_price >= 0; pengirim dan penerima per item |
| \`payments\` | Riwayat penerimaan DP/pelunasan | amount > 0; POSTED/VOIDED; idempotency_key unik per submit |
| \`expense_categories\` | Kelompok biaya | nama unik; nonaktifkan alih-alih hapus jika sudah dipakai |
| \`expenses\` | Pengeluaran kas usaha | amount > 0; POSTED/VOIDED; category FK |
| \`audit_logs\` | Riwayat aksi kritis | append-only, actor dan waktu; tidak simpan password atau data sensitif berlebihan |

Model awal menggunakan **8 tabel bisnis/pendukung** (di luar tabel framework Laravel seperti sessions/cache/jobs jika dibuat). Belum memerlukan \`products\`, \`invoices\`, \`refunds\`, ataupun \`attachments\` karena aturan atau kebutuhan detailnya belum disepakati.

## 4. Enumerasi yang disarankan

- \`orders.status\`: \`NEW\` → \`PROCESSING\` → \`READY\` → \`COMPLETED\`; \`CANCELLED\` untuk pembatalan **tanpa pembayaran** pada MVP, dengan alasan pembatalan dicatat di audit.
- \`payments.status\` dan \`expenses.status\`: \`POSTED\` / \`VOIDED\`.
- **Payment status** bukan field input/tabel terpisah: \`UNPAID\`, \`PARTIAL\`, \`PAID\` dihitung, dengan status khusus \`CANCELLED\` ditampilkan terpisah bila order dibatalkan.

Pada tahap pertama, perubahan dari COMPLETED/CANCELLED kembali menjadi aktif serta pembatalan order dengan pembayaran POSTED **tidak diizinkan** sampai aturan refund disepakati.

## 5. Sumber kebenaran dan konsistensi total

\`\`\`text
line_total        = quantity * unit_price           (derived, tidak perlu disimpan)
orders.total_amount = SUM(line_total)              (cache/materialisasi, hanya backend yang menulis)
paid_amount       = SUM(payments.amount WHERE status='POSTED' AND order_id = ?)
outstanding       = orders.total_amount - paid_amount
payment_status    = UNPAID jika paid_amount = 0 dan total > 0
                    PARTIAL jika 0 < paid_amount < total
                    PAID jika paid_amount = total dan total > 0
\`\`\`

- Pesanan baru harus memiliki total > 0 pada MVP. Pesanan gratis/kompensasi perlu aturan tersendiri.
- \`orders.total_amount\` dan item diperbarui dalam **satu database transaction**. Perubahan total setelah ada pembayaran dibatasi: jangan izinkan total baru < sudah dibayar.
- Validasi pembayaran dilakukan di transaction yang mengunci baris order (\`SELECT ... FOR UPDATE\` melalui Eloquent \`lockForUpdate\`), supaya dua submit simultan tidak melebihi tagihan. Unik \`idempotency_key\` membatasi pengulangan satu aksi; bukan melarang dua pembayaran sah dengan jumlah sama.
- DB index: \`orders(order_date, status)\`, \`orders(customer_id)\`, \`payments(order_id, payment_date, status)\`, \`expenses(expense_date, status)\`. FK dan indeks ditentukan secara konsisten di migration.

## 6. Batas definisi laporan

| Metrik | Sumber | Basis tanggal |
| --- | --- | --- |
| Penjualan bruto aktif (operasional) | SUM total_amount orders non-CANCELLED | order_date |
| Uang masuk | SUM payments POSTED | payment_date |
| Uang keluar | SUM expenses POSTED | expense_date |
| Selisih arus kas sederhana | uang masuk - uang keluar | periode pembayaran/pengeluaran |
| Piutang saat ini | SUM outstanding dari orders non-CANCELLED | **snapshot saat laporan dibuka**, bukan otomatis piutang historis akhir bulan |

Angka penjualan di sini adalah nilai order tercatat, **bukan laporan laba/rugi akuntansi**. Void/koreksi mengubah tampilan laporan periode asal; jejak pembetulannya harus tersedia di audit log. Bila membutuhkan laporan historis *as-of*, diperlukan ledger/snapshot terpisah dan keputusan produk baru.

## 7. Migrasi dan strategi pengembangan

1. Siapkan migration users (bawaan auth), customers, orders, order_items, payments, expense_categories, expenses, audit_logs.
2. Foreign key memakai pembatasan yang melindungi riwayat; jangan cascade delete untuk data finansial.
3. Gunakan Laravel FormRequest dan layanan khusus untuk membuat order, mencatat pembayaran, dan melakukan void.
4. Seed hanya contoh sintetis; uji fresh migrate, transaksi atomik, hubungan antar tabel, dan indeks.

## 8. Keputusan bisnis belum final (jangan asumsi)

- Pesanan dikirim ke banyak lokasi/tanggal dalam satu order atau dipisah? **Usulan sementara:** satu \`delivery_date\` di header, alamat/penerima per item; perlu dikonfirmasi.
- Ongkir, diskon, dan pajak belum dimasukkan ke perhitungan; dibutuhkan keputusan sebelum fitur tersebut dibuat.
- Pengembalian DP, biaya pembatalan, refund, serta void yang melibatkan dana nyata membutuhkan kebijakan terpisah.
- Koreksi pembayaran yang salah input boleh di-void dengan alasan dan audit; **bukan** refund uang yang sudah dikembalikan ke pelanggan.
- Syarat nomor pesanan, metode pembayaran, serta privasi/retensi lampiran belum dipastikan.

Lihat [BUSINESS_RULES.md](BUSINESS_RULES.md), [WORKFLOWS.md](WORKFLOWS.md), dan [DECISIONS.md](DECISIONS.md).
