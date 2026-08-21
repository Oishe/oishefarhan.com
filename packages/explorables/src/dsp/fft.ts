/**
 * Complex FFT: radix-2 Cooley–Tukey for power-of-two lengths, Bluestein's
 * chirp-z algorithm for everything else. Arbitrary lengths matter because a
 * reader-chosen signal length is not obligingly a power of two.
 *
 * Names mirror `scipy.fft` so the parity fixtures read one-to-one, as does the
 * normalization: `"backward"` leaves the forward transform unscaled and divides
 * the inverse by n; `"ortho"` splits `1/sqrt(n)` between them.
 */

export interface Complex {
  re: Float64Array
  im: Float64Array
}

export type Norm = "backward" | "ortho"

/** Twiddles are shared across every transform of a given length. */
const TWIDDLES = new Map<number, { cos: Float64Array; sin: Float64Array }>()

function twiddles(n: number): { cos: Float64Array; sin: Float64Array } {
  let t = TWIDDLES.get(n)
  if (t === undefined) {
    const half = n >> 1
    const cos = new Float64Array(half)
    const sin = new Float64Array(half)
    for (let k = 0; k < half; k++) {
      const angle = (2 * Math.PI * k) / n
      cos[k] = Math.cos(angle)
      sin[k] = Math.sin(angle)
    }
    t = { cos, sin }
    TWIDDLES.set(n, t)
  }
  return t
}

const isPowerOfTwo = (n: number): boolean => n > 0 && (n & (n - 1)) === 0

/** In-place forward DFT, n a power of two. */
function radix2(re: Float64Array, im: Float64Array): void {
  const n = re.length
  if (n < 2) return

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; (j & bit) !== 0; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let swap = re[i]
      re[i] = re[j]
      re[j] = swap
      swap = im[i]
      im[i] = im[j]
      im[j] = swap
    }
  }

  const { cos, sin } = twiddles(n)
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const step = n / len
    for (let base = 0; base < n; base += len) {
      for (let k = 0; k < half; k++) {
        const t = k * step
        const wr = cos[t]
        const wi = -sin[t]
        const a = base + k
        const b = a + half
        const xr = re[b] * wr - im[b] * wi
        const xi = re[b] * wi + im[b] * wr
        re[b] = re[a] - xr
        im[b] = im[a] - xi
        re[a] += xr
        im[a] += xi
      }
    }
  }
}

/** In-place inverse DFT with the 1/n scale, n a power of two. */
function inverseRadix2(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let k = 0; k < n; k++) im[k] = -im[k]
  radix2(re, im)
  const s = 1 / n
  for (let k = 0; k < n; k++) {
    re[k] *= s
    im[k] = -im[k] * s
  }
}

/**
 * In-place forward DFT for any n, via the chirp-z identity
 * `nk = (n² + k² - (n-k)²) / 2`, which turns the DFT into a convolution that a
 * power-of-two FFT can do.
 */
function bluestein(re: Float64Array, im: Float64Array): void {
  const n = re.length
  let m = 1
  while (m < 2 * n - 1) m <<= 1

  // Chirp e^{-i·pi·k²/n}. Reducing k² mod 2n first keeps the angle exact for
  // large k, where pi·k²/n would otherwise lose most of its mantissa.
  const cc = new Float64Array(n)
  const cs = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    const angle = (Math.PI * ((k * k) % (2 * n))) / n
    cc[k] = Math.cos(angle)
    cs[k] = Math.sin(angle)
  }

  const ar = new Float64Array(m)
  const ai = new Float64Array(m)
  for (let k = 0; k < n; k++) {
    ar[k] = re[k] * cc[k] + im[k] * cs[k]
    ai[k] = im[k] * cc[k] - re[k] * cs[k]
  }

  const br = new Float64Array(m)
  const bi = new Float64Array(m)
  br[0] = cc[0]
  bi[0] = cs[0]
  for (let k = 1; k < n; k++) {
    br[k] = br[m - k] = cc[k]
    bi[k] = bi[m - k] = cs[k]
  }

  radix2(ar, ai)
  radix2(br, bi)
  for (let k = 0; k < m; k++) {
    const r = ar[k] * br[k] - ai[k] * bi[k]
    ai[k] = ar[k] * bi[k] + ai[k] * br[k]
    ar[k] = r
  }
  inverseRadix2(ar, ai)

  for (let k = 0; k < n; k++) {
    re[k] = ar[k] * cc[k] + ai[k] * cs[k]
    im[k] = ai[k] * cc[k] - ar[k] * cs[k]
  }
}

/** In-place forward DFT, any length. The one entry point the rest of dsp/ uses. */
export function forwardInPlace(re: Float64Array, im: Float64Array): void {
  if (re.length < 2) return
  if (isPowerOfTwo(re.length)) radix2(re, im)
  else bluestein(re, im)
}

/** In-place inverse DFT with the 1/n scale, any length. */
export function inverseInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length
  if (n === 0) return
  for (let k = 0; k < n; k++) im[k] = -im[k]
  forwardInPlace(re, im)
  const s = 1 / n
  for (let k = 0; k < n; k++) {
    re[k] *= s
    im[k] = -im[k] * s
  }
}

function scale(c: Complex, s: number): Complex {
  if (s !== 1) {
    for (let k = 0; k < c.re.length; k++) {
      c.re[k] *= s
      c.im[k] *= s
    }
  }
  return c
}

function asComplex(input: Float64Array | Complex): Complex {
  return input instanceof Float64Array
    ? { re: Float64Array.from(input), im: new Float64Array(input.length) }
    : { re: Float64Array.from(input.re), im: Float64Array.from(input.im) }
}

/** Forward DFT. Real input is promoted to complex, as in numpy. */
export function fft(input: Float64Array | Complex, norm: Norm = "backward"): Complex {
  const c = asComplex(input)
  forwardInPlace(c.re, c.im)
  return scale(c, norm === "ortho" ? 1 / Math.sqrt(c.re.length) : 1)
}

/** Inverse DFT. */
export function ifft(input: Float64Array | Complex, norm: Norm = "backward"): Complex {
  const c = asComplex(input)
  const n = c.re.length
  inverseInPlace(c.re, c.im)
  return scale(c, norm === "ortho" ? Math.sqrt(n) : 1)
}
