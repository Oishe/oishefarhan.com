#!/usr/bin/env python3
"""Regenerate the Open Graph card at vault/assets/social-card.png.

The card is a committed PNG because that is what LinkedIn and Slack accept --
neither renders an SVG og:image -- but a committed binary with no source is a
thing nobody can edit later. This script is that source.

It lives outside vault/ on purpose. Quarto copies loose files from the project
directory into the output tree, and prepare-publication flags any .html in that
tree with no published document behind it, so a card template stored under
vault/ would fail the build it is meant to support.

    python3 scripts/social-card/build-card.py          # writes card.html
    # then shoot it at exactly 1200x630:
    npx playwright screenshot --viewport-size=1200,630 \
        scripts/social-card/card.html vault/assets/social-card.png

Edit the copy or the palette here, never the PNG.
"""

import math
import pathlib

# Palette, matching vault/_theme/tokens.yaml (Catppuccin Latte).
GROUND, INK, MUTED, ACCENT, GRAY = "#eff1f5", "#3c3f58", "#4c4f69", "#1a5ee0", "#6c7086"

NAME = "Oishe Farhan"
ROLE = "Data &amp; ML Platform Engineer &middot; Toronto"
DESC = ("Sensor ingest, warehouses shaped for model training, and the "
        "serving path from a model to a person.")
DOMAIN = "oishefarhan.com"

W, H = 1200, 300


def wave_path() -> str:
    """A small harmonic stack.

    Three sinusoids summed under a raised-sine envelope: the same "a signal is
    a sum of oscillating basis vectors" idea the featured article develops, so
    the ornament on the card is the subject of the site rather than decoration.
    """
    points = []
    for x in range(0, W + 1, 3):
        t = x / W
        y = (math.sin(2 * math.pi * 2.0 * t)
             + math.sin(2 * math.pi * 5.0 * t + 0.9) * 0.42
             + math.sin(2 * math.pi * 9.0 * t + 2.1) * 0.20)
        envelope = math.sin(math.pi * t) ** 0.6
        points.append((x, H / 2 - y * envelope * 72))
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in points)


FONTS = ("https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;600;700"
         "&family=Source+Sans+Pro:wght@400;600&family=IBM+Plex+Mono:wght@400&display=swap")

TEMPLATE = """<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{fonts}" rel="stylesheet">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ width: 1200px; height: 630px; background: {ground}; overflow: hidden;
         position: relative; font-family: "Source Sans Pro", system-ui, sans-serif; }}
  .wave {{ position: absolute; left: 0; right: 0; bottom: 0; height: 300px; opacity: .20; }}
  .inner {{ position: relative; padding: 82px 88px; height: 100%;
           display: flex; flex-direction: column; }}
  h1 {{ font-family: "Schibsted Grotesk", sans-serif; font-weight: 700; font-size: 92px;
       letter-spacing: -.025em; line-height: 1; color: {ink}; }}
  .role {{ font-family: "Schibsted Grotesk", sans-serif; font-weight: 600; font-size: 33px;
          color: {accent}; margin-top: 22px; }}
  .desc {{ font-size: 29px; line-height: 1.45; color: {muted}; margin-top: 26px; max-width: 830px; }}
  .foot {{ margin-top: auto; display: flex; align-items: center; gap: 16px; }}
  .mark {{ width: 44px; height: 44px; flex: none; }}
  .domain {{ font-family: "IBM Plex Mono", monospace; font-size: 25px; color: {gray}; }}
</style>
<svg class="wave" viewBox="0 0 1200 300" preserveAspectRatio="none">
  <path d="{wave}" fill="none" stroke="{accent}" stroke-width="3" stroke-linecap="round"/>
</svg>
<div class="inner">
  <h1>{name}</h1>
  <div class="role">{role}</div>
  <div class="desc">{desc}</div>
  <div class="foot">
    <svg class="mark" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="{accent}"/>
      <path d="M10 34 C 15 14, 21 14, 26 34 S 37 54, 42 34 S 51 20, 54 28"
            fill="none" stroke="#ffffff" stroke-width="7"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="domain">{domain}</span>
  </div>
</div>
"""

if __name__ == "__main__":
    out = pathlib.Path(__file__).parent / "card.html"
    out.write_text(TEMPLATE.format(
        fonts=FONTS, ground=GROUND, ink=INK, muted=MUTED, accent=ACCENT, gray=GRAY,
        wave=wave_path(), name=NAME, role=ROLE, desc=DESC, domain=DOMAIN,
    ))
    print(f"wrote {out}")
