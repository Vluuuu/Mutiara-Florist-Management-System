<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ExpenseService
{
    public function record(array $data, int $actorId): Expense
    {
        try {
            return DB::transaction(function () use ($data, $actorId): Expense {
                $existing = Expense::query()->where('idempotency_key', $data['idempotency_key'])->first();

                if ($existing !== null) {
                    return $this->matchingRetry($existing, $data);
                }

                $category = ExpenseCategory::query()
                    ->whereKey((int) $data['expense_category_id'])
                    ->lockForUpdate()
                    ->first();

                if ($category === null || ! $category->is_active) {
                    throw ValidationException::withMessages([
                        'expense_category_id' => 'Kategori tidak aktif atau tidak ditemukan.',
                    ]);
                }

                $expense = new Expense();
                $expense->forceFill([
                    'expense_category_id' => $category->id,
                    'recorded_by' => $actorId,
                    'expense_date' => $data['expense_date'],
                    'amount' => (int) $data['amount'],
                    'description' => $data['description'],
                    'idempotency_key' => $data['idempotency_key'],
                    'status' => 'POSTED',
                ])->save();

                $this->audit($actorId, 'expense.posted', $expense, [
                    'amount' => (int) $expense->amount,
                    'category_id' => (int) $expense->expense_category_id,
                ]);

                return $expense;
            }, 3);
        } catch (UniqueConstraintViolationException $exception) {
            // A parallel request may insert the same UUID after our first read.
            // Fetch the committed row and compare it rather than recording twice.
            $existing = Expense::query()->where('idempotency_key', $data['idempotency_key'])->first();

            if ($existing === null) {
                throw $exception;
            }

            return $this->matchingRetry($existing, $data);
        }
    }

    public function void(Expense $expense, string $reason, int $actorId): void
    {
        DB::transaction(function () use ($expense, $reason, $actorId): void {
            $locked = Expense::query()->whereKey($expense->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'POSTED') {
                throw ValidationException::withMessages([
                    'void_reason' => 'Pengeluaran ini sudah pernah di-void.',
                ]);
            }

            $locked->forceFill([
                'status' => 'VOIDED',
                'void_reason' => $reason,
                'voided_at' => now(),
            ])->save();

            $this->audit($actorId, 'expense.voided', $locked, [
                'amount' => (int) $locked->amount,
                'category_id' => (int) $locked->expense_category_id,
                'reason' => $reason,
            ]);
        }, 3);
    }

    private function matchingRetry(Expense $existing, array $data): Expense
    {
        if (
            $existing->status !== 'POSTED'
            || (int) $existing->expense_category_id !== (int) $data['expense_category_id']
            || $existing->expense_date->format('Y-m-d') !== $data['expense_date']
            || (int) $existing->amount !== (int) $data['amount']
            || $existing->description !== $data['description']
        ) {
            throw ValidationException::withMessages([
                'idempotency_key' => 'Identitas transaksi sudah digunakan atau pencatatannya telah di-void. Buka form baru.',
            ]);
        }

        return $existing;
    }

    private function audit(int $actorId, string $action, Expense $expense, array $summary): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $actorId,
            'action' => $action,
            'subject_type' => 'expense',
            'subject_id' => $expense->id,
            'change_summary' => json_encode($summary, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }
}
