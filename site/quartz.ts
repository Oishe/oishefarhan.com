import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { PageTypeDispatcher } from "./quartz/plugins/pageTypes"
import { QuartoArtifacts, QuartoPage, SiteNav } from "./bridge"

const config = await loadQuartzConfig()

// Where `quarto render` left its output. The validation build renders the
// fixtures to their own tree so nothing under examples/ can reach the public
// site; it points this at that tree. Everything else uses the production one.
const quartoArtifacts = process.env.QUARTO_ARTIFACTS ?? "../generated/quarto"

config.plugins.pageTypes ??= []
config.plugins.pageTypes.push(
  // No preloadScripts. Every Quarto page used to fetch d3 and PIXI (~600 KB)
  // ahead of its own resources, because d3 and PIXI are UMD: a Quarto fragment
  // installs an AMD loader (requirejs, or Plotly's bundled one), the loader
  // swallows d3's anonymous define(), window.d3 is never set, and
  // @quartz-community/graph dies. Preloading them as classic scripts first was
  // the fix. The graph is disabled now and nothing else on the site uses
  // either library, so there is no race left to win. Re-enabling the graph
  // means restoring these, matching the URLs the plugin itself loads.
  QuartoPage({ sourceDirectory: quartoArtifacts }),
)

const pageDispatcherIndex = config.plugins.emitters.findIndex(
  (emitter) => emitter.name === "PageTypeDispatcher",
)
config.plugins.emitters.splice(
  pageDispatcherIndex === -1 ? config.plugins.emitters.length : pageDispatcherIndex,
  0,
  QuartoArtifacts({ sourceDirectory: quartoArtifacts, includeHtml: false }),
)

// The navbar. The Articles/Notes split does real work: it lets rough coursework
// be published without a hiring manager reading it as the best writing here.
const siteNav = SiteNav({
  links: [
    { label: "Articles", slug: "articles/" },
    { label: "Notes", slug: "notes/" },
    { label: "Projects", slug: "projects/" },
    { label: "About", slug: "about/" },
  ],
})

// Registering a component takes more than pushing it into the exported layout.
// `loadQuartzConfig` calls `loadQuartzLayout()` itself and hands the result to
// a PageTypeDispatcher that closes over it, and `export const layout` below is
// a *second*, independent load -- so mutating that one changes nothing on the
// page. The dispatcher has to be rebuilt from the mutated layout, which is also
// what makes SiteNav.css reach component-*.css: getQuartzComponents() walks
// these same arrays.
//
// Every byPageType entry owns a distinct header array (buildLayoutForEntries
// builds one per page type), so each has to be visited; `defaults` is what a
// page type with no entry falls back to.
const navLayout = await loadQuartzLayout()
for (const slots of [navLayout.defaults, ...Object.values(navLayout.byPageType)]) {
  slots.header = [siteNav, ...(slots.header ?? [])]
}

// Splice first, then re-find: the splice above shifted every index after it.
const dispatcherIndex = config.plugins.emitters.findIndex(
  (emitter) => emitter.name === "PageTypeDispatcher",
)
if (dispatcherIndex === -1) {
  throw new Error("PageTypeDispatcher is missing; SiteNav has nothing to register against.")
}
config.plugins.emitters[dispatcherIndex] = PageTypeDispatcher({
  defaults: navLayout.defaults,
  byPageType: navLayout.byPageType,
})

export default config
export const layout = navLayout
