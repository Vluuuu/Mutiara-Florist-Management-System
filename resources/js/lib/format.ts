const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
});

/**
 * Format angka memakai pemisah ribuan Indonesia, konsisten dengan
 * number_format(x, 0, ',', '.') pada dashboard Blade lama.
 */
export function formatAmount(value: number): string {
    return rupiahFormatter.format(value);
}
