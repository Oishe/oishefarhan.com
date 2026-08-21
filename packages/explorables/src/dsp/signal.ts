/**
 * The demo signal from `notebooks/01_signal_is_a_vector.py`: a smooth periodic
 * waveform built from three pure cosines, so its Fourier expansion is exactly
 * sparse and "a handful of terms reproduces it" is literally true, not a
 * approximation the reader has to take on faith.
 */

const TERMS: ReadonlyArray<readonly [amplitude: number, frequency: number]> = [
  [4.0, 1],
  [2.0, 3],
  [1.2, 6],
]

const OFFSET = 0.5

export function buildSignal(n: number): Float64Array {
  const x = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / n
    let acc = OFFSET
    for (const [amplitude, frequency] of TERMS) {
      acc += amplitude * Math.cos(2 * Math.PI * frequency * t)
    }
    x[i] = acc
  }
  return x
}
