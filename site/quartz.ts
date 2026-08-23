import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { QuartoArtifacts } from "./quartz/plugins/emitters/quartoArtifacts"
import { QuartoPage } from "./quartz/plugins/pageTypes/quartoPage"

const config = await loadQuartzConfig()

config.plugins.pageTypes ??= []
config.plugins.pageTypes.push(
  QuartoPage({
    sourceDirectory: "../generated/quarto",
    // Must match the URLs @quartz-community/graph loads, so its own lookup finds
    // globals that are already populated rather than racing an AMD loader.
    preloadScripts: [
      "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js",
      "https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.js",
    ],
  }),
)

const pageDispatcherIndex = config.plugins.emitters.findIndex(
  (emitter) => emitter.name === "PageTypeDispatcher",
)
config.plugins.emitters.splice(
  pageDispatcherIndex === -1 ? config.plugins.emitters.length : pageDispatcherIndex,
  0,
  QuartoArtifacts({ sourceDirectory: "../generated/quarto", includeHtml: false }),
)

export default config
export const layout = await loadQuartzLayout()
