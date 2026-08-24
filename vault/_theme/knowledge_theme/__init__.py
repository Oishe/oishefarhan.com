"""Shared visual language for computational figures in this vault.

Every published document is rendered once by Quarto and then served under two
page themes (light and dark) by the Quartz site that wraps it. A figure
produced by matplotlib or Plotly does not get a second render pass per theme —
it is baked once, as a raster or as embedded JSON, so it has to be legible
against both page backgrounds simultaneously rather than switching with them.

`vault/_theme/tokens.yaml` is the single place that visual language is decided, and
`scripts/generate-design-tokens.ts` projects it into the two files this
package ships alongside its code: `tokens.json` (the whole token tree) and
`knowledge.mplstyle` (a matplotlib style sheet). Neither generated file is
edited by hand — this package only reads them.

Call `apply()` once, early in a document's setup cell, to make both plotting
libraries draw from those tokens instead of their own defaults. It is safe to
call more than once (applying a style sheet or re-registering a template is
idempotent), and safe to call in an environment that has only one of the two
libraries installed.
"""

from __future__ import annotations

import json
from functools import lru_cache
from importlib import resources
from typing import Any


@lru_cache(maxsize=1)
def tokens() -> dict[str, Any]:
    """Return the parsed token tree from the packaged `tokens.json`.

    Cached because the file never changes within a process: it is a build
    artefact regenerated ahead of time by `npm run design-tokens`, not
    something a running document mutates.
    """
    data = resources.files(__package__).joinpath("tokens.json").read_text(encoding="utf-8")
    return json.loads(data)


def series(n: int) -> str:
    """Return the nth colour (0-indexed) of the shared categorical palette.

    Wraps rather than raising past the end of the palette, since a document
    author picking series by index for an ad hoc plot should not have to
    know the palette's length or guard against overrunning it.
    """
    colours = tokens()["chart"]["series"]
    return colours[n % len(colours)]


def _apply_matplotlib() -> None:
    # Imported lazily so a document that only uses Observable Plot or Plotly
    # never pays for, or fails on, a matplotlib import.
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        return

    style_path = resources.files(__package__).joinpath("knowledge.mplstyle")
    with resources.as_file(style_path) as path:
        plt.style.use(str(path))


def _apply_plotly() -> None:
    try:
        import plotly.graph_objects as go
        import plotly.io as pio
    except ImportError:
        return

    chart = tokens()["chart"]
    typography = tokens()["typography"]
    ink = chart["ink"]
    grid_rgba = _hex_to_rgba(ink, chart["gridAlpha"])

    axis_common = dict(
        gridcolor=grid_rgba,
        zerolinecolor=grid_rgba,
        linecolor=ink,
        tickcolor=ink,
        tickfont=dict(color=ink),
        title=dict(font=dict(color=ink)),
    )

    template = go.layout.Template(
        layout=go.Layout(
            # Plotly's default template bakes an opaque white paper and an
            # #E5ECF6 plot background into the figure JSON. That is invisible
            # against a light page but wrong against a dark one, so both
            # surfaces are made fully transparent and left to the page behind
            # them.
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            colorway=chart["series"],
            font=dict(
                family=f"{typography['body']}, sans-serif",
                size=chart["fontSize"],
                color=ink,
            ),
            xaxis=axis_common,
            yaxis=axis_common,
            legend=dict(bgcolor="rgba(0,0,0,0)"),
        )
    )

    pio.templates["knowledge"] = template
    pio.templates.default = "knowledge"


def _hex_to_rgba(hex_colour: str, alpha: float) -> str:
    """Turn `#rrggbb` plus an alpha into the `rgba(...)` string Plotly wants.

    Plotly layout colours take CSS-style strings, not a separate opacity
    channel, so the token's `gridAlpha` has to be folded into the string here
    rather than passed alongside the colour.
    """
    hex_colour = hex_colour.lstrip("#")
    r = int(hex_colour[0:2], 16)
    g = int(hex_colour[2:4], 16)
    b = int(hex_colour[4:6], 16)
    return f"rgba({r}, {g}, {b}, {alpha})"


def apply() -> None:
    """Apply the shared visual language to every plotting library present.

    Idempotent: re-running `matplotlib.pyplot.style.use()` on the same sheet,
    or re-registering the same Plotly template and re-setting it as the
    default, leaves both libraries in the same state as a single call would.
    Safe to call from every document's setup cell regardless of which
    libraries that document actually uses.
    """
    _apply_matplotlib()
    _apply_plotly()
