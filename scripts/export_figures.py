# /// script
# requires-python = ">=3.12"
# dependencies = ["marimo", "matplotlib", "numpy"]
# ///
"""Render the figures for post 01 straight out of the marimo notebook.

The notebook is imported, not re-implemented: every `@app.function` in
`notebooks/` is a plain module-level callable, so one source produces both the
interactive prototype and the static SVG the site ships. That is what keeps the
`<basis-rotation>` fallback honest — it is the same function at the same default
angle the widget starts on.

Two post-processing steps matter:

* **Ink becomes `var(--ink)`.** matplotlib bakes a literal colour into every
  glyph and spine. A page with a dark mode needs those to move. Figures are
  drawn with a sentinel colour, which is then swapped for a CSS variable and a
  `prefers-color-scheme` block injected into the SVG. This works inside `<img>`,
  where an external stylesheet could never reach.
* **Output is byte-reproducible.** A fixed hashsalt and no date metadata, so
  regenerating an unchanged figure produces no diff.
"""

import importlib.util
import pathlib
import re
import sys

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "notebooks/01_signal_is_a_vector.py"
OUT = ROOT / "vault/attachments/figs"

# Never appears in the palette, so a blind string replace is safe.
INK = "#123456"

# Matches quartz.config.yaml's darkgray in each mode.
INK_STYLE = (
    "<style>"
    "svg{--ink:#4e4e4e}"
    "@media (prefers-color-scheme:dark){svg{--ink:#d4d4d4}}"
    "</style>"
)

# §8 budget. A figure over this is a figure that needs rethinking, not raising.
MAX_BYTES = 80 * 1024


def load_notebook(path: pathlib.Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[path.stem] = module
    spec.loader.exec_module(module)
    return module


def configure() -> None:
    plt.rcParams.update(
        {
            "text.color": INK,
            "axes.labelcolor": INK,
            "axes.edgecolor": INK,
            "axes.titlecolor": INK,
            "xtick.color": INK,
            "ytick.color": INK,
            "grid.color": INK,
            "figure.dpi": 100,
            # Stable element ids, so an unchanged figure regenerates byte-identically.
            "svg.hashsalt": "oishefarhan.com",
        }
    )


def recolor(svg: str) -> str:
    swapped = re.sub(re.escape(INK), "var(--ink)", svg, flags=re.IGNORECASE)
    # Inject the style block immediately after the opening <svg ...> tag.
    return re.sub(r"(<svg\b[^>]*>)", r"\1" + INK_STYLE, swapped, count=1)


def save(fig, slug: str) -> int:
    path = OUT / f"{slug}.svg"
    buffer = pathlib.Path(path)
    fig.savefig(path, format="svg", bbox_inches="tight", metadata={"Date": None})
    plt.close(fig)
    buffer.write_text(recolor(buffer.read_text()))
    return buffer.stat().st_size


def main() -> None:
    nb = load_notebook(NOTEBOOK)
    configure()
    OUT.mkdir(parents=True, exist_ok=True)

    n = 64
    x = nb.build_signal(n)

    figures = {
        "signal": lambda: nb.plot_signal(x, n),
        "signal-samples": lambda: nb.plot_signal_samples(x, n),
        # The default the widget boots on. Keep the two in step.
        "basis-rotation-30": lambda: nb.plot_rotate_coords(30),
        "basis-vectors": lambda: nb.plot_basis_vectors(n),
        "sum-of-waves": lambda: nb.plot_sum_equation(x, n),
        "matrix-equation": lambda: nb.plot_matrix_equation(x, n),
        "sparsity-three-bases": lambda: nb.plot_sparsity(x, n),
        "partial-sums": lambda: nb.plot_partial_sums(x, n),
        "keep-top": lambda: nb.plot_keep(x, n, "Fourier", 4),
    }

    over = []
    for slug, build in figures.items():
        size = save(build(), slug)
        flag = "" if size <= MAX_BYTES else "  ✗ over budget"
        if flag:
            over.append(slug)
        print(f"  {slug:24s} {size / 1024:7.1f} KB{flag}")

    print(f"wrote {len(figures)} figures to {OUT}")
    if over:
        raise SystemExit(f"over the {MAX_BYTES // 1024} KB SVG budget: {', '.join(over)}")


if __name__ == "__main__":
    main()
