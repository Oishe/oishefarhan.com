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
  title: string
  aliases: string[]
  tags: string[]
  /** Canonical slug, derived from the source path. */
  slug: string
  url: string
}

export type Problem = { file: string; message: string }

export type PrepareOptions = {
  vaultDir: string
  contentDir: string
  linkMapPath: string
  quartoDir: string
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
  vaultDir: "vault",
  contentDir: "generated/quartz-content",
  linkMapPath: "generated/link-map.json",
  quartoDir: "generated/quarto",
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
  // Dot directories are tool state; "_"-prefixed ones are Quarto's own
  // (_freeze, _site). "templates" holds authoring scaffolds, never content.
  return name.startsWith(".") || name.startsWith("_") || name === "node_modules" || name === "templates"
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
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        found.push(child)
      }
    }
  }

  await walk("")
  return found
}

export function slugForSourcePath(sourcePath: string): string {
  return sourcePath.replace(/\.(md|qmd)$/, "")
}

function readDocument(
  sourcePath: string,
  repoPath: string,
  raw: string,
  problems: Problem[],
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
    publish: publish === true,
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
  kind: "wikilink" | "markdown"
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

  for (const match of source.matchAll(/(!?)\[\[([^\[\]]+?)\]\]/g)) {
    const target = match[2].split("|")[0].split("#")[0].split("^")[0].trim()
    if (target) {
      references.push({ raw: match[0], target, embed: match[1] === "!", kind: "wikilink" })
    }
  }

  for (const match of source.matchAll(
    /(!?)\[[^\]\n]*\]\(\s*<?([^)>\s]+)>?(?:\s+"[^"\n]*")?\s*\)/g,
  )) {
    const target = decodeURI(match[2].split("#")[0])
    if (target && !externalLink.test(target)) {
      references.push({ raw: match[0], target, embed: match[1] === "!", kind: "markdown" })
    }
  }

  return references
}

// ---------------------------------------------------------------------------
// Index and resolution
// ---------------------------------------------------------------------------

type DocumentIndex = {
  bySlug: Map<string, SourceDocument>
  byName: Map<string, SourceDocument[]>
  byBasename: Map<string, SourceDocument[]>
  attachments: Set<string>
  attachmentsByBasename: Map<string, string[]>
}

function pushInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key)
  if (!existing) {
    map.set(key, [value])
  } else if (!existing.includes(value)) {
    // A title repeated in the same note's aliases is not an ambiguity.
    existing.push(value)
  }
}

function buildIndex(documents: SourceDocument[], attachments: string[]): DocumentIndex {
  const index: DocumentIndex = {
    bySlug: new Map(),
    byName: new Map(),
    byBasename: new Map(),
    attachments: new Set(attachments),
    attachmentsByBasename: new Map(),
  }

  for (const document of documents) {
    index.bySlug.set(document.slug.toLowerCase(), document)
    pushInto(index.byName, document.title.toLowerCase(), document)
    for (const alias of document.aliases) {
      pushInto(index.byName, alias.toLowerCase(), document)
    }
    pushInto(index.byBasename, path.posix.basename(document.slug).toLowerCase(), document)
  }

  for (const attachment of attachments) {
    pushInto(index.attachmentsByBasename, path.posix.basename(attachment).toLowerCase(), attachment)
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

function resolveAttachment(
  candidate: string,
  fromDirectory: string,
  index: DocumentIndex,
): Resolution | undefined {
  const candidates = [
    candidate,
    path.posix.normalize(path.posix.join(fromDirectory, candidate)),
  ]
  for (const option of candidates) {
    if (index.attachments.has(option)) {
      return { kind: "attachment", path: option }
    }
  }

  const byBasename = index.attachmentsByBasename.get(path.posix.basename(candidate).toLowerCase())
  if (byBasename?.length === 1) {
    return { kind: "attachment", path: byBasename[0] }
  }
  if (byBasename && byBasename.length > 1) {
    return { kind: "unresolved", reason: `ambiguous attachment name (${byBasename.join(", ")})` }
  }
  return undefined
}

/**
 * Resolution precedence matches the Quartz `QuartoPage` wikilink adapter:
 * canonical path, then title/alias, then basename.
 */
export function resolveReference(
  reference: Reference,
  from: SourceDocument,
  index: DocumentIndex,
): Resolution {
  const fromDirectory = path.posix.dirname(from.sourcePath)
  const target = normalizeTarget(reference.target)
  const withoutExtension = target.replace(/\.(md|qmd)$/, "")
  const looksLikeFile = /\.[a-z0-9]+$/i.test(target) && !/\.(md|qmd)$/.test(target)

  if (looksLikeFile) {
    return (
      resolveAttachment(target, fromDirectory, index) ?? {
        kind: "unresolved",
        reason: "no such attachment in the vault",
      }
    )
  }

  const bySlug =
    index.bySlug.get(withoutExtension.toLowerCase()) ??
    index.bySlug.get(path.posix.normalize(path.posix.join(fromDirectory, withoutExtension)).toLowerCase())
  if (bySlug) {
    return { kind: "document", document: bySlug }
  }

  if (reference.kind === "wikilink") {
    const byName = index.byName.get(target.toLowerCase())
    if (byName?.length === 1) {
      return { kind: "document", document: byName[0] }
    }
    if (byName && byName.length > 1) {
      return {
        kind: "unresolved",
        reason: `ambiguous title or alias (${byName.map((entry) => entry.sourcePath).join(", ")})`,
      }
    }

    const byBasename = index.byBasename.get(path.posix.basename(withoutExtension).toLowerCase())
    if (byBasename?.length === 1) {
      return { kind: "document", document: byBasename[0] }
    }
    if (byBasename && byBasename.length > 1) {
      return {
        kind: "unresolved",
        reason: `ambiguous note name (${byBasename.map((entry) => entry.sourcePath).join(", ")})`,
      }
    }
  }

  return { kind: "unresolved", reason: "no published note, alias, or attachment matches" }
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
      .filter((document) => document.publish && document.sourceType === "quarto")
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
      const document = readDocument(file, repoPath, raw, problems)
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
    for (const reference of extractReferences(document.body)) {
      const resolution = resolveReference(reference, document, publishedIndex)
      if (resolution.kind === "attachment") {
        referencedAttachments.add(resolution.path)
        continue
      }
      if (resolution.kind === "document") {
        continue
      }

      // Distinguish "broken" from "private": the second is a leak in the
      // making, and the message has to say so.
      const private_ = resolveReference(reference, document, allIndex)
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
    const contents =
      document.sourceType === "quarto" ? generateQmdStub(document.raw, document.repoPath) : document.raw
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

  return { documents, published, attachments: stagedAttachments, linkMap }
}

async function main(): Promise<void> {
  // Two modes, matching the section 28 order. The default stage mode runs
  // before Quarto and clears its output tree; --require-quarto runs after and
  // only verifies, so it must leave that tree alone.
  const requireQuarto = process.argv.includes("--require-quarto")
  try {
    const result = await preparePublication({ requireQuarto, clearQuartoOutput: !requireQuarto })
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
