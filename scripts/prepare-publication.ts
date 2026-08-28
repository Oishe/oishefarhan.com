import { copyFile, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { parse as parseYaml } from "yaml"
import { generateQmdStub } from "./generate-qmd-stub.ts"

// Publication prep (section 15). Deliberately narrower than a content compiler:
// it selects publishable sources, stages them, and fails the build on metadata,
// link, or privacy defects. Graph/search/backlink indexes stay with Quartz.

export type SourceType = "markdown" | "quarto"

export type SourceDocument = {
  /** Vault-relative POSIX path, e.g. "research/monte-carlo.qmd". */
  sourcePath: string
  /** Repo-relative POSIX path, e.g. "vault/research/monte-carlo.qmd". */
  repoPath: string
  sourceType: SourceType
  frontmatter: Record<string, unknown>
  raw: string
  body: string
  publish: boolean
  fixture: boolean
  title: string
  aliases: string[]
  tags: string[]
  /** Canonical slug, derived from the source path. */
  slug: string
  url: string
}

export type Problem = { file: string; message: string }

export type PrepareOptions = {
  /**
   * Stage `fixture: true` documents as though they were published.
   *
   * The validators inspect real built pages -- a Quarto fragment hosted in a
   * Quartz shell, a Python cell, a Jupyter widget -- and nothing in the
   * portfolio exercises those paths. So the fixtures still have to be built;
   * they just must not reach the public site. This flag is the seam: the
   * production build leaves it off and the fixtures vanish, the validation
   * build turns it on and gets its own output tree.
   */
  includeFixtures: boolean
  vaultDir: string
  contentDir: string
  linkMapPath: string
  quartoDir: string
  /** Profile name `quarto render --profile <name>` activates. */
  quartoProfile: string
  attachmentRoot: string
  bibliographySource: string
  bibliographyTarget: string
  /** Fail when a published .qmd has no rendered Quarto artifact yet. */
  requireQuarto: boolean
  /**
   * Clear generated/quarto/ so the next render starts from nothing. Quarto
   * refuses to clean an output-dir outside its project, so it leaves orphaned
   * `*_files/` directories behind that the bridge emitter would keep copying.
   */
  clearQuartoOutput: boolean
}

export type PrepareResult = {
  documents: SourceDocument[]
  published: SourceDocument[]
  attachments: string[]
  linkMap: LinkMap
}

export const defaultOptions: PrepareOptions = {
  includeFixtures: false,
  vaultDir: "vault",
  contentDir: "generated/quartz-content",
  linkMapPath: "generated/link-map.json",
  quartoDir: "generated/quarto",
  quartoProfile: "publish",
  attachmentRoot: "attachments",
  bibliographySource: "vault/references.bib",
  bibliographyTarget: "generated/quartz-content/bibliography.bib",
  requireQuarto: false,
  // Off by default so importing this module never deletes anything unexpected;
  // the CLI turns it on for the stage pass.
  clearQuartoOutput: false,
}

export class ValidationFailure extends Error {
  problems: Problem[]

  constructor(problems: Problem[]) {
    const report = problems.map(({ file, message }) => `  ${file}: ${message}`).join("\n")
    super(`publication prep found ${problems.length} problem(s):\n${report}`)
    this.name = "ValidationFailure"
    this.problems = problems
  }
}

const slugSegment = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/
const externalLink = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

export function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown> | undefined
  body: string
} {
  if (!raw.startsWith("---\n")) {
    return { frontmatter: undefined, body: raw }
  }

  const closingDelimiter = raw.indexOf("\n---\n", 3)
  if (closingDelimiter === -1) {
    return { frontmatter: undefined, body: raw }
  }

  const parsed = parseYaml(raw.slice(4, closingDelimiter + 1)) as unknown
  const body = raw.slice(closingDelimiter + "\n---\n".length)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { frontmatter: undefined, body }
  }

  return { frontmatter: parsed as Record<string, unknown>, body }
}

function stringList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return []
  }
  if (typeof value === "string") {
    return [value]
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    return undefined
  }
  return value as string[]
}

// ---------------------------------------------------------------------------
// Source discovery
// ---------------------------------------------------------------------------

