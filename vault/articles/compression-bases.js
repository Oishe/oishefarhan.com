// Orthonormal bases for the compression playground, as dense matrices.
//
// BASES[name](n) returns B, an n x n Float32Array in row-major order whose rows
// are the basis vectors: c = B x analyses a line of n pixels and x = Bᵀ c
// rebuilds it. An image is transformed along both axes, C = B_h X B_wᵀ, which
// is what the playground's GPU kernels compute.
//
// Imported by compression-playground.qmd and tested by
// scripts/compression-bases.test.ts.

// Daubechies scaling filter with 4 vanishing moments (8 taps): pywt's "db4".
const DB4 = [
  0.23037781330885523, 0.7148465705525415, 0.6308807679295904, -0.02798376941698385,
  -0.18703481171888114, 0.030841381835986965, 0.032883011666982945, -0.010597401784997278,
]

// Wavelet levels. Sides are trimmed to a multiple of 2^6 so every level halves
// evenly.
export const LEVELS = 6

function fill(n, f) {
  const B = new Float32Array(n * n)
  for (let r = 0; r < n; r++) for (let i = 0; i < n; i++) B[r * n + i] = f(r, i)
  return B
}

// Multilevel periodized wavelet analysis of one line with scaling filter h.
// Each level splits the approximation band into half-length approximation and
// detail bands, wrapping at the ends so the transform stays square and
// orthonormal.
function analyse(x, h) {
  const L = h.length
  const g = h.map((_, j) => (j % 2 ? -1 : 1) * h[L - 1 - j])
  const out = Float64Array.from(x)
  const tmp = new Float64Array(x.length)
  for (let m = x.length, level = 0; level < LEVELS; level++, m >>= 1) {
    const half = m >> 1
    for (let k = 0; k < half; k++) {
      let a = 0, d = 0
      for (let j = 0; j < L; j++) {
        const v = out[(2 * k + j) % m]
        a += h[j] * v
        d += g[j] * v
      }
      tmp[k] = a
      tmp[half + k] = d
    }
    out.set(tmp.subarray(0, m))
  }
  return out
}

// A linear transform's matrix is what it does to each unit vector: column i of
// B is the transform of e_i.
function wavelet(h) {
  return (n) => {
    const B = new Float32Array(n * n)
    const e = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      e[i] = 1
      analyse(e, h).forEach((v, r) => { B[r * n + i] = v })
      e[i] = 0
    }
    return B
  }
}

// In the order the playground's menu lists them.
export const BASES = {
  // The real Fourier basis: DC, then a cosine and a sine per frequency, then
  // the alternating Nyquist row. The same space as the complex DFT, but real
  // and counted one number per coefficient like every other basis here.
  Fourier: (n) => fill(n, (r, i) => {
    if (r === 0) return 1 / Math.sqrt(n)
    if (r === n - 1) return (i % 2 ? -1 : 1) / Math.sqrt(n)
    const f = Math.ceil(r / 2)
    const t = (2 * Math.PI * f * i) / n
    return Math.sqrt(2 / n) * (r % 2 ? Math.cos(t) : Math.sin(t))
  }),
  DCT: (n) => fill(n, (k, i) => (k ? Math.SQRT2 : 1) * Math.cos((Math.PI * (2 * i + 1) * k) / (2 * n)) / Math.sqrt(n)),
  "Wavelet: Haar": wavelet([Math.SQRT1_2, Math.SQRT1_2]),
  "Wavelet: Daubechies 4": wavelet(DB4),
}

export function transpose(B, n) {
  const T = new Float32Array(n * n)
  for (let r = 0; r < n; r++) for (let i = 0; i < n; i++) T[i * n + r] = B[r * n + i]
  return T
}
