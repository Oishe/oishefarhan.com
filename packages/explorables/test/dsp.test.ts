import { describe, expect, test } from "vitest"

import raw from "./fixtures/dsp.json"
import { dct, dctBasis, idct } from "../src/dsp/dct.ts"
import { fft, ifft } from "../src/dsp/fft.ts"
import { analyze, fourierBasis, synthesize } from "../src/dsp/fourier.ts"
import { buildSignal } from "../src/dsp/signal.ts"
import { coeffsForEnergy, energyCurve, keepTop } from "../src/dsp/sparsity.ts"

interface Fixture {
  input: number[]
  expect?: number[] | number[]
  re?: number[]
  im?: number[]
  energy?: number[]
  cumulative?: number[]
  fracs?: number[]
  r?: number
}

const fixtures = raw as unknown as Record<string, Fixture>

const SIZES = [16, 24, 64, 100, 256]
const BASIS_SIZES = [8, 16, 24]

/** Orthonormal transforms hold 1e-10; §5 says loosen only with a reason. */
const TOL = 1e-10

function get(name: string): Fixture {
  const f = fixtures[name]
  if (f === undefined) throw new Error(`missing fixture ${name} — run \`just fixtures\``)
  return f
}

const req = (f: Fixture, key: keyof Fixture): number[] => {
  const v = f[key]
  if (!Array.isArray(v)) throw new Error(`fixture field ${String(key)} is not an array`)
  return v
}

/**
 * Assert once on the worst element, so a failure names the index that broke.
 * `tol = 0` means bit-exact, which is the right bar for pure selection.
 */
function closeTo(got: ArrayLike<number>, want: ArrayLike<number>, tol = TOL): void {
  expect(got.length).toBe(want.length)
  let worst = 0
  let at = -1
  for (let i = 0; i < want.length; i++) {
    const d = Math.abs(got[i] - want[i])
    if (d > worst) {
      worst = d
      at = i
    }
  }
  expect(worst, `worst |Δ| = ${worst.toExponential(3)} at index ${at}`).toBeLessThanOrEqual(tol)
}

describe("fft matches scipy.fft.fft", () => {
  for (const n of SIZES) {
    test(`n=${n}${(n & (n - 1)) === 0 ? "" : " (Bluestein)"}`, () => {
      const f = get(`fft_${n}`)
      const got = fft(Float64Array.from(f.input))
      closeTo(got.re, req(f, "re"))
      closeTo(got.im, req(f, "im"))
    })
  }

  test("ortho normalization is backward divided by sqrt(n)", () => {
    const f = get("fft_64")
    const x = Float64Array.from(f.input)
    const backward = fft(x)
    const ortho = fft(x, "ortho")
    const s = 1 / Math.sqrt(64)
    closeTo(ortho.re, Array.from(backward.re, (v) => v * s))
    closeTo(ortho.im, Array.from(backward.im, (v) => v * s))
  })
})

describe("ifft undoes fft", () => {
  for (const n of SIZES) {
    test(`n=${n}`, () => {
      const x = Float64Array.from(get(`fft_${n}`).input)
      const back = ifft(fft(x))
      closeTo(back.re, x)
      closeTo(back.im, new Float64Array(n))
    })
  }
})

describe("dct matches scipy.fft.dct(type=2, norm='ortho')", () => {
  for (const n of SIZES) {
    test(`n=${n}`, () => {
      const f = get(`dct_${n}`)
      closeTo(dct(Float64Array.from(f.input)), req(f, "expect"))
    })
  }
})

describe("idct matches scipy.fft.idct(type=2, norm='ortho')", () => {
  for (const n of SIZES) {
    test(`n=${n}`, () => {
      const f = get(`idct_${n}`)
      closeTo(idct(Float64Array.from(f.input)), req(f, "expect"))
    })
  }
})

describe("dct round-trips", () => {
  for (const n of SIZES) {
    test(`idct(dct(x)) === x at n=${n}`, () => {
      const x = Float64Array.from(get(`dct_${n}`).input)
      closeTo(idct(dct(x)), x)
    })
  }
})

describe("dctBasis is the matrix form of dct", () => {
  for (const n of BASIS_SIZES) {
    test(`matches the notebook's Psi at n=${n}`, () => {
      closeTo(dctBasis(n), req(get(`dct_basis_${n}`), "expect"))
    })
  }

  for (const n of [16, 64]) {
    test(`Psi^T x agrees with the fast dct at n=${n}`, () => {
      const x = Float64Array.from(get(`dct_${n}`).input)
      closeTo(analyze(dctBasis(n), x), dct(x))
    })

    test(`Psi s reconstructs x at n=${n}`, () => {
      const psi = dctBasis(n)
      const x = Float64Array.from(get(`dct_${n}`).input)
      closeTo(synthesize(psi, analyze(psi, x)), x)
    })
  }
})

describe("fourierBasis", () => {
  for (const n of BASIS_SIZES) {
    test(`matches the notebook at n=${n}`, () => {
      closeTo(fourierBasis(n).psi, req(get(`fourier_basis_${n}`), "expect"))
    })

    test(`columns are orthonormal at n=${n}`, () => {
      const { psi, labels } = fourierBasis(n)
      expect(labels.length).toBe(n)
      const gram = new Float64Array(n * n)
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
          let acc = 0
          for (let i = 0; i < n; i++) acc += psi[i * n + a] * psi[i * n + b]
          gram[a * n + b] = acc
        }
      }
      const identity = new Float64Array(n * n)
      for (let a = 0; a < n; a++) identity[a * n + a] = 1
      closeTo(gram, identity)
    })
  }

  test("rejects odd lengths, which are not orthonormal", () => {
    expect(() => fourierBasis(15)).toThrow(RangeError)
  })
})

describe("buildSignal matches the notebook", () => {
  for (const n of [16, 64]) {
    test(`n=${n}`, () => {
      closeTo(buildSignal(n), req(get(`build_signal_${n}`), "expect"))
    })
  }
})

describe("sparsity helpers match the notebook", () => {
  for (const n of [16, 64]) {
    test(`energyCurve at n=${n}`, () => {
      const f = get(`energy_curve_${n}`)
      const got = energyCurve(Float64Array.from(f.input))
      closeTo(got.energy, req(f, "energy"))
      closeTo(got.cumulative, req(f, "cumulative"))
    })

    test(`coeffsForEnergy at n=${n}`, () => {
      const f = get(`coeffs_for_energy_${n}`)
      const s = Float64Array.from(f.input)
      const fracs = req(f, "fracs")
      const want = req(f, "expect")
      expect(fracs.map((frac) => coeffsForEnergy(s, frac))).toEqual(want)
    })

    for (const r of [0, 1, 4, n / 2, n]) {
      test(`keepTop(s, ${r}) at n=${n}`, () => {
        const f = get(`keep_top_${n}_${r}`)
        closeTo(keepTop(Float64Array.from(f.input), r), req(f, "expect"), 0)
      })
    }
  }

  test("energyCurve of an all-zero signal does not divide by zero", () => {
    const { cumulative } = energyCurve(new Float64Array(8))
    expect(Array.from(cumulative)).toEqual(new Array(8).fill(0))
    expect(coeffsForEnergy(new Float64Array(8))).toBe(0)
  })
})
