/**
 * Orthonormal DCT-II and its inverse, DCT-III — `scipy.fft.dct(x, type=2,
 * norm="ortho")` and `idct(X, type=2, norm="ortho")`.
 *
 * Both run in O(n log n) on a length-n complex FFT rather than the O(n²) matrix
 * product `notebooks/01_signal_is_a_vector.py` uses. `dctBasis` builds that
 * matrix anyway, because a widget that *shows* the basis needs its columns; the
 * parity tests assert the two agree.
 */

import { forwardInPlace, inverseInPlace } from "./fft.ts"

/**
 * Reorder x into the even samples ascending followed by the odd samples
 * descending. The DCT-II of x is then a phase twist on the DFT of this.
 */
function shuffle(x: Float64Array): Float64Array {
  const n = x.length
  const v = new Float64Array(n)
  for (let i = 0; i < n; i++) v[i] = 2 * i < n ? x[2 * i] : x[2 * n - 1 - 2 * i]
  return v
}

/** DCT-II, orthonormal. */
export function dct(x: Float64Array): Float64Array {
  const n = x.length
  const out = new Float64Array(n)
  if (n === 0) return out

  const re = shuffle(x)
  const im = new Float64Array(n)
  forwardInPlace(re, im)

  // C[k] = Re(e^{-i·pi·k/2n} · V[k]) is the unnormalized DCT-II; the ortho
  // scaling is sqrt(1/n) at DC and sqrt(2/n) elsewhere.
  const dc = Math.sqrt(1 / n)
  const ac = Math.sqrt(2 / n)
  for (let k = 0; k < n; k++) {
    const angle = (Math.PI * k) / (2 * n)
    const c = Math.cos(angle) * re[k] + Math.sin(angle) * im[k]
    out[k] = k === 0 ? c * dc : c * ac
  }
  return out
}

/** DCT-III, orthonormal — the exact inverse of `dct`. */
export function idct(coeffs: Float64Array): Float64Array {
  const n = coeffs.length
  const out = new Float64Array(n)
  if (n === 0) return out

  // Undo the ortho scaling to recover the raw DCT-II values C[k], then run the
  // forward pipeline backwards. Realness of x forces V[n-k] = conj(V[k]), which
  // is what supplies the imaginary part C never carried: Im(S[k]) = -C[n-k].
  const dc = Math.sqrt(n)
  const ac = Math.sqrt(n / 2)
  const c = new Float64Array(n)
  for (let k = 0; k < n; k++) c[k] = k === 0 ? coeffs[0] * dc : coeffs[k] * ac

  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    const angle = (Math.PI * k) / (2 * n)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const mirror = k === 0 ? 0 : c[n - k]
    re[k] = c[k] * cos + mirror * sin
    im[k] = c[k] * sin - mirror * cos
  }
  inverseInPlace(re, im)

  for (let i = 0; i < n; i++) {
    if (2 * i < n) out[2 * i] = re[i]
    else out[2 * n - 1 - 2 * i] = re[i]
  }
  return out
}

/**
 * The orthonormal DCT-II synthesis matrix, row-major: element (i, k) lives at
 * `i * n + k`, so column k is basis vector k sampled at i. `x = Psi · s` and
 * `s = Psiᵀ · x`, exactly — the change-of-basis picture notebook 01 draws.
 */
export function dctBasis(n: number): Float64Array {
  const psi = new Float64Array(n * n)
  const dc = Math.sqrt(1 / n)
  const ac = Math.sqrt(2 / n)
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const scale = k === 0 ? dc : ac
      psi[i * n + k] = scale * Math.cos((Math.PI * (2 * i + 1) * k) / (2 * n))
    }
  }
  return psi
}
