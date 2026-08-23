import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { QuartoArtifacts } from "./quartoArtifacts"
import type { BuildCtx } from "../quartz/util/ctx"

function tempTree(files: Record<string, string>): { source: string; output: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quarto-artifacts-"))
  const source = path.join(root, "quarto")
  const output = path.join(root, "public")
  fs.mkdirSync(source, { recursive: true })
  for (const [relativePath, contents] of Object.entries(files)) {
    const destination = path.join(source, relativePath)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, contents)
  }
  fs.mkdirSync(output, { recursive: true })
  return { source, output }
}

function ctxFor(output: string): BuildCtx {
  return { argv: { output } } as unknown as BuildCtx
}

async function emit(sourceDirectory: string, output: string, includeHtml?: boolean) {
  const emitter = QuartoArtifacts({ sourceDirectory, includeHtml })
  const emitted: string[] = []
  const files = await emitter.emit!(ctxFor(output), [], { css: [], js: [], additionalHead: [] })
  for await (const file of files) {
    emitted.push(path.relative(output, file))
  }
  return emitted.sort()
}

test("copies dependency artifacts to their canonical relative paths", async () => {
  const { source, output } = tempTree({
    "research/monte-carlo.html": "<html></html>",
    "research/monte-carlo_files/libs/plotly/plotly.min.js": "// plotly",
    "research/figure-html/plot-1.png": "png",
  })

  const emitted = await emit(source, output, false)

  assert.deepEqual(emitted, [
    path.join("research", "figure-html", "plot-1.png"),
    path.join("research", "monte-carlo_files", "libs", "plotly", "plotly.min.js"),
  ])
  assert.equal(
    fs.readFileSync(
      path.join(output, "research/monte-carlo_files/libs/plotly/plotly.min.js"),
      "utf8",
    ),
    "// plotly",
  )
})

test("excludes rendered HTML by default only when asked", async () => {
  const files = { "research/monte-carlo.html": "<html></html>" }

  const withoutHtml = tempTree(files)
  assert.deepEqual(await emit(withoutHtml.source, withoutHtml.output, false), [])

  const withHtml = tempTree(files)
  assert.deepEqual(await emit(withHtml.source, withHtml.output), [
    path.join("research", "monte-carlo.html"),
  ])
})

test("refuses to follow symlinks out of the artifact tree", async () => {
  const { source, output } = tempTree({ "research/monte-carlo_files/keep.js": "// keep" })
  fs.symlinkSync("/etc/passwd", path.join(source, "escape.js"))

  await assert.rejects(() => emit(source, output), /must not contain symlinks/)
})

test("fails loudly when the artifact directory is missing", async () => {
  const { source, output } = tempTree({})
  fs.rmSync(source, { recursive: true })

  await assert.rejects(() => emit(source, output), /artifact directory does not exist/)
})
