const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
});

/**
 * Format angka bulat dengan pemisah ribuan Indonesia (tanpa awalan Rp).
 * Dipertahankan agar modul Sprint 2-3 existing tetap kompatibel selama migrasi bertahap.
 */
export function formatAmount(value: number): string {
    const num = Math.trunc(Number(value) || 0);
    return rupiahFormatter.format(num);
}

/**
 * Format nominal Rupiah bulat standar MFMS: Rp1.500.000, Rp0, atau -Rp55.000.
 */
export function formatRupiah(value: number | null | undefined): string {
    const num = Math.trunc(Number(value) || 0);
    if (num < 0) {
        return `-Rp${rupiahFormatter.format(Math.abs(num))}`;
    }
    return `Rp${rupiahFormatter.format(num)}`;
}

/**
 * Ubah input string mata uang menjadi integer bulat Rupiah (null jika kosong).
 */
export function parseRupiahDigits(raw: string): number | null {
    const digits = raw.replace(/\D/g, '');
    if (digits === '') {
        return null;
    }
    const parsed = Number.parseInt(digits, 10);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Format tampilan tanggal menjadi dd/mm/yyyy pada zona waktu Asia/Jakarta (WIB).
 * Menerima tanggal YYYY-MM-DD, dd/mm/yyyy (dikembalikan apa adanya), atau ISO datetime.
 */
export function formatDateWib(value: string | null | undefined): string {
    if (!value) {
        return '-';
    }
    const trimmed = value.trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
        return trimmed;
    }
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
        return `${dateOnlyMatch[3]}/${dateOnlyMatch[2]}/${dateOnlyMatch[1]}`;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        return trimmed;
    }
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(parsed);
}

/**
 * Format tampilan tanggal dan waktu menjadi dd/mm/yyyy HH:mm WIB pada zona Asia/Jakarta.
 */
export function formatDateTimeWib(value: string | null | undefined): string {
    if (!value) {
        return '-';
    }
    const trimmed = value.trim();
    if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}[:.]\d{2}/.test(trimmed)) {
        return trimmed.endsWith('WIB') ? trimmed : `${trimmed} WIB`;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        return trimmed;
    }
    const datePart = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(parsed);
    const timePart = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
        .format(parsed)
        .replace('.', ':');
    return `${datePart} ${timePart} WIB`;
}
