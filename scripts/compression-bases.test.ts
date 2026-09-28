import assert from "node:assert/strict"
import test from "node:test"
import { BASES, transpose } from "../vault/articles/compression-bases.js"

// Every basis must be orthonormal, B Bᵀ = I, or the playground's inverse is not
// an inverse and its PSNR (which assumes Parseval) is wrong. 128 is the
// smallest side where six wavelet levels still leave a 2-sample band.
for (const [name, make] of Object.entries(BASES)) {
  test(`${name} is orthonormal`, () => {
    const n = 128
    const B = make(n)
    const Bt = transpose(B, n)
    let worst = 0
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let s = 0
        for (let k = 0; k < n; k++) s += B[r * n + k] * Bt[k * n + c]
        worst = Math.max(worst, Math.abs(s - (r === c ? 1 : 0)))
      }
    }
    assert.ok(worst < 1e-5, `worst deviation from identity ${worst}`)
  })
}
