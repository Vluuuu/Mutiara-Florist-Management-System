<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use Inertia\Inertia;
use Inertia\Response;

class UiDashboardController extends Controller
{
    /**
     * Dashboard React/Inertia (Phase 13C). Menghitung statistik lewat
     * DashboardService yang sama dengan dashboard Blade lama, sehingga angka
     * keduanya tidak mungkin berbeda.
     *
     * Prop awal memakai closure ter-memoisasi agar partial reload deferred
     * (receivables / insights) tidak menjalankan ulang 3 query awal.
     */
    public function __invoke(DashboardService $dashboard): Response
    {
        $statsMemo = null;
        $getStats = function () use ($dashboard, &$statsMemo): array {
            return $statsMemo ??= $dashboard->stats();
        };

        $queueMemo = null;
        $getQueue = function () use ($dashboard, &$queueMemo): array {
            return $queueMemo ??= $dashboard->activeDeliveryQueue();
        };

        $nowWib = now('Asia/Jakarta');

        return Inertia::render('Dashboard', [
            'stats' => fn () => $getStats(),
            'todayStats' => fn () => $dashboard->todayStats(),
            'deliveryQueue' => fn () => $getQueue()['items'],
            'queueSummary' => fn () => [
                'total_count' => $getQueue()['total_count'],
                'overdue_count' => $getQueue()['overdue_count'],
                'today_count' => $getQueue()['today_count'],
                'ready_count' => $getQueue()['ready_count'],
            ],
            // Daftar piutang terbuka dimuat deferred agar antrean pengiriman hari ini tampil secepat mungkin.
            'receivables' => Inertia::defer(
                fn () => $dashboard->openReceivables(),
                'receivables',
                true
            ),
            // Analitik arus kas (7h/30h) & aktivitas bisnis terbaru dimuat deferred terpisah tanpa menambah round-trip awal.
            'cashFlowPulse' => Inertia::defer(
                fn () => $dashboard->cashFlowPulse(),
                'insights',
                true
            ),
            'recentActivity' => Inertia::defer(
                fn () => $dashboard->recentActivity(),
                'insights',
                true
            ),
            'todayIso' => $nowWib->toDateString(),
            'todayDisplay' => $nowWib->locale('id')->translatedFormat('l, d F Y'),
            'summary_formatted' => function () use ($getStats): array {
                $stats = $getStats();

                return [
                    'billed' => 'Rp'.number_format($stats['billed'], 0, ',', '.'),
                    'received' => 'Rp'.number_format($stats['received'], 0, ',', '.'),
                    'outstanding' => 'Rp'.number_format($stats['outstanding'], 0, ',', '.'),
                    'expenses' => 'Rp'.number_format($stats['expenses'], 0, ',', '.'),
                    'cash_flow' => 'Rp'.number_format($stats['cash_flow'], 0, ',', '.'),
                    'zero' => 'Rp0',
                ];
            },
        ]);
    }
}
