<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use Inertia\Inertia;
use Inertia\Response;

class UiDashboardController extends Controller
{
    /**
     * Dashboard React/Inertia (Phase 3.3.1). Menghitung statistik lewat
     * DashboardService yang sama dengan dashboard Blade lama, sehingga angka
     * keduanya tidak mungkin berbeda.
     */
    public function __invoke(DashboardService $dashboard): Response
    {
        $stats = $dashboard->stats();
        $todayStats = $dashboard->todayStats();
        $queue = $dashboard->activeDeliveryQueue();
        $nowWib = now('Asia/Jakarta');

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'todayStats' => $todayStats,
            'deliveryQueue' => $queue['items'],
            'queueSummary' => [
                'total_count' => $queue['total_count'],
                'overdue_count' => $queue['overdue_count'],
                'today_count' => $queue['today_count'],
                'ready_count' => $queue['ready_count'],
            ],
            // Daftar piutang terbuka dimuat deferred agar antrean pengiriman hari ini tampil secepat mungkin.
            'receivables' => Inertia::defer(
                fn () => $dashboard->openReceivables(),
                'receivables',
                true
            ),
            'todayIso' => $nowWib->toDateString(),
            'todayDisplay' => $nowWib->locale('id')->translatedFormat('l, d F Y'),
            'summary_formatted' => [
                'billed' => 'Rp'.number_format($stats['billed'], 0, ',', '.'),
                'received' => 'Rp'.number_format($stats['received'], 0, ',', '.'),
                'outstanding' => 'Rp'.number_format($stats['outstanding'], 0, ',', '.'),
                'expenses' => 'Rp'.number_format($stats['expenses'], 0, ',', '.'),
                'cash_flow' => 'Rp'.number_format($stats['cash_flow'], 0, ',', '.'),
                'zero' => 'Rp0',
            ],
        ]);
    }
}
