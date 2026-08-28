import { QuartzComponent, QuartzComponentConstructor } from "../quartz/components/types"
import { FullSlug, SimpleSlug } from "../quartz/util/path"
import { classNames, pathToRoot, resolveRelative, simplifySlug } from "@quartz-community/utils"

export interface SiteNavLink {
  label: string
  /** Vault-relative slug of the section's index, e.g. "knowledge/". */
  slug: string
}

export interface SiteNavOptions {
  /** Defaults to cfg.pageTitle, which is also the <title> and the OG title. */
  wordmark?: string
  links: SiteNavLink[]
}

/**
 * The site's wordmark and section links.
 *
 * It goes in the `header` slot, which DefaultFrame renders inside `.center` as
 * a child of the <header> element. That element's flex row is declared in
 * custom.scss rather than inherited from Header.css: the frame hardcodes the
 * <header> wrapper instead of placing it in a layout array, and
 * collectComponents only walks those arrays, so the wrapper's own stylesheet
 * never reaches the page. This component's does, because it *is* in an array.
 *
 * It replaces @quartz-community/page-title rather than sitting beside it --
 * both would render a wordmark. `flex: auto` here is what pushes the search and
 * dark-mode toolbar to the far end of the bar.
 */
export const SiteNav: QuartzComponentConstructor<SiteNavOptions> = (options) => {
  const links = options?.links ?? []

  const SiteNavComponent: QuartzComponent = ({ fileData, cfg }) => {
    const slug = fileData.slug!
    const wordmark = options?.wordmark ?? cfg.pageTitle
    // Section membership, not exact match: an article inside a section should
    // light that section up in the bar.
    const here = simplifySlug(slug)

    return (
      <div class="site-nav">
        <a class="site-nav-wordmark" href={pathToRoot(slug)}>
          {wordmark}
        </a>
        {links.length > 0 && (
          <nav class="site-nav-links" aria-label="Sections">
            {links.map(({ label, slug: target }) => {
              // simplifySlug strips the *leading* slash only, so "knowledge/"
              // and "knowledge/index" both simplify to "knowledge/" -- trailing
              // slash intact. Appending one here builds "knowledge//" and the
              // section index is the only page that ever matches.
              const section = simplifySlug(target as FullSlug)
              const prefix = section.endsWith("/") ? section : `${section}/`
              const active = here === prefix || here.startsWith(prefix)
              return (
                <a
                  class={classNames(undefined, "site-nav-link", active ? "active" : "")}
                  href={resolveRelative(slug, section as SimpleSlug)}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </a>
              )
            })}
          </nav>
        )}
      </div>
    )
  }

  SiteNavComponent.displayName = "SiteNav"
  SiteNavComponent.css = `
.site-nav {
  /* Fills the bar so the toolbar that follows it lands at the far end. */
  flex: auto;
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 2rem;
  min-width: 0;
}

.site-nav-wordmark {
  font-family: var(--headerFont);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--dark);
  background-image: none;
  white-space: nowrap;
}

.site-nav-links {
  display: flex;
  flex-direction: row;
  gap: 1.5rem;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.site-nav-links::-webkit-scrollbar {
  display: none;
}

.site-nav-link {
  color: var(--darkgray);
  background-image: none;
  white-space: nowrap;
  padding-bottom: 0.15rem;
  border-bottom: 2px solid transparent;
}

.site-nav-link:hover {
  color: var(--secondary);
}

.site-nav-link.active {
  color: var(--dark);
  border-bottom-color: var(--secondary);
}

@media all and (max-width: 800px) {
  .site-nav {
    gap: 1rem;
    /* The wordmark and the links stop fitting on one line well before the
       toolbar does, and the toolbar is what has to stay reachable. */
    flex-direction: column;
    align-items: flex-start;
  }

  .site-nav-links {
    gap: 1rem;
  }
}
`
  return SiteNavComponent
}
