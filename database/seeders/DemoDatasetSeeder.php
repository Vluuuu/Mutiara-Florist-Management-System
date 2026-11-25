<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\User;
use App\Services\CustomerService;
use App\Services\ExpenseService;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Support\DemoAccessManager;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class DemoDatasetSeeder extends Seeder
{
    /**
     * Populates the isolated SQLite demo database exclusively with realistic
     * synthetic Indonesian florist data. Never reads or copies production data.
     *
     * Every order, fulfillment transition, payment, void, and expense flows
     * through MFMS domain services so all financial invariants and audit logs
     * are 100% consistent with production behavior.
     */
    public function run(): void
    {
        $demo = app(DemoAccessManager::class);
        $driver = DB::connection()->getDriverName();

        if ($driver !== 'sqlite') {
            throw new RuntimeException(
                "DemoDatasetSeeder hanya boleh dijalankan pada database SQLite terisolasi (terdeteksi: {$driver})."
            );
        }

        $password = $demo->demoPassword();
        if ($password === null) {
            throw new RuntimeException('DEMO_PASSWORD wajib dikonfigurasi sebelum mengisi dataset demo.');
        }

        $nowWib = Carbon::now('Asia/Jakarta');
        $today = $nowWib->copy()->startOfDay();

        // 1. Dedicated Demo Evaluator Account (Deterministic ID = 1)
        $demoUser = User::query()->create([
            'name' => (string) config('demo.display_name', 'Evaluator Demo'),
            'email' => $demo->demoEmail(),
            'password' => Hash::make($password),
            'email_verified_at' => $nowWib,
        ]);

        // 2. Synthetic Expense Categories (5 active + 1 inactive)
        $categoryMap = [];
        $categories = [
            'flowers' => ['name' => 'Bahan Bunga Segar', 'is_active' => true],
            'boards' => ['name' => 'Papan & Rangka Bunga', 'is_active' => true],
            'courier' => ['name' => 'Ongkos Kurir & Pengiriman', 'is_active' => true],
            'supplies' => ['name' => 'Perlengkapan Rangkai & Pita', 'is_active' => true],
            'utilities' => ['name' => 'Operasional Toko & Utilitas', 'is_active' => true],
            'archived' => ['name' => 'Promosi Musiman (Arsip)', 'is_active' => false],
        ];

        foreach ($categories as $key => $cat) {
            $category = new ExpenseCategory();
            $category->forceFill($cat)->save();
            $categoryMap[$key] = $category;
        }

        $customerService = app(CustomerService::class);
        $orderService = app(OrderService::class);
        $paymentService = app(PaymentService::class);
        $expenseService = app(ExpenseService::class);

        // 3. Synthetic Florist Customers (12 fictional customers; 0 real business data)
        $customerSpecs = [
            'cakrawala' => ['name' => 'PT Sinar Cakrawala Nusantara', 'phone' => '081200001001', 'notes' => 'Pelanggan korporat papan ucapan peresmian & duka cita (simulasi).'],
            'klinik' => ['name' => 'Klinik Pratama Sehat Sentosa', 'phone' => '081200001002', 'notes' => 'Pemesanan rutin bunga meja resepsionis dan papan selamat (simulasi).'],
            'budi' => ['name' => 'Budi Santoso', 'phone' => '081200001003', 'notes' => 'Pelanggan perorangan wilayah pusat kota (simulasi).'],
            'rina' => ['name' => 'Rina Kusuma Wardhani', 'phone' => '081200001004', 'notes' => 'Sering memesan buket mawar dan standing flower acara keluarga (simulasi).'],
            'karya' => ['name' => 'CV Karya Mandiri Sejahtera', 'phone' => '081200001005', 'notes' => 'Pembayaran via transfer bank perusahaan (simulasi).'],
            'dewi' => ['name' => 'Dewi Lestari Putri', 'phone' => '081200001006', 'notes' => 'Buket wisuda dan rangkaian ulang tahun (simulasi).'],
            'hendra' => ['name' => 'Hendra Wijaya', 'phone' => '081200001007', 'notes' => 'Pesanan papan bunga pembukaan cabang usaha (simulasi).'],
            'yayasan' => ['name' => 'Sekretariat Yayasan Bina Harapan', 'phone' => '081200001008', 'notes' => 'Pemesanan kegiatan resmi dan ucapan simpati (simulasi).'],
            'nadia' => ['name' => 'Nadia Permata Sari', 'phone' => '081200001009', 'notes' => 'Preferensi warna pastel untuk hand bouquet (simulasi).'],
            'notaris' => ['name' => 'Kantor Notaris Arifin & Rekan', 'phone' => '081200001010', 'notes' => 'Invoice tagihan dibayar maksimal H+3 setelah kirim (simulasi).'],
            'siti' => ['name' => 'Siti Rahmawati', 'phone' => '081200001011', 'notes' => 'Pelanggan perorangan untuk bingkisan bunga segar (simulasi).'],
            'kopi' => ['name' => 'Galeri Kopi Meranti', 'phone' => '081200001012', 'notes' => 'Kontak calon pelanggan tanpa pesanan (tersedia untuk uji arsip).'],
        ];

        /** @var array<string, Customer> $customers */
        $customers = [];
        foreach ($customerSpecs as $key => $spec) {
            $customers[$key] = $customerService->create($spec, $demoUser);
        }

        // Helper to advance a newly created item linearly to a target fulfillment status
        $advanceItem = function (Order $order, int $itemId, string $targetStatus) use ($orderService, $demoUser): Order {
            $steps = ['NEW', 'PROCESSING', 'READY', 'DELIVERED'];
            $targetIdx = array_search($targetStatus, $steps, true);
            for ($i = 1; $i <= $targetIdx; $i++) {
                $order = $orderService->updateItemFulfillment($order, $itemId, $steps[$i], $demoUser->id);
            }

            return $order;
        };

        $d = fn (int $offsetDays): string => $today->copy()->addDays($offsetDays)->format('Y-m-d');

        // 4. Synthetic Orders (18 orders covering past 32 days -> +4 days ahead)
        $orderDefinitions = [
            // --- Past month & 30d completed & paid orders ---
            [
                'key' => 'ord_01',
                'customer' => 'cakrawala',
                'order_date' => $d(-31),
                'notes' => 'Pesanan papan ucapan pembukaan gedung baru.',
                'items' => [
                    ['flower_type' => 'Papan Bunga Ucapan Selamat (2x1,5m)', 'recipient' => 'Direksi PT Graha Arta', 'sender_name' => 'PT Sinar Cakrawala Nusantara', 'delivery_date' => $d(-30), 'delivery_location' => 'Jl. Sudirman Kav. 45, Gedung Arta Lt. 1', 'quantity' => 2, 'unit_price' => 850000, 'shipping_mode' => 'INCLUDED', 'shipping_fee' => 0, 'status' => 'DELIVERED'],
                ],
                'payments' => [
                    ['date' => $d(-31), 'amount' => 1700000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-001', 'notes' => 'Pelunasan penuh via transfer BCA'],
                ],
            ],
            [
                'key' => 'ord_02',
                'customer' => 'klinik',
                'order_date' => $d(-27),
                'notes' => 'Rangkaian bunga meja mingguan resepsionis.',
                'items' => [
                    ['flower_type' => 'Bunga Meja Lily & Mawar Putih', 'recipient' => 'Meja Resepsionis Utama', 'sender_name' => 'Manajemen Klinik Sehat Sentosa', 'delivery_date' => $d(-26), 'delivery_location' => 'Jl. Kesehatan No. 18', 'quantity' => 2, 'unit_price' => 325000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 45000, 'status' => 'DELIVERED'],
                ],
                'payments' => [
                    ['date' => $d(-26), 'amount' => 695000, 'method' => 'QRIS', 'reference' => 'QRIS-DEMO-002', 'notes' => 'Pembayaran QRIS saat diterima'],
                ],
            ],
            [
                'key' => 'ord_03',
                'customer' => 'rina',
                'order_date' => $d(-24),
                'notes' => 'Dua rangkaian untuk hari yang berbeda (uji multi-item).',
                'items' => [
                    ['flower_type' => 'Standing Flower Anggrek Bulan', 'recipient' => 'Keluarga Besar Bapak Suryanto', 'sender_name' => 'Rina Kusuma Wardhani', 'delivery_date' => $d(-23), 'delivery_location' => 'Ballroom Hotel Melati Indah', 'quantity' => 1, 'unit_price' => 1150000, 'shipping_mode' => 'INCLUDED', 'shipping_fee' => 0, 'status' => 'DELIVERED'],
                    ['flower_type' => 'Hand Bouquet Mawar Peach Premium', 'recipient' => 'Ibu Kartika', 'sender_name' => 'Rina & Keluarga', 'delivery_date' => $d(-22), 'delivery_location' => 'Perumahan Taman Anggrek Blok C-12', 'quantity' => 1, 'unit_price' => 420000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 35000, 'status' => 'DELIVERED'],
                ],
                'payments' => [
                    ['date' => $d(-24), 'amount' => 600000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-003A', 'notes' => 'DP awal 40%'],
                    ['date' => $d(-22), 'amount' => 1005000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-003B', 'notes' => 'Pelunasan sisa tagihan'],
                ],
            ],
            [
                'key' => 'ord_04',
                'customer' => 'karya',
                'order_date' => $d(-20),
                'notes' => 'Papan bunga duka cita mendadak.',
                'items' => [
                    ['flower_type' => 'Papan Bunga Duka Cita Elegan (2x1,25m)', 'recipient' => 'Almarhum Bapak Darmadi', 'sender_name' => 'Pimpinan & Staf CV Karya Mandiri', 'delivery_date' => $d(-20), 'delivery_location' => 'Rumah Duka Sentosa Ruang 4', 'quantity' => 1, 'unit_price' => 750000, 'shipping_mode' => 'INCLUDED', 'shipping_fee' => 0, 'status' => 'DELIVERED'],
                ],
                'payments' => [
                    ['date' => $d(-19), 'amount' => 750000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-004', 'notes' => 'Transfer lunas H+1'],
                ],
            ],
            [
                'key' => 'ord_05',
                'customer' => 'dewi',
                'order_date' => $d(-17),
                'notes' => 'Buket wisuda universitas.',
                'items' => [
                    ['flower_type' => 'Hand Bouquet Sunflower & Baby Breath', 'recipient' => 'Ananda Fajar Pratama, S.Kom.', 'sender_name' => 'Dewi Lestari Putri', 'delivery_date' => $d(-16), 'delivery_location' => 'Auditorium Kampus Utama Pintu Timur', 'quantity' => 2, 'unit_price' => 275000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 30000, 'status' => 'DELIVERED'],
                ],
                'payments' => [
                    ['date' => $d(-17), 'amount' => 580000, 'method' => 'CASH', 'reference' => 'TUNAI-DEMO-005', 'notes' => 'Bayar tunai di toko'],
                ],
            ],
            [
                'key' => 'ord_06',
                'customer' => 'hendra',
                'order_date' => $d(-14),
                'notes' => 'Grand opening restoran cabang selatan.',
                'items' => [
                    ['flower_type' => 'Papan Bunga Grand Opening Double (2x2m)', 'recipient' => 'Restoran Rasa Nusantara Cab. Selatan', 'sender_name' => 'Hendra Wijaya & Rekan', 'delivery_date' => $d(-13), 'delivery_location' => 'Jl. Raya Kemang Selatan No. 88', 'quantity' => 2, 'unit_price' => 1100000, 'shipping_mode' => 'INCLUDED', 'shipping_fee' => 0, 'status' => 'DELIVERED'],
                ],
                'payments' => [
                    ['date' => $d(-14), 'amount' => 1200000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-006A', 'notes' => 'DP awal'],
                    ['date' => $d(-12), 'amount' => 1000000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-006B', 'notes' => 'Pelunasan setelah foto kirim diterima'],
                ],
            ],
            [
                'key' => 'ord_07',
                'customer' => 'yayasan',
                'order_date' => $d(-11),
                'notes' => 'Rangkaian mimbar & meja pembicara seminar.',
                'items' => [
                    ['flower_type' => 'Bunga Podium & Meja Pembicara', 'recipient' => 'Panitia Seminar Pendidikan', 'sender_name' => 'Yayasan Bina Harapan', 'delivery_date' => $d(-10), 'delivery_location' => 'Gedung Serbaguna Bina Harapan Lt. 2', 'quantity' => 3, 'unit_price' => 350000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 60000, 'status' => 'DELIVERED'],
                ],
                'payments' => [
                    ['date' => $d(-11), 'amount' => 500000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-007-ERR', 'notes' => 'Salah input nominal DP (akan di-void)', 'void_reason' => 'Kesalahan input nominal transfer, diganti catatan resmi'],
                    ['date' => $d(-10), 'amount' => 1110000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-007', 'notes' => 'Pelunasan penuh sesuai invoice'],
                ],
            ],
            [
                'key' => 'ord_08',
                'customer' => 'budi',
                'order_date' => $d(-9),
                'notes' => 'Bingkisan ulang tahun pernikahan.',
                'items' => [
                    ['flower_type' => 'Bloom Box Mawar Merah & Eustoma', 'recipient' => 'Ibu Ratna Santoso', 'sender_name' => 'Budi Santoso', 'delivery_date' => $d(-8), 'delivery_location' => 'Cluster Cendana No. 21', 'quantity' => 1, 'unit_price' => 550000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 40000, 'status' => 'DELIVERED'],
                ],
                'payments' => [
                    ['date' => $d(-8), 'amount' => 590000, 'method' => 'QRIS', 'reference' => 'QRIS-DEMO-008', 'notes' => 'Lunas via QRIS'],
                ],
            ],
            [
                'key' => 'ord_09',
                'customer' => 'notaris',
                'order_date' => $d(-7),
                'notes' => 'Sudah dikirim lengkap, menunggu pelunasan invoice kantor (uji COMPLETED + UNPAID).',
                'items' => [
                    ['flower_type' => 'Papan Bunga Selamat & Sukses (2x1,5m)', 'recipient' => 'Kantor Hukum Pratama & Associates', 'sender_name' => 'Kantor Notaris Arifin & Rekan', 'delivery_date' => $d(-6), 'delivery_location' => 'Jl. Diponegoro No. 54', 'quantity' => 1, 'unit_price' => 850000, 'shipping_mode' => 'INCLUDED', 'shipping_fee' => 0, 'status' => 'DELIVERED'],
                ],
                'payments' => [],
            ],
            [
                'key' => 'ord_10',
                'customer' => 'nadia',
                'order_date' => $d(-5),
                'notes' => 'Buket pastel + kartu ucapan khusus.',
                'items' => [
                    ['flower_type' => 'Hand Bouquet Hydrangea & Mawar Pink', 'recipient' => 'dr. Clara Puspita', 'sender_name' => 'Nadia Permata Sari', 'delivery_date' => $d(-4), 'delivery_location' => 'RS Harapan Bunda Poli Anak', 'quantity' => 1, 'unit_price' => 480000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 35000, 'status' => 'DELIVERED'],
                ],
                'payments' => [
                    ['date' => $d(-5), 'amount' => 515000, 'method' => 'QRIS', 'reference' => 'QRIS-DEMO-010', 'notes' => 'Lunas saat pesan'],
                ],
            ],
            [
                'key' => 'ord_11',
                'customer' => 'cakrawala',
                'order_date' => $d(-4),
                'notes' => 'Sebagian sudah dibayar DP, pengiriman selesai (uji COMPLETED + PARTIAL).',
                'items' => [
                    ['flower_type' => 'Standing Flower VIP Krisan & Lily', 'recipient' => 'Pimpinan Cabang Bank Mandiri Metro', 'sender_name' => 'PT Sinar Cakrawala Nusantara', 'delivery_date' => $d(-3), 'delivery_location' => 'Jl. Jenderal Ahmad Yani No. 12', 'quantity' => 2, 'unit_price' => 950000, 'shipping_mode' => 'INCLUDED', 'shipping_fee' => 0, 'status' => 'DELIVERED'],
                ],
                'payments' => [
                    ['date' => $d(-4), 'amount' => 900000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-011', 'notes' => 'DP 50% menunggu pelunasan keuangan'],
                ],
            ],

            // --- Overdue active delivery item (1 day overdue -> visible urgency on Dashboard) ---
            [
                'key' => 'ord_12',
                'customer' => 'karya',
                'order_date' => $d(-3),
                'notes' => 'Permintaan revisi alamat pengiriman, siap diberangkatkan pagi ini.',
                'items' => [
                    ['flower_type' => 'Papan Bunga Ucapan Selamat (2x1,25m)', 'recipient' => 'Direktur PT Mitra Logistik Prima', 'sender_name' => 'CV Karya Mandiri Sejahtera', 'delivery_date' => $d(-1), 'delivery_location' => 'Kawasan Industri Blok B-7', 'quantity' => 1, 'unit_price' => 780000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 70000, 'status' => 'READY'],
                ],
                'payments' => [
                    ['date' => $d(-3), 'amount' => 400000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-012', 'notes' => 'DP awal'],
                ],
            ],

            // --- Today's operational orders (deliveries today across READY, PROCESSING, NEW, DELIVERED) ---
            [
                'key' => 'ord_13',
                'customer' => 'klinik',
                'order_date' => $d(-2),
                'notes' => 'Pengiriman pagi hari untuk peresmian ruang rawat.',
                'items' => [
                    ['flower_type' => 'Standing Flower Mawar Putih & Casablanka', 'recipient' => 'Klinik Pratama Sehat Sentosa', 'sender_name' => 'dr. Arman & Tim', 'delivery_date' => $d(0), 'delivery_location' => 'Jl. Kesehatan No. 18 Lobby Utama', 'quantity' => 1, 'unit_price' => 980000, 'shipping_mode' => 'INCLUDED', 'shipping_fee' => 0, 'status' => 'DELIVERED'],
                    ['flower_type' => 'Bunga Meja Anggrek Mini', 'recipient' => 'Ruang Konsultasi 1 & 2', 'sender_name' => 'Manajemen Klinik', 'delivery_date' => $d(0), 'delivery_location' => 'Jl. Kesehatan No. 18 Lt. 2', 'quantity' => 2, 'unit_price' => 260000, 'shipping_mode' => 'INCLUDED', 'shipping_fee' => 0, 'status' => 'READY'],
                ],
                'payments' => [
                    ['date' => $d(0), 'amount' => 1500000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-013', 'notes' => 'Pelunasan penuh hari ini'],
                ],
            ],
            [
                'key' => 'ord_14',
                'customer' => 'siti',
                'order_date' => $d(-1),
                'notes' => 'Kirim sebelum jam 15.00 WIB.',
                'items' => [
                    ['flower_type' => 'Hand Bouquet Mawar Merah 20 Tangkai', 'recipient' => 'Ibu Mariana', 'sender_name' => 'Siti Rahmawati', 'delivery_date' => $d(0), 'delivery_location' => 'Jl. Melati Raya No. 7', 'quantity' => 1, 'unit_price' => 385000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 30000, 'status' => 'PROCESSING'],
                ],
                'payments' => [
                    ['date' => $d(-1), 'amount' => 415000, 'method' => 'QRIS', 'reference' => 'QRIS-DEMO-014', 'notes' => 'Bayar lunas QRIS'],
                ],
            ],
            [
                'key' => 'ord_15',
                'customer' => 'hendra',
                'order_date' => $d(0),
                'notes' => 'Pesanan masuk hari ini untuk pengiriman sore & besok.',
                'items' => [
                    ['flower_type' => 'Papan Bunga Ucapan Selamat (2x1,5m)', 'recipient' => 'Toko Emas Cahaya Baru', 'sender_name' => 'Hendra Wijaya', 'delivery_date' => $d(0), 'delivery_location' => 'Jl. Pasar Baru No. 32', 'quantity' => 1, 'unit_price' => 850000, 'shipping_mode' => 'INCLUDED', 'shipping_fee' => 0, 'status' => 'NEW'],
                    ['flower_type' => 'Standing Flower Anggrek Ungu', 'recipient' => 'Toko Emas Cahaya Baru', 'sender_name' => 'Keluarga Hendra Wijaya', 'delivery_date' => $d(1), 'delivery_location' => 'Jl. Pasar Baru No. 32', 'quantity' => 1, 'unit_price' => 920000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 50000, 'status' => 'NEW'],
                ],
                'payments' => [
                    ['date' => $d(0), 'amount' => 850000, 'method' => 'CASH', 'reference' => 'TUNAI-DEMO-015', 'notes' => 'Pembayaran tahap pertama tunai'],
                ],
            ],

            // --- Upcoming scheduled deliveries (+1 to +4 days) ---
            [
                'key' => 'ord_16',
                'customer' => 'rina',
                'order_date' => $d(0),
                'notes' => 'Acara lamaran keluarga akhir pekan.',
                'items' => [
                    ['flower_type' => 'Rangkaian Bunga Meja Akad & Vas Kaca', 'recipient' => 'Keluarga Rina Kusuma', 'sender_name' => 'Rina Kusuma Wardhani', 'delivery_date' => $d(2), 'delivery_location' => 'Jl. Cempaka Putih Tengah No. 14', 'quantity' => 3, 'unit_price' => 340000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 55000, 'status' => 'PROCESSING'],
                ],
                'payments' => [
                    ['date' => $d(0), 'amount' => 500000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-016', 'notes' => 'DP booking rangkaian'],
                ],
            ],
            [
                'key' => 'ord_17',
                'customer' => 'yayasan',
                'order_date' => $d(0),
                'notes' => 'Tagihan dibayar setelah acara selesai (UNPAID).',
                'items' => [
                    ['flower_type' => 'Papan Bunga Apresiasi Mitra (2x1,5m)', 'recipient' => 'Seluruh Relawan Pendidikan 2026', 'sender_name' => 'Pengurus Yayasan Bina Harapan', 'delivery_date' => $d(3), 'delivery_location' => 'Balai Pertemuan Kota Ruang Anggrek', 'quantity' => 2, 'unit_price' => 800000, 'shipping_mode' => 'INCLUDED', 'shipping_fee' => 0, 'status' => 'NEW'],
                ],
                'payments' => [],
            ],
            [
                'key' => 'ord_18',
                'customer' => 'dewi',
                'order_date' => $d(-1),
                'notes' => 'Pengiriman hadiah ulang tahun.',
                'items' => [
                    ['flower_type' => 'Bloom Box Tulip & Mawar Putih', 'recipient' => 'Ibu Larasati', 'sender_name' => 'Dewi Lestari Putri', 'delivery_date' => $d(1), 'delivery_location' => 'Perumahan Bukit Hijau Blok A-5', 'quantity' => 1, 'unit_price' => 620000, 'shipping_mode' => 'SEPARATE', 'shipping_fee' => 35000, 'status' => 'READY'],
                ],
                'payments' => [
                    ['date' => $d(-1), 'amount' => 655000, 'method' => 'TRANSFER', 'reference' => 'TRF-DEMO-018', 'notes' => 'Lunas penuh'],
                ],
            ],
        ];

        foreach ($orderDefinitions as $def) {
            $itemsPayload = array_map(static fn (array $item): array => [
                'flower_type' => $item['flower_type'],
                'recipient' => $item['recipient'],
                'sender_name' => $item['sender_name'],
                'delivery_date' => $item['delivery_date'],
                'delivery_location' => $item['delivery_location'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
                'shipping_mode' => $item['shipping_mode'],
                'shipping_fee' => $item['shipping_fee'],
                'notes' => $item['notes'] ?? null,
            ], $def['items']);

            $order = $orderService->create([
                'customer_id' => $customers[$def['customer']]->id,
                'order_date' => $def['order_date'],
                'notes' => $def['notes'],
                'items' => $itemsPayload,
            ], $demoUser->id);

            // Backdate created_at smoothly to align recent activity timeline chronologically
            $orderCreatedAt = Carbon::parse($def['order_date'], 'Asia/Jakarta')->setTime(9, 15);
            if ($orderCreatedAt->gt($nowWib)) {
                $orderCreatedAt = $nowWib->copy()->subMinutes(20);
            }
            DB::table('orders')->where('id', $order->id)->update([
                'created_at' => $orderCreatedAt,
                'updated_at' => $orderCreatedAt,
            ]);

            $persistedItems = $order->items()->orderBy('id')->get();
            foreach ($def['items'] as $idx => $itemDef) {
                $targetStatus = $itemDef['status'] ?? 'NEW';
                if ($targetStatus !== 'NEW' && isset($persistedItems[$idx])) {
                    $order = $advanceItem($order, $persistedItems[$idx]->id, $targetStatus);
                }
            }

            foreach ($def['payments'] as $pIdx => $payDef) {
                $payment = $paymentService->record($order, [
                    'payment_date' => $payDef['date'],
                    'amount' => $payDef['amount'],
                    'method' => $payDef['method'],
                    'reference' => $payDef['reference'],
                    'idempotency_key' => (string) Str::uuid(),
                    'notes' => $payDef['notes'],
                ], $demoUser->id);

                $payTs = Carbon::parse($payDef['date'], 'Asia/Jakarta')->setTime(11 + $pIdx, 30);
                if ($payTs->gt($nowWib)) {
                    $payTs = $nowWib->copy()->subMinutes(10);
                }
                DB::table('payments')->where('id', $payment->id)->update([
                    'created_at' => $payTs,
                    'updated_at' => $payTs,
                ]);

                if (! empty($payDef['void_reason'])) {
                    $paymentService->void($order, $payment, (string) $payDef['void_reason'], $demoUser->id);
                }
            }
        }

        // 5. Synthetic Operational Expenses (16 POSTED + 1 VOIDED across 30 days)
        $expenseDefinitions = [
            ['date' => $d(-29), 'cat' => 'flowers', 'amount' => 1150000, 'desc' => 'Belanja stok mawar, krisan, dan lily pasar bunga grosir'],
            ['date' => $d(-26), 'cat' => 'boards', 'amount' => 480000, 'desc' => 'Pembelian 4 rangka papan bunga kayu & sterofoam'],
            ['date' => $d(-24), 'cat' => 'courier', 'amount' => 165000, 'desc' => 'Ongkos kirim mobil bak & kurir harian pesanan luar kota'],
            ['date' => $d(-21), 'cat' => 'supplies', 'amount' => 235000, 'desc' => 'Kertas wrapping cellophane, pita satin, dan floral foam'],
            ['date' => $d(-18), 'cat' => 'flowers', 'amount' => 920000, 'desc' => 'Restok anggrek bulan, sunflower, dan baby breath segar'],
            ['date' => $d(-15), 'cat' => 'utilities', 'amount' => 450000, 'desc' => 'Token listrik pendingin bunga (chiller) dan air toko'],
            ['date' => $d(-13), 'cat' => 'courier', 'amount' => 210000, 'desc' => 'Biaya sewa armada pengantaran papan grand opening'],
            ['date' => $d(-11), 'cat' => 'boards', 'amount' => 360000, 'desc' => 'Kain beludru latar papan dan jarum pentul stok bengkel'],
            ['date' => $d(-9), 'cat' => 'flowers', 'amount' => 840000, 'desc' => 'Pembelian mawar semi holland dan daun ruscus'],
            ['date' => $d(-7), 'cat' => 'supplies', 'amount' => 195000, 'desc' => 'Vas kaca silinder, kartu ucapan cetak, dan busa basah'],
            ['date' => $d(-5), 'cat' => 'courier', 'amount' => 125000, 'desc' => 'Ongkos kurir motor pengantaran hand bouquet'],
            ['date' => $d(-4), 'cat' => 'flowers', 'amount' => 760000, 'desc' => 'Belanja bunga potong lily casablanka dan krisan putih'],
            ['date' => $d(-3), 'cat' => 'supplies', 'amount' => 180000, 'desc' => 'Salah catat dobel pembelian pita (akan di-void)', 'void_reason' => 'Catatan pengeluaran tercatat ganda dari nota pembelian sebelumnya'],
            ['date' => $d(-2), 'cat' => 'boards', 'amount' => 290000, 'desc' => 'Perbaikan kaki penyangga standing flower & cat semprot'],
            ['date' => $d(-1), 'cat' => 'courier', 'amount' => 145000, 'desc' => 'Biaya bahan bakar & kurir pengiriman wilayah barat'],
            ['date' => $d(0), 'cat' => 'flowers', 'amount' => 680000, 'desc' => 'Belanja bunga segar pagi untuk antrean rangkai hari ini'],
            ['date' => $d(0), 'cat' => 'courier', 'amount' => 95000, 'desc' => 'Ongkos kirim kurir pesanan pagi Klinik Sehat Sentosa'],
        ];

        foreach ($expenseDefinitions as $idx => $expDef) {
            $expense = $expenseService->record([
                'expense_category_id' => $categoryMap[$expDef['cat']]->id,
                'expense_date' => $expDef['date'],
                'amount' => $expDef['amount'],
                'description' => $expDef['desc'],
                'idempotency_key' => (string) Str::uuid(),
            ], $demoUser->id);

            $expTs = Carbon::parse($expDef['date'], 'Asia/Jakarta')->setTime(8, 10 + ($idx % 40));
            if ($expTs->gt($nowWib)) {
                $expTs = $nowWib->copy()->subMinutes(5);
            }
            DB::table('expenses')->where('id', $expense->id)->update([
                'created_at' => $expTs,
                'updated_at' => $expTs,
            ]);

            if (! empty($expDef['void_reason'])) {
                $expenseService->void($expense, (string) $expDef['void_reason'], $demoUser->id);
            }
        }
    }
}
