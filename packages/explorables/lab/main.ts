/**
 * The playground. `just lab`, then edit a component and watch it update.
 *
 * This is the marimo replacement, and the thing it replaces is marimo's control
 * panel: every widget under `src/components/` is discovered automatically, and
 * a control is generated for each of its reactive properties. Adding a widget
 * to the lab takes zero files and zero registration — write the component and
 * it appears here.
 *
 * Discovery is by filename, which is already the convention: the module
 * `src/components/basis-rotation.ts` defines `<basis-rotation>`, exactly as
 * `loader.ts` assumes.
 */
import type { LabControl, LabSpec } from "../src/lab-spec.ts"

type PropDecl = { type?: unknown; state?: boolean }
type WidgetCtor = {
  elementProperties?: Map<PropertyKey, PropDecl>
  lab?: LabSpec
}

const modules = import.meta.glob("../src/components/*.ts") as Record<
  string,
  () => Promise<unknown>
>

const TAGS = Object.keys(modules)
  .map((path) => ({ path, tag: path.split("/").pop()!.replace(/\.ts$/, "") }))
  .sort((a, b) => a.tag.localeCompare(b.tag))

const $ = <T extends HTMLElement>(sel: string): T =>
  document.querySelector<T>(sel)!

const nav = $<HTMLElement>("#nav")
const stage = $<HTMLElement>("#stage")

/* ---------- URL state: #basis-rotation?theta=45 --------------------------- */

function readHash(): { tag: string; params: URLSearchParams } {
  const raw = location.hash.replace(/^#/, "")
  const [tag, query = ""] = raw.split("?")
  return { tag: tag || TAGS[0]?.tag || "", params: new URLSearchParams(query) }
}

function writeHash(tag: string, values: Record<string, unknown>): void {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(values)) params.set(k, String(v))
  const query = params.toString()
  // replaceState, not location.hash: a slider drag should not fill the
  // browser's back stack with one entry per frame.
  history.replaceState(null, "", `#${tag}${query ? `?${query}` : ""}`)
}

/* ---------- control generation -------------------------------------------- */

function controlFor(
  name: string,
  decl: PropDecl,
  spec: LabControl | undefined,
  initial: unknown,
  onChange: (value: unknown) => void,
): HTMLElement {
  const row = document.createElement("label")
  row.className = "ctl"

  const title = document.createElement("span")
  title.className = "ctl-name"
  title.textContent = spec?.label ?? name
  row.append(title)

  if (spec?.options) {
    const select = document.createElement("select")
    for (const option of spec.options) {
      const el = document.createElement("option")
      el.value = el.textContent = option
      select.append(el)
    }
    select.value = String(initial)
    select.addEventListener("change", () => onChange(select.value))
    row.append(select)
    return row
  }

  if (decl.type === Boolean) {
    const box = document.createElement("input")
    box.type = "checkbox"
    box.checked = Boolean(initial)
    box.addEventListener("change", () => onChange(box.checked))
    row.append(box)
    return row
  }

  if (decl.type === Number) {
    const value = Number(initial)
    // A property with no declared bounds still gets a usable slider: span an
    // order of magnitude around wherever it starts.
    const span = Math.max(1, Math.abs(value) * 2)
    const input = document.createElement("input")
    input.type = "range"
    input.min = String(spec?.min ?? -span)
    input.max = String(spec?.max ?? span)
    input.step = String(spec?.step ?? 0.1)
    input.value = String(value)

    const readout = document.createElement("output")
    readout.textContent = input.value

    input.addEventListener("input", () => {
      readout.textContent = input.value
      onChange(Number(input.value))
    })
    row.append(input, readout)
    return row
  }

  const text = document.createElement("input")
  text.type = "text"
  text.value = String(initial ?? "")
  text.addEventListener("input", () => onChange(text.value))
  row.append(text)
  return row
}

/* ---------- rendering ------------------------------------------------------ */

