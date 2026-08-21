/**
 * Keeping the largest coordinates and asking how few of them carry the signal —
 * `keep_top` and `coeffs_for_energy` from `notebooks/01_signal_is_a_vector.py`.
 */

/** Squared magnitudes sorted high to low, and their running share of the total. */
export interface EnergyCurve {
  energy: Float64Array
  cumulative: Float64Array
}

export function energyCurve(s: Float64Array): EnergyCurve {
  const energy = Float64Array.from(s, (v) => v * v)
  energy.sort()
  energy.reverse()

  const cumulative = new Float64Array(energy.length)
  let total = 0
  for (let i = 0; i < energy.length; i++) {
    total += energy[i]
    cumulative[i] = total
  }
  if (total !== 0) for (let i = 0; i < cumulative.length; i++) cumulative[i] /= total
  return { energy, cumulative }
}

/** First index whose value is >= target, or the length if none is — `np.searchsorted`. */
function searchSorted(sorted: Float64Array, target: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * How many of the largest-magnitude coordinates capture `frac` of the energy.
 * Zero when the signal is zero. Mirrors the Python reference exactly, including
 * its behaviour at `frac > 1` (which returns n + 1) — clamp at the call site.
 */
export function coeffsForEnergy(s: Float64Array, frac = 0.99): number {
  const { cumulative } = energyCurve(s)
  if (cumulative.length === 0) return 0
  let total = 0
  for (let i = 0; i < s.length; i++) total += s[i] * s[i]
  if (total === 0) return 0
  return searchSorted(cumulative, frac) + 1
}

/**
 * Indices ordered by descending magnitude. Ties break toward the *higher* index,
 * matching `np.argsort(np.abs(s))[::-1]` — a stable ascending sort, reversed.
 */
export function orderByMagnitude(s: Float64Array): Int32Array {
  const order = new Int32Array(s.length)
  for (let i = 0; i < s.length; i++) order[i] = i
  const scratch = Array.from(order)
  scratch.sort((a, b) => {
    const d = Math.abs(s[b]) - Math.abs(s[a])
    return d !== 0 ? d : b - a
  })
  order.set(scratch)
  return order
}

/** Zero everything but the r largest-magnitude coordinates. */
export function keepTop(s: Float64Array, r: number): Float64Array {
  const kept = new Float64Array(s.length)
  if (r <= 0) return kept
  const order = orderByMagnitude(s)
  const limit = Math.min(r, s.length)
  for (let i = 0; i < limit; i++) kept[order[i]] = s[order[i]]
  return kept
}
