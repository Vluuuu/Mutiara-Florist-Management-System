const idIntFormatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
});

function formatInt(value: number): string {
    return idIntFormatter.format(Math.trunc(Number(value) || 0));
}

export type LinearScale = {
    yMin: number;
    yMax: number;
    step: number;
    ticks: number[];
};

export type LinearScaleOptions = {
    integerOnly?: boolean;
    defaultMax?: number;
    targetIntervals?: number;
    maxIntervals?: number;
};

const NICE_MULTIPLIERS = [1, 2, 2.5, 5, 10] as const;

function nextNiceStep(rawStep: number, integerOnly: boolean): number {
    const safeRaw = Math.max(rawStep, integerOnly ? 1 : Number.EPSILON);
    const exponent = Math.floor(Math.log10(safeRaw));
    const mag = Math.pow(10, exponent);

    for (const mult of NICE_MULTIPLIERS) {
        const candidate = mult * mag;
        if (candidate + 1e-12 < safeRaw) {
            continue;
        }
        if (integerOnly && (!Number.isInteger(candidate) || candidate < 1)) {
            continue;
        }
        return integerOnly ? Math.round(candidate) : candidate;
    }

    const fallback = 10 * mag;
    return integerOnly ? Math.max(1, Math.round(fallback)) : fallback;
}

function advanceNiceStep(currentStep: number, integerOnly: boolean): number {
    return nextNiceStep(currentStep * 1.0001, integerOnly);
}

/**
 * Menghitung skala sumbu Y linear dengan interval seragam yang selalu memuat 0.
 *
 * Invarian:
 * - Setiap jarak antar tick bernilai konstan (`step`).
 * - Tick `0` selalu hadir (untuk data positif, negatif, campuran, nol, maupun kosong).
 * - Untuk dataset non-negatif, `yMin === 0`.
 * - Jika `integerOnly = true`, `step` dan seluruh tick adalah bilangan bulat >= 1.
 */
export function computeLinearScale(
    values: readonly number[],
    options: LinearScaleOptions = {},
): LinearScale {
    const integerOnly = options.integerOnly ?? false;
    const targetIntervals = Math.max(2, options.targetIntervals ?? 4);
    const maxIntervals = Math.max(targetIntervals, options.maxIntervals ?? 6);
    const defaultMax = options.defaultMax ?? (integerOnly ? 4 : 100_000);

    let minVal = 0;
    let maxVal = 0;

    for (const raw of values) {
        if (!Number.isFinite(raw)) {
            continue;
        }
        if (raw < minVal) minVal = raw;
        if (raw > maxVal) maxVal = raw;
    }

    if (minVal === 0 && maxVal === 0) {
        const step = integerOnly ? 1 : nextNiceStep(defaultMax / targetIntervals, false);
        const count = integerOnly ? Math.max(1, Math.round(defaultMax)) : targetIntervals;
        const ticks: number[] = [];
        for (let i = 0; i <= count; i += 1) {
            ticks.push(i * step);
        }
        return {
            yMin: 0,
            yMax: count * step,
            step,
            ticks,
        };
    }

    const lo = Math.min(0, minVal);
    const hi = Math.max(0, maxVal);
    const span = hi - lo;

    let step = nextNiceStep(span / targetIntervals, integerOnly);

    // Ensure consistent interval count <= maxIntervals even when zero straddles both signs
    let guard = 0;
    while (guard < 24) {
        const minUnits = lo < 0 ? Math.floor(lo / step) : 0;
        const maxUnits = hi > 0 ? Math.ceil(hi / step) : 0;
        const intervals = maxUnits - minUnits;

        if (intervals <= maxIntervals) {
            // For tiny single-invoice datasets (hi === 1, lo === 0), give 2 crisp integer ticks [0, 1, 2]
            // so the single bar is proportional without crowding the top edge.
            const adjustedMaxUnits =
                integerOnly && lo === 0 && maxUnits === 1 ? 2 : maxUnits;

            const ticks: number[] = [];
            for (let u = minUnits; u <= adjustedMaxUnits; u += 1) {
                const tickVal = u === 0 ? 0 : u * step;
                ticks.push(integerOnly ? Math.round(tickVal) : Math.round(tickVal * 1e6) / 1e6);
            }

            return {
                yMin: ticks[0],
                yMax: ticks[ticks.length - 1],
                step,
                ticks,
            };
        }

        step = advanceNiceStep(step, integerOnly);
        guard += 1;
    }

    const fallbackMin = lo < 0 ? Math.floor(lo / step) * step : 0;
    const fallbackMax = hi > 0 ? Math.ceil(hi / step) * step : 0;
    const ticks: number[] = [];
    const startUnits = Math.round(fallbackMin / step);
    const endUnits = Math.round(fallbackMax / step);
    for (let u = startUnits; u <= endUnits; u += 1) {
        ticks.push(u === 0 ? 0 : u * step);
    }

    return {
        yMin: ticks[0],
        yMax: ticks[ticks.length - 1],
        step,
        ticks,
    };
}

