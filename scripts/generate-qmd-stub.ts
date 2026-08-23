import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const executableFence = /^\s*(`{3,}|~{3,})\s*\{[^}]+\}\s*$/

// Bridge-only metadata (section 21): it identifies the stub to the Quartz page type
// and records the authoritative source, and never appears in vault frontmatter.
function stubMetadata(sourcePath: string): string {
  return `sourceType: quarto\nquartoStub: true\nsourcePath: ${JSON.stringify(sourcePath)}`
}

function addStubFrontmatter(source: string, sourcePath: string): string {
  if (!source.startsWith("---\n")) {
    return `---\n${stubMetadata(sourcePath)}\n---\n\n${source}`
  }

  const closingDelimiter = source.indexOf("\n---\n", 4)
  if (closingDelimiter === -1) {
    throw new Error("QMD frontmatter starts with --- but has no closing delimiter")
  }

  const frontmatter = source.slice(0, closingDelimiter)
  const body = source.slice(closingDelimiter + "\n---\n".length)
  return `${frontmatter}\n${stubMetadata(sourcePath)}\n---\n${body}`
}

export function stripExecutableCells(source: string): string {
  const retained: string[] = []
  let closingFence: RegExp | undefined

  for (const line of source.split("\n")) {
    if (closingFence) {
      if (closingFence.test(line)) {
        closingFence = undefined
      }
      continue
    }

    const opening = line.match(executableFence)
    if (opening) {
      const marker = opening[1]
      const escapedMarker = marker[0] === "`" ? "`" : "~"
      closingFence = new RegExp(`^\\s*${escapedMarker}{${marker.length},}\\s*$`)
      continue
    }

    retained.push(line)
  }

  if (closingFence) {
    throw new Error("QMD contains an unclosed executable code fence")
  }

  return retained.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n"
}

export function generateQmdStub(source: string, sourcePath: string): string {
  return stripExecutableCells(addStubFrontmatter(source, sourcePath))
}

export async function generateQmdStubFile(input: string, output: string): Promise<void> {
  const inputPath = path.resolve(input)
  const outputPath = path.resolve(output)
  const source = await readFile(inputPath, "utf8")
  const sourcePath = path.relative(process.cwd(), inputPath).split(path.sep).join("/")
  const stub = generateQmdStub(source, sourcePath)

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, stub, "utf8")
}

async function main(): Promise<void> {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) {
    throw new Error("usage: generate-qmd-stub.ts <input.qmd> <output.md>")
  }
  if (path.extname(input) !== ".qmd" || path.extname(output) !== ".md") {
    throw new Error("expected a .qmd input and .md output")
  }

  await generateQmdStubFile(input, output)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
