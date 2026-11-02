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
use Illuminate\View\View;

class ExpenseController extends Controller
{
    public function index(Request $request): View
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:POSTED,VOIDED'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $search = trim((string) ($filters['q'] ?? ''));
        $categoryId = $filters['category_id'] ?? '';
        $status = $filters['status'] ?? '';
        $from = $filters['from'] ?? '';
        $to = $filters['to'] ?? '';

        // A date-to-only filter is valid; compare only when both dates are set.
        if ($from !== '' && $to !== '' && $to < $from) {
            throw ValidationException::withMessages([
                'to' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai.',
            ]);
        }

        $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';

        $query = Expense::query()
            ->with(['category:id,name', 'recordedBy:id,name'])
            ->when($search !== '', fn ($query) => $query->whereRaw("description LIKE ? ESCAPE '!'", [$pattern]))
            ->when($categoryId !== '', fn ($query) => $query->where('expense_category_id', $categoryId))
            ->when($from !== '', fn ($query) => $query->whereDate('expense_date', '>=', $from))
            ->when($to !== '', fn ($query) => $query->whereDate('expense_date', '<=', $to))
            ->when($status !== '', fn ($query) => $query->where('status', $status));

        $postedTotal = (int) (clone $query)->where('status', 'POSTED')->sum('amount');
        $expenses = $query->orderByDesc('expense_date')->orderByDesc('id')
            ->paginate(10)->withQueryString();
        $categories = ExpenseCategory::query()->orderBy('name')->get(['id', 'name', 'is_active']);

        return view('expenses.index', compact(
            'expenses', 'postedTotal', 'categories', 'search', 'categoryId', 'status', 'from', 'to'
        ));
    }

    public function create(): View
    {
        $categories = ExpenseCategory::query()
            ->where('is_active', true)->orderBy('name')->get(['id', 'name']);

        return view('expenses.create', [
            'categories' => $categories,
            'newExpenseKey' => (string) Str::uuid(),
        ]);
    }

    public function store(StoreExpenseRequest $request, ExpenseService $service): RedirectResponse
    {
        $expense = $service->record(
            $request->validated(), (int) $request->user()->getAuthIdentifier()
        );

        return redirect()->route('expenses.index')
            ->with('success', 'Pengeluaran Rp'.number_format($expense->amount, 0, ',', '.').' berhasil dicatat.');
    }

    public function void(VoidExpenseRequest $request, Expense $expense, ExpenseService $service): RedirectResponse
    {
        $service->void(
            $expense, $request->validated()['void_reason'],
            (int) $request->user()->getAuthIdentifier()
        );

        return redirect()->route('expenses.index')
            ->with('success', 'Kesalahan pencatatan pengeluaran telah di-void. Tidak ada uang yang otomatis dikembalikan.');
    }
}
