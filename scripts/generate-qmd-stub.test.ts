import assert from "node:assert/strict"
import test from "node:test"
import { generateQmdStub, stripExecutableCells } from "./generate-qmd-stub.ts"

test("copies frontmatter and adds stub metadata", () => {
  const source = `---
title: Example
publish: true
---

# Example
`
  const stub = generateQmdStub(source, "vault/example.qmd")

  assert.match(stub, /title: Example/)
  assert.match(stub, /quartoStub: true/)
  assert.match(stub, /sourcePath: "vault\/example.qmd"/)
  assert.match(stub, /# Example/)
})

test("removes executable cells but keeps prose, wikilinks, and ordinary code", () => {
  const source = `Before [[Target]].

\`\`\`{python}
value = 42
\`\`\`

\`\`\`text
ordinary code
\`\`\`

## After
`
  const stub = stripExecutableCells(source)

  assert.match(stub, /Before \[\[Target\]\]\./)
  assert.doesNotMatch(stub, /value = 42/)
  assert.match(stub, /ordinary code/)
  assert.match(stub, /## After/)
})

test("rejects an unclosed executable cell", () => {
  assert.throws(() => stripExecutableCells("```{python}\nvalue = 42\n"), /unclosed/)
})
