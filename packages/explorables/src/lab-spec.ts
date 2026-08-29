/**
 * The optional `static lab` block a widget declares to describe itself to the
 * playground (`just lab`).
 *
 * The harness can already discover a widget's reactive properties from Lit's
 * `elementProperties`, but a property declaration says a value is a Number, not
 * that it is an angle between -90 and 90. That is the only thing this adds —
 * and it doubles as documentation of the ranges the widget was designed for.
 *
 * Nothing imports this at runtime on the site; it exists for the lab, and for
 * anyone reading the component six months from now.
 */
export interface LabControl {
  min?: number
  max?: number
  step?: number
  /** Renders a <select> instead of a slider. */
  options?: readonly string[]
  label?: string
}

export interface LabSpec {
  /** One line on what the widget is for, shown above it in the lab. */
  about?: string
  /**
   * The static fallback the vault embeds as this widget's child. Paths resolve
   * against `vault/attachments/figs`, which the dev server mounts at its root.
   */
  fallback?: { src: string; alt: string }
  controls?: Record<string, LabControl>
}