function isIgnoredDirectory(name: string): boolean {
  // Dot directories are tool state. "_"-prefixed directories are reserved for
  // non-public content and tool output (_hidden, _freeze, _site, and so on).
  // "templates" holds authoring scaffolds, never content.
  //
  // The "_hidden" suffix is the directory privacy boundary and needs its own
  // test: "drafts_hidden" carries no leading underscore, so the prefix rule
  // above would walk straight into it. The bare "_hidden" satisfies both.
  return (
    name.startsWith(".") ||
    name.startsWith("_") ||
    name.endsWith("_hidden") ||
    name === "node_modules" ||
    name === "templates"
  )
}

function isIgnoredFile(name: string): boolean {
  // Dotfiles are tool state. `*.hidden.md` and `*.hidden.qmd` are the per-file
  // privacy boundary: the single-note equivalent of a `*_hidden/` directory,
  // git-ignored by the same rule. Skipping them here keeps a local run and a CI
  // run over the committed tree on the same file set, so a link into a hidden
  // note fails locally instead of only in CI.
  return name.startsWith(".") || /\.hidden\.(md|qmd)$/.test(name)
}

export async function collectFiles(root: string): Promise<string[]> {
  const found: string[] = []

  async function walk(relative: string): Promise<void> {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (!isIgnoredDirectory(entry.name)) {
          await walk(child)
        }
      } else if (entry.isFile() && !isIgnoredFile(entry.name)) {
        found.push(child)
      }
    }
  }

  await walk("")
  return found
}

/**
 * Force `publish: true` on a staged copy.
 *
 * Staging already decided what belongs in this tree; the frontmatter flag is
 * the vault's opinion, and for a fixture it says `false`. Quartz reads only the
 * staged tree, and `@quartz-community/explicit-publish` would drop every
 * fixture on sight. Rewriting keeps the staged tree's own invariant honest --
 * everything here is published, within this build -- while the vault source
 * keeps saying `publish: false`, which is what stops it reaching the site.
 */
export function markStagedAsPublished(contents: string): string {
  const { frontmatter } = parseFrontmatter(contents)
  if (!frontmatter) return contents
  return /^publish:.*$/m.test(contents)
    ? contents.replace(/^publish:.*$/m, "publish: true")
    : contents.replace(/^---\n/, "---\npublish: true\n")
}

export function slugForSourcePath(sourcePath: string): string {
  return sourcePath.replace(/\.(md|qmd)$/, "")
}

function readDocument(
  sourcePath: string,
  repoPath: string,
  raw: string,
  problems: Problem[],
  includeFixtures = false,
): SourceDocument | undefined {
  const { frontmatter, body } = parseFrontmatter(raw)
  if (!frontmatter) {
    problems.push({ file: repoPath, message: "missing or unparsable YAML frontmatter" })
    return undefined
  }

  const title = frontmatter.title
  if (typeof title !== "string" || !title.trim()) {
    problems.push({ file: repoPath, message: "frontmatter needs a non-empty `title`" })
    return undefined
  }

  const publish = frontmatter.publish
  if (publish !== undefined && typeof publish !== "boolean") {
    problems.push({ file: repoPath, message: "`publish` must be true or false" })
    return undefined
  }

  const fixture = frontmatter.fixture
  if (fixture !== undefined && typeof fixture !== "boolean") {
    problems.push({ file: repoPath, message: "`fixture` must be true or false" })
    return undefined
  }
  if (fixture === true && publish === true) {
    problems.push({
      file: repoPath,
      message: "a `fixture` document must be `publish: false`; fixtures never reach the site",
    })
    return undefined
  }

  const aliases = stringList(frontmatter.aliases)
  const tags = stringList(frontmatter.tags)
  if (!aliases) {
    problems.push({ file: repoPath, message: "`aliases` must be a list of strings" })
    return undefined
  }
  if (!tags) {
    problems.push({ file: repoPath, message: "`tags` must be a list of strings" })
    return undefined
  }

  const slug = slugForSourcePath(sourcePath)
  return {
    sourcePath,
    repoPath,
    sourceType: sourcePath.endsWith(".qmd") ? "quarto" : "markdown",
    frontmatter,
    raw,
    body,
    publish: publish === true || (includeFixtures && fixture === true),
    fixture: fixture === true,
    title: title.trim(),
    aliases,
    tags,
    slug,
    url: `/${slug}`,
  }
}

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

