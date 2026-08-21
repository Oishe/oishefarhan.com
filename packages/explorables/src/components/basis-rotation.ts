import { LitElement, html, svg, nothing, type TemplateResult } from "lit"
import { customElement, property, state } from "lit/decorators.js"

/**
 * The change-of-basis figure from post 01, made draggable.
 *
 * The whole interaction is a 2x2 rotation — there was never any numpy in the
 * interactive path, which is the general shape of the argument this site makes:
 * check whether the interactive part is closed-form before reaching for a
 * runtime. Nothing here imports `src/dsp/`, because nothing here needs to.
 *
 * The matrix equation is drawn with CSS rather than typeset with KaTeX. KaTeX is
 * ~78 KB gzipped, which would be eight times the rest of this widget and blow
 * §11's per-post JS budget on its own, to typeset eight numbers that change and
 * a structure that never does.
 */

const SCALE = 60 // px per unit
const ORIGIN = 160 // px, centre of a 320x320 viewBox
const REACH = 2.2 // how far the axes run, in units

const STD = "#2f7ff0"
const ROT = "#e0483d"
const MUTED = "#8a8f98"

const STYLE_ID = "explorables-basis-rotation"

/**
 * Light DOM means no `static styles`, so the sheet goes in once per document
 * and every instance shares it. Class-prefixed, since it is not scoped.
 */
const SHEET = `
.br { margin: 1.5rem 0; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.br-svg { width: 100%; max-width: 22rem; height: auto; touch-action: manipulation; }
.br-control { display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 0.5rem 0.75rem; width: 100%; max-width: 26rem; font-size: 0.9rem; }
.br-control input[type="range"] { flex: 1 1 12rem; min-width: 8rem; accent-color: ${ROT}; }
.br-control output { font-variant-numeric: tabular-nums; min-width: 3.5em; text-align: right; }
.br-eq { display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 0.35rem; font-size: 0.85rem; line-height: 1.15; }
.br-term { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
.br-mat { position: relative; display: grid; grid-template-rows: repeat(2, 1fr);
  grid-auto-flow: column; gap: 0.1em 0.5em; padding: 0.2em 0.5em;
  font-variant-numeric: tabular-nums; }
.br-mat > span { text-align: right; }
.br-mat::before, .br-mat::after { content: ""; position: absolute; top: 0; bottom: 0;
  width: 0.28em; border: 1.5px solid currentColor; }
.br-mat::before { left: 0; border-right: 0; }
.br-mat::after { right: 0; border-left: 0; }
.br-label { font-size: 0.75rem; opacity: 0.75; }
.br-std { color: ${STD}; }
.br-rot { color: ${ROT}; }
@media (prefers-reduced-motion: no-preference) { .br-svg line, .br-svg text { transition: none; } }
`

function installSheet(): void {
  const root = globalThis.document
  if (!root || root.getElementById(STYLE_ID)) return
  const el = root.createElement("style")
  el.id = STYLE_ID
  el.textContent = SHEET
  root.head.appendChild(el)
}

@customElement("basis-rotation")
export class BasisRotation extends LitElement {
  // Light DOM, not shadow DOM: Quartz's typography and the page's own colour
  // variables both need to reach inside. Scoped by the `br-` prefix instead.
  protected override createRenderRoot(): HTMLElement {
    return this
  }

  @property({ type: Number }) vx = 1.0
  @property({ type: Number }) vy = 1.6
  @property({ type: Number }) theta = 30

  @state() private live = 30
  /** Seeded from the fallback image's alt text, so one string serves both. */
  @state() private description = ""

  private frame = 0
  private pending: number | null = null

  override connectedCallback(): void {
    super.connectedCallback()
    installSheet()
    this.live = this.theta

    // Take the alt text before Lit's first render, then clear the fallback:
    // lit-html appends to a light-DOM container rather than replacing what is
    // already there, so the static figure would otherwise stay on the page.
    const fallback = this.querySelector("img")
    if (fallback) this.description = fallback.getAttribute("alt") ?? ""
    this.replaceChildren()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    if (this.frame) cancelAnimationFrame(this.frame)
    this.frame = 0
  }

