import { LitElement, html, svg, type PropertyValues, type TemplateResult } from "lit"
import katex from "katex"
import { customElement, property, state } from "lit/decorators.js"
import type { LabSpec } from "../lab-spec.ts"

/**
 * The change-of-basis figure from post 01, made draggable.
 *
 * The whole interaction is a 2x2 rotation — there was never any numpy in the
 * interactive path, which is the general shape of the argument this site makes:
 * check whether the interactive part is closed-form before reaching for a
 * runtime. Nothing here imports `src/dsp/`, because nothing here needs to.
 *
 * The matrix equation is typeset with KaTeX, and deliberately uses the same
 * LaTeX as `rotate_equation` in notebooks/01_signal_is_a_vector.py, so the
 * live widget and the notebook render the same expression.
 *
 * KaTeX's stylesheet is NOT imported here. Quartz's latex plugin already loads
 * katex@0.16.11's CSS on every page of the site, math or not, so importing it
 * again would ship a second copy. The dependency is pinned to that same version
 * for exactly this reason: the CSS on the page and the JS in this bundle have
 * to agree. The lab loads its own <link> for the same stylesheet.
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
.br-eq { max-width: 100%; overflow-x: auto; overflow-y: hidden; font-size: 0.95rem; }
.br-eq .katex-display { margin: 0; }
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

  /**
   * Describes this widget to `just lab`. Ranges are the ones the figure was
   * designed for: theta spans a quarter turn each way, and the vector stays
   * inside the 2.2-unit axes.
   */
  static lab: LabSpec = {
    about: "Change of basis as a 2x2 rotation. The vector never moves; the axes do.",
    fallback: {
      src: "/basis-rotation-30.svg",
      alt:
        "A vector measured against a standard basis in blue and a basis rotated 30 " +
        "degrees in red, with dashed lines dropping to each basis to show the two " +
        "sets of coordinates.",
    },
    controls: {
      theta: { min: -90, max: 90, step: 1, label: "theta (deg)" },
      vx: { min: -2, max: 2, step: 0.05 },
      vy: { min: -2, max: 2, step: 0.05 },
    },
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

  /**
   * `theta` is the starting angle; `live` is what the slider drives. Without
   * this, `theta` would be read once at connect and then ignored, so setting
   * the attribute from outside — the lab, or a post that re-renders the tag —
   * would silently do nothing. A declared reactive property should react.
   */
  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("theta")) this.live = this.theta
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

        <div class="br-eq" .innerHTML=${BasisRotation.equation(c, s, this.vx, this.vy, ax, ay)}></div>
      </figure>
    `
  }

  /**
   * The same equation `rotate_equation` typesets in the notebook: the vector is
   * one object, written in two bases. Colour matches the axes in the figure.
   *
   * Cached because a slider drag re-renders at 60 Hz and only two of the six
   * numbers actually change per frame; re-typesetting identical LaTeX is pure
   * waste. The key is the LaTeX itself, so correctness does not depend on
   * guessing which inputs matter.
   */
  private static eqCache = new Map<string, string>()

  private static equation(
    c: number,
    s: number,
    vx: number,
    vy: number,
    ax: number,
    ay: number,
  ): string {
    const f = (n: number): string => n.toFixed(2)
    // -0.00 reads as a typo rather than a number.
    const g = (n: number): string => f(Object.is(n, -0) || f(n) === "-0.00" ? 0 : n)

    const tex =
      String.raw`\textcolor{${STD}}{` +
      String.raw`\underbrace{\begin{bmatrix}1.00 & 0.00\\ 0.00 & 1.00\end{bmatrix}}_{[\,\hat{e}_1\ \hat{e}_2\,]}` +
      String.raw`\underbrace{\begin{bmatrix}${g(vx)}\\ ${g(vy)}\end{bmatrix}}_{\mathbf{x}}}` +
      String.raw`\;=\;` +
      String.raw`\textcolor{${ROT}}{` +
      String.raw`\underbrace{\begin{bmatrix}${g(c)} & ${g(-s)}\\ ${g(s)} & ${g(c)}\end{bmatrix}}_{[\,\hat{e}_1'\ \hat{e}_2'\,]}` +
      String.raw`\underbrace{\begin{bmatrix}${g(ax)}\\ ${g(ay)}\end{bmatrix}}_{\mathbf{x}'}}`

    const hit = BasisRotation.eqCache.get(tex)
    if (hit !== undefined) return hit

    const out = katex.renderToString(tex, {
      displayMode: true,
      throwOnError: false,
      // Default output, i.e. HTML *and* MathML. The MathML annotation is what a
      // screen reader reads; dropping it to save a few bytes would make the
      // equation announce as a run of loose digits.
    })
    // 181 distinct integer angles times a handful of vectors; bounded, but not
    // unbounded. Drop the oldest when it gets silly.
    if (BasisRotation.eqCache.size > 400) BasisRotation.eqCache.clear()
    BasisRotation.eqCache.set(tex, out)
    return out
  }
}
