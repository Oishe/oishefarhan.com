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
 *
 * SiteNav is the fourth thing here and the odd one out: it is a plain Quartz
 * component with nothing to do with Quarto. It lives here because this is the
 * directory for components this site owns, and no @quartz-community package
 * provides a navbar.
 */
export { SiteNav } from "./siteNav"
export type { SiteNavLink, SiteNavOptions } from "./siteNav"
export { QuartoPage } from "./quartoPage"
export { QuartoArtifacts } from "./quartoArtifacts"
export { extractQuartoPage } from "./quartoPageHtml"
export type { QuartoLinkResolution, QuartoLinkResolver } from "./quartoPageHtml"