export type Reference = {
  raw: string
  target: string
  embed: boolean
}

/** Blanks out code so that link syntax inside examples is never validated. */
export function stripCode(body: string): string {
  const lines = body.split("\n")
  const kept: string[] = []
  let closingFence: RegExp | undefined

  for (const line of lines) {
    if (closingFence) {
      if (closingFence.test(line)) {
        closingFence = undefined
      }
      kept.push("")
      continue
    }

    const opening = line.match(/^\s*(`{3,}|~{3,})/)
    if (opening) {
      const marker = opening[1]
      closingFence = new RegExp(`^\\s*${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`)
      kept.push("")
      continue
    }

    kept.push(line.replace(/`[^`\n]*`/g, ""))
  }

  return kept.join("\n")
}

export function extractReferences(body: string): Reference[] {
  const source = stripCode(body)
  const references: Reference[] = []

  for (const match of source.matchAll(
    /(!?)\[[^\]\n]*\]\(\s*<?([^)>\s]+)>?(?:\s+"[^"\n]*")?\s*\)/g,
  )) {
    const target = decodeURI(match[2].split("#")[0])
    if (target && !externalLink.test(target)) {
      references.push({ raw: match[0], target, embed: match[1] === "!" })
    }
  }

  return references
}

// ---------------------------------------------------------------------------
// Obsidian syntax that Quarto does not understand
// ---------------------------------------------------------------------------

/**
 * Quarto renders Pandoc Markdown, not Obsidian Markdown, so a handful of
 * Obsidian constructs reach the page verbatim instead of being interpreted.
 * The comment case is the dangerous one: `%%...%%` is a note-to-self in
 * Obsidian and publishes as visible body text from a .qmd.
 */
const quartoUnsupported: { pattern: RegExp; message: string }[] = [
  {
    pattern: /%%[\s\S]*?%%/,
    message:
      "Obsidian comment syntax (%%...%%) publishes as visible text from a .qmd; use an HTML comment instead",
  },
  {
    pattern: /^\s*>\s*\[!\w+\]/m,
    message:
      "Obsidian callout syntax renders as a plain blockquote from a .qmd, keeping the [!note] marker as literal text. Quarto callouts are not an alternative here: Quarto only emits callout markup when Bootstrap is present, and this site renders a body fragment without it. Use a blockquote or a section heading",
  },
  {
    // Not Obsidian syntax but the same failure mode: it looks supported and
    // degrades silently. Quarto emits callout markup only when Bootstrap is
    // present, and a published .qmd here is a body fragment without it, so the
    // div collapses to a blockquote and the callout type is discarded.
    pattern: /^\s*:::+\s*\{[^}]*\.callout-\w+/m,
    message:
      "Quarto callouts (::: {.callout-note}) need Bootstrap, which a published .qmd here does not load; the div degrades to a plain blockquote and the callout type is lost. Use a blockquote or a section heading",
  },
  {
    pattern: /==(?![\s=])[^=\n]+(?<![\s=])==/,
    message: "Obsidian highlights (==text==) render literally from a .qmd; use <mark>text</mark>",
  },
]

/** Reports Obsidian-only syntax in a published Quarto document. */
export function checkQuartoSyntax(document: SourceDocument): Problem[] {
  if (document.sourceType !== "quarto") return []
  const body = stripCode(document.body)
  return quartoUnsupported
    .filter(({ pattern }) => pattern.test(body))
    .map(({ message }) => ({ file: document.repoPath, message }))
}

/**
 * Reports leftover wikilinks anywhere in the vault.
 *
 * This system links with Markdown syntax only. Nothing resolves `[[...]]` any
 * more -- not Quarto, not Quartz -- so a surviving one publishes as literal
 * text (or, for `![[...]]`, as a silently missing embed) rather than failing
 * loudly on its own.
 */
export function checkWikilinks(document: SourceDocument): Problem[] {
  const body = stripCode(document.body)
  const match = body.match(/!?\[\[[^\[\]]+?\]\]/)
  if (!match) return []
  return [
    {
      file: document.repoPath,
      message:
        `wikilink syntax is no longer supported (${match[0]}); ` +
        "use a Markdown link, e.g. [Title](../section/note.md)",
    },
  ]
}

// ---------------------------------------------------------------------------
// Index and resolution
// ---------------------------------------------------------------------------

type DocumentIndex = {
  bySlug: Map<string, SourceDocument>
  attachments: Set<string>
}

function buildIndex(documents: SourceDocument[], attachments: string[]): DocumentIndex {
  const index: DocumentIndex = {
    bySlug: new Map(),
    attachments: new Set(attachments),
  }

  for (const document of documents) {
    index.bySlug.set(document.slug.toLowerCase(), document)
  }

  return index
}

export type Resolution =
  | { kind: "document"; document: SourceDocument }
  | { kind: "attachment"; path: string }
  | { kind: "unresolved"; reason: string }

function normalizeTarget(target: string): string {
  return target.replace(/^\.\//, "").replace(/^\//, "")
}

function resolveAttachment(candidate: string, index: DocumentIndex): Resolution | undefined {
  return index.attachments.has(candidate) ? { kind: "attachment", path: candidate } : undefined
}

/**
 * Resolves a link target, which is always a path from the vault folder.
 *
 * There is deliberately one interpretation and no fallbacks. Obsidian is set to
 * `newLinkFormat: absolute` and Quartz to `markdownLinkResolution: absolute`,
 * so author, validator, and renderer all read a target the same way. The
 * alternatives are what make link resolution subtle: a relative or shortest
 * target has two plausible readings, and a bare `index.md` in a section means
 * that section's index to Obsidian but the site root to Quartz. Requiring the
 * unambiguous form removes the question instead of answering it three times.
 */
export function resolveReference(reference: Reference, index: DocumentIndex): Resolution {
  const target = normalizeTarget(reference.target)
  const withoutExtension = target.replace(/\.(md|qmd)$/, "")
  const looksLikeFile = /\.[a-z0-9]+$/i.test(target) && !/\.(md|qmd)$/.test(target)

  if (looksLikeFile) {
    return (
      resolveAttachment(target, index) ?? {
        kind: "unresolved",
        reason: "no such attachment in the vault (link paths are from the vault folder)",
      }
    )
  }

  const document = index.bySlug.get(withoutExtension.toLowerCase())
  if (document) {
    return { kind: "document", document }
  }

  return {
    kind: "unresolved",
    reason: "no published note or attachment matches (link paths are from the vault folder)",
  }
}

/**
 * Rewrites every internal link target to its resolved, vault-root-relative path.
 *
 * Prep already decides where each link goes in order to validate it. Writing
 * that decision into the staged file is what keeps prep and the renderer from
 * disagreeing, and it closes two real traps:
 *
 *   - Quartz slugification strips `.md` and `.html` but no other extension, so
 *     a surviving `.qmd` target would publish as a broken link.
 *   - Quartz collapses a bare `index.md` to the site root regardless of the
 *     directory it was written in, so a link to a sibling section index would
 *     silently leave the section. The explicit `section/index.md` form that
 *     resolution produces has no such ambiguity.
 *
 * Authors keep writing whatever Obsidian writes; this normalises it.
 */
export function rewriteLinkTargets(raw: string, index: DocumentIndex): string {
  return raw.replace(
    /(!?\[[^\]\n]*\]\(\s*<?)([^)>\s]+)(>?(?:\s+"[^"\n]*")?\s*\))/g,
    (match, prefix: string, target: string, suffix: string) => {
      const separator = target.indexOf("#")
      const pathPart = separator === -1 ? target : target.slice(0, separator)
      const anchor = separator === -1 ? "" : target.slice(separator)
      if (!pathPart || externalLink.test(pathPart)) return match

      const resolution = resolveReference(
        { raw: match, target: decodeURI(pathPart), embed: match.startsWith("!") },
        index,
      )
      if (resolution.kind === "document") {
        return `${prefix}${resolution.document.slug}.md${anchor}${suffix}`
      }
      if (resolution.kind === "attachment") {
        return `${prefix}${resolution.path}${anchor}${suffix}`
      }
      return match
    },
  )
}

// ---------------------------------------------------------------------------
// Link map
// ---------------------------------------------------------------------------

export type LinkMapDocument = {
  sourcePath: string
  sourceType: SourceType
  slug: string
  url: string
  title: string
  aliases: string[]
}

export type LinkMap = {
  documents: LinkMapDocument[]
  attachments: { sourcePath: string; url: string }[]
  /** Title, alias, slug, and source path, each mapped to its canonical URL. */
  byKey: Record<string, string>
}

export function buildLinkMap(
  published: SourceDocument[],
  attachments: string[],
  vaultDir: string,
  problems: Problem[],
): LinkMap {
  const byKey: Record<string, string> = {}
  const owners = new Map<string, SourceDocument>()

  const claim = (key: string, document: SourceDocument, label: string): void => {
    const owner = owners.get(key)
    if (owner && owner !== document) {
      problems.push({
        file: document.repoPath,
        message: `${label} "${key}" is already claimed by ${owner.repoPath}`,
      })
      return
    }
    owners.set(key, document)
    byKey[key] = document.url
  }

  for (const document of published) {
    claim(document.title, document, "title")
    for (const alias of document.aliases) {
      claim(alias, document, "alias")
    }
    claim(document.slug, document, "slug")
    claim(document.sourcePath, document, "source path")
  }

  return {
    documents: published.map((document) => ({
      sourcePath: document.repoPath,
      sourceType: document.sourceType,
      slug: document.slug,
      url: document.url,
      title: document.title,
      aliases: document.aliases,
    })),
    attachments: attachments.map((attachment) => ({
      sourcePath: `${vaultDir}/${attachment}`,
      url: `/${attachment}`,
    })),
    byKey: Object.fromEntries(Object.entries(byKey).sort(([a], [b]) => a.localeCompare(b))),
  }
}

// ---------------------------------------------------------------------------
// Quarto artifact checks
// ---------------------------------------------------------------------------

async function checkQuartoArtifacts(
  published: SourceDocument[],
  options: PrepareOptions,
  problems: Problem[],
): Promise<void> {
  const quartoDocuments = published.filter((document) => document.sourceType === "quarto")
  const expected = new Set(quartoDocuments.map((document) => `${document.slug}.html`))

  let rendered: string[]
  try {
    rendered = (await collectFiles(options.quartoDir)).filter((file) => file.endsWith(".html"))
  } catch {
    if (options.requireQuarto) {
      problems.push({
        file: options.quartoDir,
        message: "no Quarto output tree; run `quarto render` before verifying",
      })
    }
    return
  }

  // A stale artifact for a document that is no longer public is a leak: the
  // bridge emitter copies the whole tree to canonical URLs (section 22.2).
  for (const file of rendered) {
    if (!expected.has(file)) {
      problems.push({
        file: `${options.quartoDir}/${file}`,
        message: "rendered artifact has no matching published .qmd; delete it and re-render",
      })
    }
  }

  if (options.requireQuarto) {
    for (const document of quartoDocuments) {
      if (!rendered.includes(`${document.slug}.html`)) {
        problems.push({
          file: document.repoPath,
          // Section 20: stub slug and Quarto public URL must not diverge.
          message: `expected Quarto output at ${options.quartoDir}/${document.slug}.html`,
        })
      }
    }
  }
}

async function checkFreezeTree(
  documents: SourceDocument[],
  options: PrepareOptions,
  problems: Problem[],
): Promise<void> {
  const freezeDir = path.join(options.vaultDir, "_freeze")
  let frozen: string[]
  try {
    frozen = await collectFiles(freezeDir)
  } catch {
    return
  }

  const published = new Set(
    documents
      .filter(
        (document) =>
          (document.publish || document.fixture) && document.sourceType === "quarto",
      )
      .map((document) => document.slug),
  )

  // Frozen results can embed output derived from private data even when the
  // document itself was never published (section 22.2).
  const seen = new Set<string>()
  for (const file of frozen) {
    const owner = file.split("/").slice(0, -2).join("/")
    if (!owner || seen.has(owner)) {
      continue
    }
    seen.add(owner)
    if (!published.has(owner)) {
      problems.push({
        file: `${freezeDir}/${owner}`,
        message: "frozen output for a document that is not published; delete it",
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function preparePublication(
  overrides: Partial<PrepareOptions> = {},
): Promise<PrepareResult> {
  const options = { ...defaultOptions, ...overrides }
  const problems: Problem[] = []
  const files = await collectFiles(options.vaultDir)

  const documents: SourceDocument[] = []
  const attachments: string[] = []
  for (const file of files) {
    if (file.endsWith(".md") || file.endsWith(".qmd")) {
      const repoPath = `${options.vaultDir}/${file}`
      const raw = await readFile(path.join(options.vaultDir, file), "utf8")
      const document = readDocument(file, repoPath, raw, problems, options.includeFixtures)
      if (document) {
        documents.push(document)
      }
    } else if (file.startsWith(`${options.attachmentRoot}/`)) {
      attachments.push(file)
    }
  }

  const published = documents.filter((document) => document.publish)

  // Slugs are derived from paths, so published paths must already be slug-safe.
  for (const document of published) {
    const offending = document.slug.split("/").filter((segment) => !slugSegment.test(segment))
    if (offending.length > 0) {
      problems.push({
        file: document.repoPath,
        message: `path segment(s) ${offending.join(", ")} are not slug-safe; use lowercase words separated by "-"`,
      })
    }
  }

  const bySlug = new Map<string, SourceDocument>()
  for (const document of published) {
    const clash = bySlug.get(document.slug)
    if (clash) {
      problems.push({
        file: document.repoPath,
        message: `slug "${document.slug}" collides with ${clash.repoPath}`,
      })
    } else {
      bySlug.set(document.slug, document)
    }
  }

  // Slug-colliding documents are already reported; keep one owner per URL so
  // downstream stages never see two documents competing for the same page.
  const staged = [...bySlug.values()]
  const publishedIndex = buildIndex(published, attachments)
  const allIndex = buildIndex(documents, attachments)
  const referencedAttachments = new Set<string>()

  for (const document of published) {
    problems.push(...checkQuartoSyntax(document))
    problems.push(...checkWikilinks(document))
    for (const reference of extractReferences(document.body)) {
      const resolution = resolveReference(reference, publishedIndex)
      if (resolution.kind === "attachment") {
        referencedAttachments.add(resolution.path)
        continue
      }
      if (resolution.kind === "document") {
        continue
      }

      // Distinguish "broken" from "private": the second is a leak in the
      // making, and the message has to say so.
      const private_ = resolveReference(reference, allIndex)
      if (private_.kind === "document" && !private_.document.publish) {
        problems.push({
          file: document.repoPath,
          message: `${reference.raw} points at unpublished ${private_.document.repoPath}`,
        })
      } else {
        problems.push({ file: document.repoPath, message: `${reference.raw}: ${resolution.reason}` })
      }
    }
  }

  const stagedAttachments = [...referencedAttachments].sort()
  const linkMap = buildLinkMap(staged, stagedAttachments, options.vaultDir, problems)

  // Pointless when the tree is about to be wiped: the stage pass clears it and
  // the verify pass re-checks what the render actually produced.
  if (!options.clearQuartoOutput) {
    await checkQuartoArtifacts(published, options, problems)
  }
  await checkFreezeTree(documents, options, problems)

  if (problems.length > 0) {
    throw new ValidationFailure(problems)
  }

  // The staged tree is fully derivable, so it is rebuilt rather than patched.
  await rm(options.contentDir, { recursive: true, force: true })
  await mkdir(options.contentDir, { recursive: true })

  // The staged tree is untracked and rebuilt from scratch, so Quartz can only
  // date a page from the filesystem. Carry the source timestamps across.
  const carryTimestamps = async (source: string, target: string): Promise<void> => {
    const { atime, mtime } = await stat(source)
    await utimes(target, atime, mtime)
  }

  for (const document of staged) {
    const source = path.join(options.vaultDir, document.sourcePath)
    const target = path.join(options.contentDir, `${document.slug}.md`)
    await mkdir(path.dirname(target), { recursive: true })
    const contents = markStagedAsPublished(
      rewriteLinkTargets(
        document.sourceType === "quarto"
          ? generateQmdStub(document.raw, document.repoPath)
          : document.raw,
        publishedIndex,
      ),
    )
    await writeFile(target, contents, "utf8")
    await carryTimestamps(source, target)
  }

  for (const attachment of stagedAttachments) {
    const source = path.join(options.vaultDir, attachment)
    const target = path.join(options.contentDir, attachment)
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(source, target)
    await carryTimestamps(source, target)
  }

  try {
    await copyFile(options.bibliographySource, options.bibliographyTarget)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }

  if (options.clearQuartoOutput) {
    await rm(options.quartoDir, { recursive: true, force: true })
  }

  await mkdir(path.dirname(options.linkMapPath), { recursive: true })
  await writeFile(options.linkMapPath, `${JSON.stringify(linkMap, null, 2)}\n`, "utf8")

  // Quarto cannot select documents by arbitrary frontmatter. Generate a
  // profile containing the exact published QMD allowlist so computational
  // notes can live anywhere without rendering public-source drafts. The base
  // config contributes the *_hidden exclusion as defense in depth.
  const quartoTargets = published
    .filter((document) => document.sourceType === "quarto")
    .map((document) => document.sourcePath)
    .sort()
  // A null/empty render field can fall back to project discovery. An exclusion
  // target makes the zero-QMD case explicitly render nothing.
  const profileTargets = quartoTargets.length > 0 ? quartoTargets : ["!**/*"]
  // The output directory travels with the profile: a fixture render must not
  // write over the artifacts the production bridge reads.
  const quartoOutputDir = path.posix.relative(
    options.vaultDir,
    options.quartoDir.split(path.sep).join(path.posix.sep),
  )
  const quartoProfile = [
    "# Generated by scripts/prepare-publication.ts; do not edit.",
    "project:",
    `  output-dir: ${JSON.stringify(quartoOutputDir)}`,
    "  render:",
    ...profileTargets.map((target) => `    - ${JSON.stringify(target)}`),
    "",
  ].join("\n")
  await writeFile(
    path.join(options.vaultDir, `_quarto-${options.quartoProfile}.yml`),
    quartoProfile,
    "utf8",
  )

  return { documents, published, attachments: stagedAttachments, linkMap }
}

async function main(): Promise<void> {
  // Two modes, matching the section 28 order. The default stage mode runs
  // before Quarto and clears its output tree; --require-quarto runs after and
  // only verifies, so it must leave that tree alone.
  const requireQuarto = process.argv.includes("--require-quarto")
  // --keep-quarto stages without clearing the rendered tree, so a prose-only
  // edit can reach the site with `prepare-publication --keep-quarto && site`
  // instead of a full Quarto re-render.
  const keepQuarto = process.argv.includes("--keep-quarto")
  // --fixtures stages the validation fixtures alongside real content, into a
  // separate tree. Only `npm run validate` passes it; the production build
  // never does, so nothing under examples/ can reach the public site.
  const includeFixtures = process.argv.includes("--fixtures")
  const fixtureDirs = includeFixtures
    ? {
        contentDir: "generated/fixture-content",
        linkMapPath: "generated/fixture-link-map.json",
        quartoDir: "generated/fixture-quarto",
        quartoProfile: "fixtures",
        bibliographyTarget: "generated/fixture-content/bibliography.bib",
      }
    : {}
  try {
    const result = await preparePublication({
      includeFixtures,
      ...fixtureDirs,
      requireQuarto,
      clearQuartoOutput: !requireQuarto && !keepQuarto,
    })
    const stubs = result.published.filter((document) => document.sourceType === "quarto").length
    console.log(
      `Staged ${result.published.length} of ${result.documents.length} documents ` +
        `(${stubs} QMD stub(s)), ${result.attachments.length} attachment(s).`,
    )
  } catch (error) {
    if (error instanceof ValidationFailure) {
      console.error(error.message)
      process.exitCode = 1
      return
    }
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
