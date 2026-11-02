<?php

namespace App\Http\Controllers;

use App\Http\Requests\ExpenseCategoryRequest;
use App\Models\ExpenseCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class ExpenseCategoryController extends Controller
{
    public function index(): View
    {
        $categories = ExpenseCategory::query()
            ->withCount('expenses')
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();

        return view('expense-categories.index', compact('categories'));
    }

    public function store(ExpenseCategoryRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request): void {
            $category = new ExpenseCategory();
            $category->forceFill([
                'name' => $request->validated()['name'],
                'is_active' => true,
            ])->save();

            $this->audit($request, 'expense_category.created', $category, [
                'name_after' => $category->name,
            ]);
        });

        return redirect()->route('expense-categories.index')
            ->with('success', 'Kategori pengeluaran berhasil ditambahkan.');
    }

    public function update(ExpenseCategoryRequest $request, ExpenseCategory $expenseCategory): RedirectResponse
    {
        DB::transaction(function () use ($request, $expenseCategory): void {
            $locked = ExpenseCategory::query()->whereKey($expenseCategory->id)
                ->lockForUpdate()->firstOrFail();

            $oldName = $locked->name;
            $locked->forceFill(['name' => $request->validated()['name']]);

            if ($locked->isDirty('name')) {
                $locked->save();
                $this->audit($request, 'expense_category.renamed', $locked, [
                    'name_before' => $oldName,
                    'name_after' => $locked->name,
                ]);
            }
        });

        return redirect()->route('expense-categories.index')
            ->with('success', 'Nama kategori berhasil diperbarui.');
    }

    public function status(Request $request, ExpenseCategory $expenseCategory): RedirectResponse
    {
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        $active = (bool) $data['is_active'];

        DB::transaction(function () use ($request, $expenseCategory, $active): void {
            $locked = ExpenseCategory::query()->whereKey($expenseCategory->id)
                ->lockForUpdate()->firstOrFail();

            if ($locked->is_active === $active) {
                return;
            }

            $locked->forceFill(['is_active' => $active])->save();

            $this->audit($request, $active ? 'expense_category.activated' : 'expense_category.deactivated', $locked, [
                'is_active_after' => $active,
            ]);
        });

        return redirect()->route('expense-categories.index')
            ->with('success', $active ? 'Kategori diaktifkan kembali.' : 'Kategori dinonaktifkan. Riwayat pengeluaran tetap tersedia.');
    }

    private function audit(Request $request, string $action, ExpenseCategory $category, array $summary): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $request->user()->getAuthIdentifier(),
            'action' => $action,
            'subject_type' => 'expense_category',
            'subject_id' => $category->id,
            'change_summary' => json_encode($summary, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }
}