  /** Coalesce a burst of `input` events into one repaint per frame. */
  private onInput = (event: Event): void => {
    this.pending = Number((event.target as HTMLInputElement).value)
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      if (this.pending !== null) this.live = this.pending
    })
  }

  private static px(a: number): number {
    return ORIGIN + a * SCALE
  }

  private static py(b: number): number {
    return ORIGIN - b * SCALE
  }

  /** An axis: an arrow out to `REACH`, plus its faint negative half. */
  private axis(ux: number, uy: number, color: string, label: string): TemplateResult {
    const { px, py } = BasisRotation
    return svg`
      <line x1=${ORIGIN} y1=${ORIGIN} x2=${px(ux * REACH)} y2=${py(uy * REACH)}
            stroke=${color} stroke-width="1.6" marker-end="url(#br-tip-${color.slice(1)})"/>
      <line x1=${ORIGIN} y1=${ORIGIN} x2=${px(-ux * REACH)} y2=${py(-uy * REACH)}
            stroke=${color} stroke-width="0.8" opacity="0.4"/>
      <text x=${px(ux * REACH * 1.08)} y=${py(uy * REACH * 1.08)} fill=${color}
            font-size="13" text-anchor="middle" dominant-baseline="middle">${label}</text>
    `
  }

  override render(): TemplateResult {
    const { px, py } = BasisRotation
    const rad = (this.live * Math.PI) / 180
    const c = Math.cos(rad)
    const s = Math.sin(rad)

    // x' = B^T v, with B the rotation whose columns are the new basis vectors.
    const ax = c * this.vx + s * this.vy
    const ay = -s * this.vx + c * this.vy

    // Where each rotated coordinate lands along its own axis.
    const foot1 = [ax * c, ax * s]
    const foot2 = [ay * -s, ay * c]

    const drop = (tx: number, ty: number, color: string) => svg`
      <line x1=${px(this.vx)} y1=${py(this.vy)} x2=${px(tx)} y2=${py(ty)}
            stroke=${color} stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
    `

    const label = this.description
      ? `${this.description} Basis currently rotated ${this.live.toFixed(0)} degrees.`
      : `A vector at ${this.vx} and ${this.vy}, measured against a standard basis and a basis rotated ${this.live.toFixed(0)} degrees.`

    return html`
      <figure class="br">
        <svg class="br-svg" viewBox="0 0 320 320" role="img" aria-label=${label}>
          <defs>
            ${[STD, ROT].map(
              (color) => svg`
              <marker id="br-tip-${color.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5"
                      markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill=${color}/>
              </marker>`,
            )}
            <marker id="br-tip-vec" viewBox="0 0 10 10" refX="9" refY="5"
                    markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>
            </marker>
          </defs>

          <line x1=${px(-REACH)} y1=${ORIGIN} x2=${px(REACH)} y2=${ORIGIN}
                stroke=${MUTED} stroke-width="0.5" opacity="0.3"/>
          <line x1=${ORIGIN} y1=${py(-REACH)} x2=${ORIGIN} y2=${py(REACH)}
                stroke=${MUTED} stroke-width="0.5" opacity="0.3"/>

          ${this.axis(1, 0, STD, "ê₁")} ${this.axis(0, 1, STD, "ê₂")}
          ${this.axis(c, s, ROT, "ê₁′")} ${this.axis(-s, c, ROT, "ê₂′")}

          ${drop(this.vx, 0, STD)} ${drop(0, this.vy, STD)}
          ${drop(foot1[0], foot1[1], ROT)} ${drop(foot2[0], foot2[1], ROT)}

          <line x1=${ORIGIN} y1=${ORIGIN} x2=${px(this.vx)} y2=${py(this.vy)}
                stroke="currentColor" stroke-width="2.6" marker-end="url(#br-tip-vec)"/>
          <text x=${px(this.vx) + 10} y=${py(this.vy) - 8} fill="currentColor"
                font-size="14" font-weight="600">V</text>
        </svg>

        <label class="br-control">
          <span>rotate the basis θ</span>
          <input type="range" min="-90" max="90" step="1" .value=${String(this.live)}
                 aria-label="rotate the basis, degrees" @input=${this.onInput}>
          <output>${this.live.toFixed(0)}°</output>
        </label>

        <div class="br-eq">
          ${this.term(["1.00", "0.00", "0.00", "1.00"], "[ê₁ ê₂]", "br-std")}
          ${this.term([this.vx.toFixed(2), this.vy.toFixed(2)], "x", "br-std")}
          <span>=</span>
          ${this.term(
            [c.toFixed(2), s.toFixed(2), (-s).toFixed(2), c.toFixed(2)],
            "[ê₁′ ê₂′]",
            "br-rot",
          )}
          ${this.term([ax.toFixed(2), ay.toFixed(2)], "x′", "br-rot")}
        </div>
      </figure>
    `
  }

  /** One bracketed matrix with its caption. Values are column-major. */
  private term(values: string[], caption: string, tone: string): TemplateResult {
    return html`
      <span class="br-term ${tone}">
        <span class="br-mat">${values.map((v) => html`<span>${v}</span>`)}</span>
        <span class="br-label">${caption}</span>
      </span>
      ${nothing}
    `
  }
}