function formatCompactDecimal(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    if (Number.isInteger(rounded)) {
        return formatInt(rounded);
    }
    const fixed = rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    const [intPart, decPart] = fixed.split('.');
    const formattedInt = formatInt(Number(intPart));
    return decPart ? `${formattedInt},${decPart}` : formattedInt;
}

/**
 * Format label ringkas sumbu Y untuk nominal Rupiah (mendukung nilai negatif hingga miliar/triliun).
 */
export function formatAxisRupiah(value: number): string {
    const num = Math.trunc(Number(value) || 0);
    if (num === 0) return 'Rp0';
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);

    if (abs >= 1_000_000_000_000) {
        return `${sign}Rp${formatCompactDecimal(abs / 1_000_000_000_000)} T`;
    }
    if (abs >= 1_000_000_000) {
        return `${sign}Rp${formatCompactDecimal(abs / 1_000_000_000)} M`;
    }
    if (abs >= 1_000_000) {
        return `${sign}Rp${formatCompactDecimal(abs / 1_000_000)} jt`;
    }
    if (abs >= 1_000) {
        return `${sign}Rp${formatCompactDecimal(abs / 1_000)} rb`;
    }
    return `${sign}Rp${formatInt(abs)}`;
}

/**
 * Format label sumbu Y khusus jumlah nota pesanan (bilangan bulat).
 */
export function formatAxisInteger(value: number): string {
    return formatInt(Math.round(Number(value) || 0));
}

/**
 * Menentukan indeks label sumbu X yang ditampilkan agar tidak saling bertumpuk.
 * Selalu mempertahankan label pertama dan terakhir, sambil menekan label kedua terakhir
 * bila terlalu dekat dengan label terakhir.
 */
export function computeXAxisLabelIndices(count: number, maxLabels: number): Set<number> {
    const visible = new Set<number>();
    if (count <= 0) return visible;

    const safeMax = Math.max(2, Math.floor(maxLabels));
    if (count <= safeMax) {
        for (let i = 0; i < count; i += 1) {
            visible.add(i);
        }
        return visible;
    }

    const lastIdx = count - 1;
    const step = Math.ceil(lastIdx / (safeMax - 1));
    const minTailGap = Math.max(1, Math.ceil(step * 0.65));

    visible.add(0);
    for (let i = step; i < lastIdx; i += step) {
        if (lastIdx - i >= minTailGap) {
            visible.add(i);
        }
    }
    visible.add(lastIdx);

    return visible;
}

/**
 * Mendeteksi apakah bucket periode merupakan periode parsial dari ReportService.
 */
export function isPartialPeriodLabel(fullLabel: string): boolean {
    return (
        fullLabel.includes('(parsial)') ||
        /\(\d{2}\/\d{2}\s*-\s*\d{2}\/\d{2}\)/.test(fullLabel)
    );
}
