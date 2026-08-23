import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import {
  ValidationFailure,
  extractReferences,
  preparePublication,
  stripCode,
} from "./prepare-publication.ts"

type Files = Record<string, string>

async function withVault(files: Files): Promise<{
  run: (overrides?: Record<string, unknown>) => Promise<Awaited<ReturnType<typeof preparePublication>>>
  vaultDir: string
  contentDir: string
  linkMapPath: string
  write: (files: Files) => Promise<void>
}> {
  const root = await mkdtemp(path.join(tmpdir(), "publication-prep-"))
  const vaultDir = path.join(root, "vault")
  const contentDir = path.join(root, "generated/quartz-content")
  const linkMapPath = path.join(root, "generated/link-map.json")

  const write = async (contents: Files): Promise<void> => {
    for (const [relative, body] of Object.entries(contents)) {
      const target = path.join(vaultDir, relative)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, body, "utf8")
    }
  }

  await write(files)
  return {
    vaultDir,
    contentDir,
    linkMapPath,
    write,
    run: (overrides = {}) =>
      preparePublication({
        vaultDir,
        contentDir,
        linkMapPath,
        quartoDir: path.join(root, "generated/quarto"),
        bibliographySource: path.join(vaultDir, "references.bib"),
        bibliographyTarget: path.join(contentDir, "bibliography.bib"),
        ...overrides,
      }),
  }
}

function note(title: string, extra: string, body: string): string {
  return `---\ntitle: ${title}\n${extra}---\n\n${body}\n`
}

async function messagesFrom(run: () => Promise<unknown>): Promise<string[]> {
  try {
    await run()
  } catch (error) {
    assert.ok(error instanceof ValidationFailure)
    return error.problems.map((problem) => problem.message)
  }
  assert.fail("expected publication prep to fail")
}

test("stages published Markdown, stubs published Quarto, and skips the rest", async () => {
  const vault = await withVault({
    "notes/public.md": note("Public", "publish: true\n", "Links to [[Research Note]]."),
    "notes/private.md": note("Private", "publish: false\n", "Secret."),
    "notes/implicit.md": note("Implicit", "", "No publish key at all."),
    "research/study.qmd": note(
      "Research Note",
      "publish: true\n",
      "Prose stays.\n\n```{python}\nsecret = 1\n```",
    ),
  })

  const result = await vault.run()

  assert.deepEqual(
    result.published.map((document) => document.slug).sort(),
    ["notes/public", "research/study"],
  )
  const stub = await readFile(path.join(vault.contentDir, "research/study.md"), "utf8")
  assert.match(stub, /quartoStub: true/)
  assert.match(stub, /sourceType: quarto/)
  assert.doesNotMatch(stub, /secret = 1/)
  assert.deepEqual((await readdir(path.join(vault.contentDir, "notes"))).sort(), ["public.md"])
})

test("copies only attachments that published content references", async () => {
  const vault = await withVault({
    "index.md": note("Index", "publish: true\n", "![[diagram.svg]] and [pdf](attachments/paper.pdf)"),
    "draft.md": note("Draft", "publish: false\n", "![[unused.svg]]"),
    "attachments/diagram.svg": "<svg/>",
    "attachments/paper.pdf": "%PDF",
    "attachments/unused.svg": "<svg/>",
  })

  const result = await vault.run()

  assert.deepEqual(result.attachments, ["attachments/diagram.svg", "attachments/paper.pdf"])
  assert.deepEqual(
    (await readdir(path.join(vault.contentDir, "attachments"))).sort(),
    ["diagram.svg", "paper.pdf"],
  )
})

test("rebuilds the staged tree instead of patching it", async () => {
  const vault = await withVault({ "keep.md": note("Keep", "publish: true\n", "Body.") })
  await vault.run()
  await writeFile(path.join(vault.contentDir, "stale.md"), "leftover", "utf8")

  await vault.run()

  assert.deepEqual(await readdir(vault.contentDir), ["keep.md"])
})

test("fails when published content links to an unpublished note", async () => {
  const vault = await withVault({
    "index.md": note("Index", "publish: true\n", "See [[Hidden]]."),
    "hidden.md": note("Hidden", "publish: false\n", "Not public."),
  })

  const messages = await messagesFrom(vault.run)

  assert.deepEqual(messages, [`[[Hidden]] points at unpublished ${vault.vaultDir}/hidden.md`])
})

test("fails on links and embeds that resolve to nothing", async () => {
  const vault = await withVault({
    "index.md": note("Index", "publish: true\n", "[[Nowhere]] and ![[missing.png]]"),
  })

  const messages = await messagesFrom(vault.run)

  assert.equal(messages.length, 2)
  assert.match(messages[0], /\[\[Nowhere\]\]/)
  assert.match(messages[1], /no such attachment/)
})

