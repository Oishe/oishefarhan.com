import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { QuartoArtifacts } from "./quartz/plugins/emitters/quartoArtifacts"
import { QuartoPage } from "./quartz/plugins/pageTypes/quartoPage"

const config = await loadQuartzConfig()

config.plugins.pageTypes ??= []
config.plugins.pageTypes.push(QuartoPage({ sourceDirectory: "../generated/quarto" }))

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