function fallbackImage(spec: LabSpec | undefined): HTMLImageElement | null {
  if (!spec?.fallback) return null
  const img = document.createElement("img")
  img.src = spec.fallback.src
  img.alt = spec.fallback.alt
  return img
}

async function show(tag: string, params: URLSearchParams): Promise<void> {
  const entry = TAGS.find((t) => t.tag === tag) ?? TAGS[0]
  if (!entry) {
    stage.innerHTML = `<p class="empty">No components under <code>src/components/</code> yet.</p>`
    return
  }

  for (const link of nav.querySelectorAll("a")) {
    link.classList.toggle("on", link.dataset.tag === entry.tag)
  }

  await modules[entry.path]!()
  const ctor = customElements.get(entry.tag) as unknown as WidgetCtor | undefined
  if (!ctor) {
    stage.innerHTML =
      `<p class="empty">Module <code>${entry.path}</code> did not define ` +
      `<code>&lt;${entry.tag}&gt;</code>. The lab discovers widgets by filename, ` +
      `so the file name and the tag name have to match.</p>`
    return
  }

  const spec = ctor.lab
  const declared = [...(ctor.elementProperties ?? new Map())]
    // @state() is internal, not part of the widget's public surface.
    .filter(([, decl]) => !decl.state)

  stage.replaceChildren()

  const header = document.createElement("header")
  header.innerHTML = `<h1><code>&lt;${entry.tag}&gt;</code></h1>`
  if (spec?.about) {
    const p = document.createElement("p")
    p.className = "about"
    p.textContent = spec.about
    header.append(p)
  }
  stage.append(header)

  // The element gets its starting attributes from the URL, so a state you
  // stumble into is a state you can link to.
  const el = document.createElement(entry.tag)
  const values: Record<string, unknown> = {}
  for (const [key, decl] of declared) {
    const name = String(key)
    const fromUrl = params.get(name)
    const fallbackValue = (ctor as unknown as Record<string, unknown>)[name]
    const initial =
      fromUrl !== null
        ? decl.type === Number
          ? Number(fromUrl)
          : decl.type === Boolean
            ? fromUrl === "true"
            : fromUrl
        : ((el as unknown as Record<string, unknown>)[name] ?? fallbackValue)
    values[name] = initial
    el.setAttribute(name, String(initial))
  }

  // The static fallback is a hard requirement of the embed contract, so the lab
  // ships it too — the widget clears it on upgrade, exactly as on the site.
  const img = fallbackImage(spec)
  if (img) el.append(img)

  const frame = document.createElement("div")
  frame.className = "frame"
  frame.append(el)
  stage.append(frame)

  const panel = document.createElement("div")
  panel.className = "panel"
  for (const [key, decl] of declared) {
    const name = String(key)
    panel.append(
      controlFor(name, decl, spec?.controls?.[name], values[name], (value) => {
        values[name] = value
        el.setAttribute(name, String(value))
        writeHash(entry.tag, values)
      }),
    )
  }
  if (!declared.length) {
    const none = document.createElement("p")
    none.className = "empty"
    none.textContent = "This widget declares no public properties."
    panel.append(none)
  }
  stage.append(panel)

  if (spec?.fallback) {
    const details = document.createElement("details")
    details.className = "fallback"
    details.innerHTML = `<summary>Static fallback — what Obsidian, RSS and no-JS readers get</summary>`
    const shown = fallbackImage(spec)!
    details.append(shown)
    const alt = document.createElement("p")
    alt.className = "alt"
    alt.textContent = shown.alt || "(no alt text — the embed contract requires one)"
    details.append(alt)
    stage.append(details)
  }

  writeHash(entry.tag, values)
}

/* ---------- boot ----------------------------------------------------------- */

for (const { tag } of TAGS) {
  const link = document.createElement("a")
  link.href = `#${tag}`
  link.dataset.tag = tag
  link.textContent = tag
  nav.append(link)
}

addEventListener("hashchange", () => {
  const { tag, params } = readHash()
  void show(tag, params)
})

const initial = readHash()
void show(initial.tag, initial.params)
