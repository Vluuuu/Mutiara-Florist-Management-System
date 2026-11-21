<?php

namespace App\Http\Controllers;

use App\Services\ReportService;
use Carbon\Carbon;
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

        $coreReport = $this->reportService->getSummaryReport($presetStr, $fromStr, $toStr);
        $period = $coreReport['period'];
        $cashOut = $coreReport['summary']['cash_out'];

        return Inertia::render('Reports/Index', [
            'report' => $coreReport,
            'reportBreakdowns' => Inertia::defer(
                fn () => $this->reportService->getBreakdowns($period['from'], $period['to'], $cashOut),
                'details',
                true
            ),
            'reportTrends' => Inertia::defer(
                fn () => $this->reportService->getTrendSeries($period, $granularityStr),
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
