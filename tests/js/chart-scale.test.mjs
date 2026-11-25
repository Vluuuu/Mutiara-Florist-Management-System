import assert from 'node:assert/strict';
import test from 'node:test';

import {
    computeLinearScale,
    computeXAxisLabelIndices,
    formatAxisInteger,
    formatAxisRupiah,
    isPartialPeriodLabel,
} from '../../resources/js/lib/chart-scale.ts';

function assertUniformIntervals(scale, label) {
    assert.ok(scale.ticks.length >= 2, `${label}: expected >= 2 ticks`);
    assert.ok(scale.ticks.includes(0), `${label}: zero baseline must be present in ticks`);
    assert.equal(scale.yMin, scale.ticks[0], `${label}: yMin matches first tick`);
    assert.equal(scale.yMax, scale.ticks[scale.ticks.length - 1], `${label}: yMax matches last tick`);
    for (let i = 1; i < scale.ticks.length; i += 1) {
        const diff = Math.round((scale.ticks[i] - scale.ticks[i - 1]) * 1e6) / 1e6;
        assert.equal(diff, scale.step, `${label}: interval ${i} must equal step ${scale.step}`);
    }
}

test('Arus Kas: positive dataset starts at zero with uniform intervals', () => {
    const scale = computeLinearScale([1_295_000, 1_795_000, 3_920_000, 1_210_000]);
    assertUniformIntervals(scale, 'positive cashflow');
    assert.equal(scale.yMin, 0);
    assert.ok(scale.yMax >= 3_920_000);
    assert.deepEqual(scale.ticks, [0, 1_000_000, 2_000_000, 3_000_000, 4_000_000]);
});

test('Selisih Kas: mixed positive and negative dataset uses mathematically consistent intervals across zero', () => {
    const scale = computeLinearScale([-500_000, 1_180_000, 2_290_000, 485_000, 2_710_000]);
    assertUniformIntervals(scale, 'mixed net cash');
    assert.ok(scale.yMin <= -500_000);
    assert.ok(scale.yMax >= 2_710_000);
    assert.deepEqual(scale.ticks, [-1_000_000, 0, 1_000_000, 2_000_000, 3_000_000]);
});

test('Selisih Kas: negative-only dataset anchors zero at top with uniform negative steps', () => {
    const scale = computeLinearScale([-1_850_000, -400_000, -950_000]);
    assertUniformIntervals(scale, 'negative-only net cash');
    assert.equal(scale.yMax, 0);
    assert.ok(scale.yMin <= -1_850_000);
    assert.deepEqual(scale.ticks, [-2_000_000, -1_500_000, -1_000_000, -500_000, 0]);
});

test('Selisih Kas & Arus Kas: all-zero and empty datasets produce valid non-degenerate scale', () => {
    for (const values of [[], [0], [0, 0, 0]]) {
        const currencyScale = computeLinearScale(values);
        assertUniformIntervals(currencyScale, 'zero/empty currency');
        assert.equal(currencyScale.yMin, 0);
        assert.ok(currencyScale.yMax > 0);

        const intScale = computeLinearScale(values, { integerOnly: true, defaultMax: 4 });
        assertUniformIntervals(intScale, 'zero/empty integer');
        assert.deepEqual(intScale.ticks, [0, 1, 2, 3, 4]);
    }
});

test('Pesanan: integer-only Y-axis ticks for small, single-period, and large invoice counts', () => {
    for (const maxVal of [1, 2, 3, 4, 5, 6, 7, 13, 42, 1240]) {
        const scale = computeLinearScale([0, maxVal], { integerOnly: true });
        assertUniformIntervals(scale, `orders max=${maxVal}`);
        assert.equal(scale.yMin, 0);
        assert.ok(scale.yMax >= maxVal);
        assert.ok(Number.isInteger(scale.step) && scale.step >= 1);
        for (const tick of scale.ticks) {
            assert.ok(Number.isInteger(tick), `tick ${tick} must be integer for max=${maxVal}`);
        }
    }

    const singleOrder = computeLinearScale([1], { integerOnly: true });
    assert.deepEqual(singleOrder.ticks, [0, 1, 2]);
});

test('Large values: billions and trillions keep uniform intervals and crisp Indonesian labels', () => {
    const scale = computeLinearScale([-250_000_000, 1_450_000_000]);
    assertUniformIntervals(scale, 'large mixed');
    assert.deepEqual(scale.ticks, [-500_000_000, 0, 500_000_000, 1_000_000_000, 1_500_000_000]);
    assert.equal(formatAxisRupiah(-500_000_000), '-Rp500 jt');
    assert.equal(formatAxisRupiah(0), 'Rp0');
    assert.equal(formatAxisRupiah(1_000_000_000), 'Rp1 M');
    assert.equal(formatAxisRupiah(1_500_000_000), 'Rp1,5 M');
    assert.equal(formatAxisRupiah(2_250_000_000_000), 'Rp2,25 T');
    assert.equal(formatAxisRupiah(250_000), 'Rp250 rb');
    assert.equal(formatAxisInteger(1240), '1.240');
});

test('X-axis label thinning prevents overlap and preserves start/end anchors', () => {
    const dense92 = computeXAxisLabelIndices(92, 10);
    assert.ok(dense92.has(0));
    assert.ok(dense92.has(91));
    assert.ok(dense92.size <= 11);

    // Ensure no two adjacent labels at the tail sit closer than min gap
    const sorted = Array.from(dense92).sort((a, b) => a - b);
    assert.ok(sorted[sorted.length - 1] - sorted[sorted.length - 2] >= 6);

    const single = computeXAxisLabelIndices(1, 5);
    assert.deepEqual(Array.from(single), [0]);
});

test('Partial-period label detection handles weekly, monthly, yearly, and full periods', () => {
    assert.equal(isPartialPeriodLabel('27/10/2026 - 01/11/2026 (parsial)'), true);
    assert.equal(isPartialPeriodLabel('November 2026 (01/11 - 25/11)'), true);
    assert.equal(isPartialPeriodLabel('Tahun 2026 (01/01 - 25/11)'), true);
    assert.equal(isPartialPeriodLabel('02/11/2026 - 08/11/2026'), false);
    assert.equal(isPartialPeriodLabel('Oktober 2026'), false);
});
