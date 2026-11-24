<?php

namespace App\Http\Controllers;

use App\Services\ReportService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class UiReportController extends Controller
{
    public function __construct(
        protected ReportService $reportService
    ) {}

    /**
     * Display the financial and operational reports dashboard.
     *
     * Core summary is wrapped in a memoized closure so deferred partial reloads
     * (details / reportTrends) skip re-running the 5-way summary query.
     */
    public function index(Request $request): Response
    {
        $preset = $request->query('preset', '30d');
        $from = $request->query('from');
        $to = $request->query('to');
        $granularity = $request->query('granularity');

        $presetStr = is_string($preset) ? $preset : '30d';
        $fromStr = is_string($from) ? $from : null;
        $toStr = is_string($to) ? $to : null;
        $granularityStr = is_string($granularity) ? $granularity : null;

        $periodMemo = null;
        $getPeriod = function () use ($presetStr, $fromStr, $toStr, &$periodMemo): array {
            return $periodMemo ??= $this->reportService->resolvePeriod($presetStr, $fromStr, $toStr);
        };

        $coreMemo = null;
        $getCore = function () use ($presetStr, $fromStr, $toStr, &$coreMemo): array {
            return $coreMemo ??= $this->reportService->getSummaryReport($presetStr, $fromStr, $toStr);
        };

        return Inertia::render('Reports/Index', [
            'report' => fn () => $getCore(),
            'reportBreakdowns' => Inertia::defer(
                function () use ($getPeriod, &$coreMemo): array {
                    $period = $coreMemo ? $coreMemo['period'] : $getPeriod();
                    $cashOut = $coreMemo ? $coreMemo['summary']['cash_out'] : null;
                    $cashIn = $coreMemo ? $coreMemo['summary']['cash_in'] : null;

                    return $this->reportService->getBreakdowns($period['from'], $period['to'], $cashOut, $cashIn);
                },
                'details',
                true
            ),
            'reportTrends' => Inertia::defer(
                function () use ($getPeriod, $granularityStr, &$coreMemo): array {
                    $period = $coreMemo ? $coreMemo['period'] : $getPeriod();

                    return $this->reportService->getTrendSeries($period, $granularityStr);
                },
                'details',
                true
            ),
        ]);
    }

    /**
     * Export the financial and operational report to Excel (.xlsx).
     */
    public function export(Request $request): BinaryFileResponse
    {
        $preset = $request->query('preset', '30d');
        $from = $request->query('from');
        $to = $request->query('to');

        $period = $this->reportService->resolvePeriod(
            is_string($preset) ? $preset : '30d',
            is_string($from) ? $from : null,
            is_string($to) ? $to : null
        );

        $filePath = $this->reportService->exportExcel($preset, $from, $to);
        $downloadName = 'laporan-mutiara-florist-'.$period['from'].'-sd-'.$period['to'].'.xlsx';

        return response()->download($filePath, $downloadName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$downloadName.'"',
        ])->deleteFileAfterSend(true);
    }
}