test("fails on unusable frontmatter", async () => {
  const vault = await withVault({
    "no-frontmatter.md": "# Body only\n",
    "no-title.md": "---\npublish: true\n---\n\nBody\n",
    "bad-publish.md": note("Bad Publish", "publish: yes please\n", "Body"),
    "bad-aliases.md": note("Bad Aliases", "aliases: { a: b }\n", "Body"),
  })

  const messages = await messagesFrom(vault.run)

  assert.deepEqual(messages.sort(), [
    "`aliases` must be a list of strings",
    "`publish` must be true or false",
    "frontmatter needs a non-empty `title`",
    "missing or unparsable YAML frontmatter",
  ])
})

test("fails when a published path cannot become a predictable slug", async () => {
  const vault = await withVault({
    "notes/Monte Carlo.md": note("Monte Carlo", "publish: true\n", "Body"),
  })

  const messages = await messagesFrom(vault.run)

  assert.match(messages[0], /not slug-safe/)
})

test("fails when two published notes claim the same title or alias", async () => {
  const vault = await withVault({
    "a.md": note("Shared", "publish: true\n", "Body"),
    "b.md": note("Other", "publish: true\naliases:\n  - Shared\n", "Body"),
  })

  const messages = await messagesFrom(vault.run)

  assert.deepEqual(messages, [`alias "Shared" is already claimed by ${vault.vaultDir}/a.md`])
})

test("fails when a .md and a .qmd would occupy the same URL", async () => {
  const vault = await withVault({
    "research/study.md": note("Study Notes", "publish: true\n", "Body"),
    "research/study.qmd": note("Study", "publish: true\n", "Body"),
  })

  const messages = await messagesFrom(vault.run)

  assert.deepEqual(messages, [
    `slug "research/study" collides with ${vault.vaultDir}/research/study.md`,
  ])
})

test("maps titles, aliases, slugs, and source paths to canonical URLs", async () => {
  const vault = await withVault({
    "research/study.qmd": note("Research Note", "publish: true\naliases:\n  - RN\n", "Body"),
  })

  await vault.run()
  const linkMap = JSON.parse(await readFile(vault.linkMapPath, "utf8"))

  assert.equal(linkMap.byKey["Research Note"], "/research/study")
  assert.equal(linkMap.byKey["RN"], "/research/study")
  assert.equal(linkMap.byKey["research/study"], "/research/study")
  assert.equal(linkMap.byKey["research/study.qmd"], "/research/study")
  assert.deepEqual(linkMap.documents[0].sourceType, "quarto")
})

test("rejects Quarto artifacts that no published document explains", async () => {
  const vault = await withVault({ "research/study.qmd": note("Study", "publish: true\n", "Body") })
  const options = { quartoDir: path.join(vault.contentDir, "../quarto") }
  await mkdir(path.join(options.quartoDir, "research"), { recursive: true })
  await writeFile(path.join(options.quartoDir, "research/study.html"), "<html/>", "utf8")
  await writeFile(path.join(options.quartoDir, "research/private.html"), "<html/>", "utf8")

  const messages = await messagesFrom(() => vault.run(options))

  assert.deepEqual(messages, [
    "rendered artifact has no matching published .qmd; delete it and re-render",
  ])
})

test("requires a rendered artifact for every published .qmd under --require-quarto", async () => {
  const vault = await withVault({ "research/study.qmd": note("Study", "publish: true\n", "Body") })

  const messages = await messagesFrom(() => vault.run({ requireQuarto: true }))

  assert.match(messages[0], /run `quarto render`/)
})

test("rejects frozen output belonging to an unpublished document", async () => {
  const vault = await withVault({
    "research/study.qmd": note("Study", "publish: true\n", "Body"),
    "research/private.qmd": note("Private Study", "publish: false\n", "Body"),
  })
  await vault.write({
    "_freeze/research/study/execute-results/html.json": "{}",
    "_freeze/research/private/execute-results/html.json": "{}",
  })

  const messages = await messagesFrom(vault.run)

  assert.deepEqual(messages, ["frozen output for a document that is not published; delete it"])
})

test("ignores link syntax inside code", () => {
  const body = "Real [[Target]].\n\n```text\n[[Not A Link]]\n```\n\nInline `[[Also Not]]`.\n"

  assert.deepEqual(
    extractReferences(body).map((reference) => reference.target),
    ["Target"],
  )
  assert.doesNotMatch(stripCode(body), /Not A Link/)
})

test("reads aliases, headings, and embeds out of wikilink syntax", () => {
  const references = extractReferences("[[Note#Heading|shown]] ![[diagram.svg]] [[a^block]]")

  assert.deepEqual(references, [
    { raw: "[[Note#Heading|shown]]", target: "Note", embed: false, kind: "wikilink" },
    { raw: "![[diagram.svg]]", target: "diagram.svg", embed: true, kind: "wikilink" },
    { raw: "[[a^block]]", target: "a", embed: false, kind: "wikilink" },
  ])
})

test("leaves external and anchor-only links alone", () => {
  const references = extractReferences("[x](https://example.com) [y](#section) [z](notes/a.md)")

  assert.deepEqual(
    references.map((reference) => reference.target),
    ["notes/a.md"],
  )
})
