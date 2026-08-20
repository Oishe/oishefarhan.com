import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const DSP = fileURLToPath(new URL("../src/dsp", import.meta.url))

/** Names that only exist in a browser. Importing one into `dsp/` breaks Vitest. */
const DOM_GLOBALS = [
  "document",
  "window",
  "navigator",
  "HTMLElement",
  "CanvasRenderingContext2D",
  "ImageData",
  "requestAnimationFrame",
]

function tsFiles(dir: string): string[] {
  let out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out = out.concat(tsFiles(full))
    else if (name.endsWith(".ts")) out.push(full)
  }
  return out
}

describe("src/dsp stays pure numerics", () => {
  const files = tsFiles(DSP)

  test("directory is discoverable", () => {
    expect(Array.isArray(files)).toBe(true)
  })

  for (const file of files) {
    const source = readFileSync(file, "utf-8")

    test(`${file.slice(DSP.length + 1)} imports no DOM APIs`, () => {
      for (const name of DOM_GLOBALS) {
        expect(source).not.toMatch(new RegExp(`\\b${name}\\b`))
      }
    })

    test(`${file.slice(DSP.length + 1)} uses Float64Array, not number[]`, () => {
      expect(source).not.toMatch(/:\s*number\[\]/)
    })
  }
})
