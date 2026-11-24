<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreExpenseRequest;
use App\Http\Requests\VoidExpenseRequest;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Services\ExpenseService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UiExpenseController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:POSTED,VOIDED'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $search = trim((string) ($filters['q'] ?? ''));
        $categoryId = $filters['category_id'] ?? null;
        $status = $filters['status'] ?? null;
        $from = $filters['from'] ?? null;
        $to = $filters['to'] ?? null;

        if ($from && $to && $to < $from) {
            throw ValidationException::withMessages([
                'to' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.',
            ]);
        }

        $pattern = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search) . '%';

        $query = Expense::query()
            ->with(['category:id,name', 'recordedBy:id,name'])
            ->when($search !== '', function ($q) use ($pattern) {
                $likeOp = $q->getConnection()->getDriverName() === 'pgsql' ? 'ILIKE' : 'LIKE';
                $q->whereRaw("description {$likeOp} ? ESCAPE '!'", [$pattern]);
            })
            ->when(!empty($categoryId), fn ($q) => $q->where('expense_category_id', (int) $categoryId))
            ->when(!empty($from), fn ($q) => $q->whereDate('expense_date', '>=', $from))
            ->when(!empty($to), fn ($q) => $q->whereDate('expense_date', '<=', $to))
            ->when(!empty($status), fn ($q) => $q->where('status', $status));

        $postedTotal = (int) (clone $query)->where('status', 'POSTED')->sum('amount');

        $expenses = $query->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Expense $expense): array => self::formatExpenseForUi($expense));

        $categories = ExpenseCategory::query()
            ->orderBy('name')
            ->get(['id', 'name', 'is_active']);

        return Inertia::render('Expenses/Index', [
            'expenses' => $expenses,
            'postedTotal' => $postedTotal,
            'categories' => $categories,
            'filters' => [
                'q' => $search,
                'category_id' => $categoryId ? (int) $categoryId : null,
                'status' => $status,
                'from' => $from,
                'to' => $to,
            ],
        ]);
    }

    public function create(): Response
    {
        $categories = ExpenseCategory::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Expenses/Create', [
            'categories' => $categories,
            'newExpenseKey' => (string) Str::uuid(),
            'todayIso' => now('Asia/Jakarta')->toDateString(),
        ]);
    }

    public function store(StoreExpenseRequest $request, ExpenseService $service): RedirectResponse
    {
        $expense = $service->record(
            $request->validated(),
            (int) $request->user()->getAuthIdentifier()
        );

        return redirect()->route('ui-expenses.index')
            ->with('success', 'Pengeluaran Rp' . number_format($expense->amount, 0, ',', '.') . ' berhasil dicatat.');
    }

    public function void(VoidExpenseRequest $request, Expense $expense, ExpenseService $service): RedirectResponse
    {
        $service->void(
            $expense,
            $request->validated()['void_reason'],
            (int) $request->user()->getAuthIdentifier()
        );

        return redirect()->route('ui-expenses.index')
            ->with('success', 'Kesalahan pencatatan pengeluaran telah di-void. Tidak ada uang yang otomatis dikembalikan.');
    }

    /**
     * Explicit UI payload serializer for expenses. Preserves integer recorded_by FK
     * while exposing only safe recorder identity fields (id, name) or null fallback.
     *
     * @return array<string, mixed>
     */
    public static function formatExpenseForUi(Expense $expense): array
    {
        $recorder = $expense->relationLoaded('recordedBy') ? $expense->getRelation('recordedBy') : null;
        $category = $expense->relationLoaded('category') ? $expense->getRelation('category') : null;
        $rawRecordedBy = $expense->getRawOriginal('recorded_by') ?? $expense->getAttributes()['recorded_by'] ?? 0;

        return [
            'id' => (int) $expense->id,
            'expense_category_id' => (int) $expense->expense_category_id,
            'recorded_by' => (int) $rawRecordedBy,
            'expense_date' => $expense->expense_date?->format('d/m/Y') ?? '',
            'expense_date_raw' => $expense->expense_date?->format('Y-m-d'),
            'amount' => (int) $expense->amount,
            'description' => $expense->description,
            'idempotency_key' => $expense->idempotency_key,
            'status' => $expense->status,
            'void_reason' => $expense->void_reason,
            'voided_at' => $expense->voided_at
                ? $expense->voided_at->timezone('Asia/Jakarta')->format('d/m/Y H:i').' WIB'
                : null,
            'category' => $category ? [
                'id' => (int) $category->id,
                'name' => $category->name,
            ] : null,
            'recorded_by_user' => $recorder ? [
                'id' => (int) $recorder->id,
                'name' => $recorder->name,
            ] : null,
        ];
    }
}
