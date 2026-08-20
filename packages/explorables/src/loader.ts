/**
 * The only globally-loaded script on the site. It must stay tiny (≤ 2 KB gz):
 * a post with no widgets should pay almost nothing for the possibility of one.
 *
 * Each widget lives behind a dynamic import, so its code is fetched only when
 * that widget is actually on the page and about to scroll into view.
 */

/** Tag name → the module that defines it. Add every widget here. */
const REGISTRY: Record<string, () => Promise<unknown>> = {
  // "basis-rotation": () => import("./components/basis-rotation.js"),
}

const TAGS = Object.keys(REGISTRY)

if (TAGS.length > 0) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        io.unobserve(entry.target)
        void REGISTRY[entry.target.tagName.toLowerCase()]?.()
      }
    },
    // Start fetching just before the widget reaches the viewport, so the
    // upgrade from static fallback to live element is invisible.
    { rootMargin: "200px" },
  )

  const observeAll = () => {
    for (const tag of TAGS) {
      for (const el of document.querySelectorAll(tag)) io.observe(el)
    }
  }

  observeAll()

  // Quartz navigates via SPA router by default; re-scan the new page's DOM.
  document.addEventListener("nav", observeAll)
}

export {}
