import fs from "node:fs"
import path from "node:path"
import type { QuartzEmitterPlugin } from "../quartz/plugins/types"
import type { FilePath } from "../quartz/util/path"

interface QuartoArtifactsOptions {
  sourceDirectory: string
  includeHtml?: boolean
}

async function* artifactFiles(root: string, relativeDirectory = ""): AsyncGenerator<string> {
  const directory = path.join(root, relativeDirectory)
  const entries = await fs.promises.readdir(directory, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name)
    if (entry.isSymbolicLink()) {
      throw new Error(`Quarto artifact tree must not contain symlinks: ${relativePath}`)
    }
    if (entry.isDirectory()) {
      yield* artifactFiles(root, relativePath)
    } else if (entry.isFile()) {
      yield relativePath
    }
  }
}

async function* copyArtifacts(
  sourceRoot: string,
  outputRoot: string,
  includeHtml: boolean,
): AsyncGenerator<FilePath> {
  for await (const relativePath of artifactFiles(sourceRoot)) {
    if (!includeHtml && relativePath.endsWith(".html")) continue
    const source = path.join(sourceRoot, relativePath)
    const destination = path.join(outputRoot, relativePath)
    await fs.promises.mkdir(path.dirname(destination), { recursive: true })
    await fs.promises.copyFile(source, destination)
    yield destination as FilePath
  }
}

export const QuartoArtifacts: QuartzEmitterPlugin<QuartoArtifactsOptions> = (options) => {
  if (!options?.sourceDirectory) {
    throw new Error("QuartoArtifacts requires sourceDirectory")
  }

  return {
    name: "QuartoArtifacts",
    async *emit(ctx) {
      const sourceRoot = path.resolve(options.sourceDirectory)
      if (!fs.existsSync(sourceRoot)) {
        throw new Error(`Quarto artifact directory does not exist: ${sourceRoot}`)
      }
      yield* copyArtifacts(sourceRoot, path.resolve(ctx.argv.output), options.includeHtml !== false)
    },
    async *partialEmit(ctx) {
      const sourceRoot = path.resolve(options.sourceDirectory)
      if (!fs.existsSync(sourceRoot)) {
        throw new Error(`Quarto artifact directory does not exist: ${sourceRoot}`)
      }
      yield* copyArtifacts(sourceRoot, path.resolve(ctx.argv.output), options.includeHtml !== false)
    },
  }
}
