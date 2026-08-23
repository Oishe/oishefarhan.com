/**
 * The Quarto bridge: everything Quartz needs to publish a Quarto-rendered
 * document, and nothing else. Section 29.2 of the architecture note gives it
 * three responsibilities:
 *
 *   1. a dedicated Page Type for `quartoStub: true` Markdown (QuartoPage)
 *   2. extraction of the minimal Quarto body into the Quartz content frame
 *      (extractQuartoPage, used by QuartoPage)
 *   3. copying Quarto dependency artifacts to their canonical URLs
 *      (QuartoArtifacts)
 *
 * It lives outside `quartz/` so the vendored tree stays upstream code. The one
 * exception is documented in QUARTZ_UPSTREAM.md: the SPA router honours a
 * `data-spa-exclude` page marker, which QuartoPage sets.
 */
export { QuartoPage } from "./quartoPage"
export { QuartoArtifacts } from "./quartoArtifacts"
export { extractQuartoPage } from "./quartoPageHtml"
export type { QuartoWikilinkResolution, QuartoWikilinkResolver } from "./quartoPageHtml"
