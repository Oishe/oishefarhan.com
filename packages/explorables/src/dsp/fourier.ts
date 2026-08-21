/**
 * The real orthonormal Fourier basis from `notebooks/01_signal_is_a_vector.py`:
 * DC, then cosine/sine pairs at rising frequency, closing on the Nyquist wave.
 *
 * This is the basis the notebook *draws*. It is a rotation of the complex DFT,
 * not a substitute for it — `fft.ts` remains the fast path.
 */

/** Columns of the basis, row-major (`psi[i * n + k]`), plus a name per column. */
export interface Basis {
  psi: Float64Array
  labels: string[]
}

/**
 * Orthonormal for even n only: the pairing argument needs a self-conjugate
 * Nyquist bin, so an odd length would leave the column count short.
 */
export function fourierBasis(n: number): Basis {
  if (n <= 0 || n % 2 !== 0) {
    throw new RangeError(`fourierBasis needs a positive even length, got ${n}`)
  }

  const psi = new Float64Array(n * n)
  const labels: string[] = ["DC"]
  const dc = Math.sqrt(1 / n)
  const ac = Math.sqrt(2 / n)

  for (let i = 0; i < n; i++) psi[i * n] = dc

  let col = 1
  for (let k = 1; k < n / 2; k++) {
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * k * i) / n
      psi[i * n + col] = ac * Math.cos(angle)
      psi[i * n + col + 1] = ac * Math.sin(angle)
    }
    labels.push(`cos ${k}`, `sin ${k}`)
    col += 2
  }

  for (let i = 0; i < n; i++) psi[i * n + col] = Math.cos(Math.PI * i) * dc
  labels.push("Nyquist")

  return { psi, labels }
}

/** `s = Psiᵀ · x` — the coordinates of x in a basis whose columns are Psi. */
export function analyze(psi: Float64Array, x: Float64Array): Float64Array {
  const n = x.length
  const s = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    let acc = 0
    for (let i = 0; i < n; i++) acc += psi[i * n + k] * x[i]
    s[k] = acc
  }
  return s
}

/** `x = Psi · s` — rebuild the signal from its coordinates. */
export function synthesize(psi: Float64Array, s: Float64Array): Float64Array {
  const n = s.length
  const x = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let acc = 0
    for (let k = 0; k < n; k++) acc += psi[i * n + k] * s[k]
    x[i] = acc
  }
  return x
}
