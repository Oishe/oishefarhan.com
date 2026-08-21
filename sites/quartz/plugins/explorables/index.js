/**
 * Puts `loader.js` on every page — the one global script the site ships.
 *
 * The loader itself is inert until a registered custom element is near the
 * viewport, so a post with no widgets pays under a kilobyte and fetches nothing
 * further. That is why this is unconditional rather than per-page: deciding
 * which pages "have widgets" would mean parsing HTML for tag names to save
 * roughly nothing.
 *
 * `afterDOMReady` matters. Quartz's SPA router fires a `nav` event on every
 * page change, and loader.js listens for it to rescan; the script must be
 * attached before that can happen.
 *
 * Plain JavaScript on purpose: Quartz imports a local plugin's entry point
 * directly through Node, with no TypeScript step in between.
 */

export const manifest = {
  name: "explorables",
  displayName: "Explorables",
  description: "Lazy-loads interactive widget bundles from /static/explorables/.",
  version: "1.0.0",
  category: "transformer",
  quartzVersion: ">=5.0.0",
}

export default function Explorables() {
  return {
    name: "Explorables",
    // Defer every image below the first one. A post here is mostly figures, and
    // markdown has no syntax for `loading`; doing it in the pipeline keeps the
    // vault as plain `![alt](path)` that Obsidian renders natively.
    //
    // This hook is also load-bearing for a second reason: Quartz validates a
    // transformer by looking for textTransform / markdownPlugins / htmlPlugins
    // and silently skips the plugin if none is present. `externalResources`
    // alone does not qualify.
    htmlPlugins: () => [
      () => (tree) => {
        let seen = 0
        const walk = (node) => {
          if (node.type === "element" && node.tagName === "img") {
            seen += 1
            node.properties = node.properties ?? {}
            node.properties.decoding = "async"
            // The first image is the likely LCP element; deferring it would
            // make the metric worse, not better.
            if (seen > 1 && node.properties.loading === undefined) {
              node.properties.loading = "lazy"
            }
          }
          for (const child of node.children ?? []) walk(child)
        }
        walk(tree)
      },
    ],
    externalResources: () => ({
      js: [
        {
          src: "/static/explorables/loader.js",
          loadTime: "afterDOMReady",
          moduleType: "module",
          contentType: "external",
        },
      ],
    }),
  }
}
