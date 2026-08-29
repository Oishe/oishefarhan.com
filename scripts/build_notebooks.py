# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Export every notebook to a self-contained WASM app in `notebooks-dist/`.

This is the whole build for notebooks.oishefarhan.com. Both `just notebooks`
and .github/workflows/deploy-notebooks.yml call it, so there is exactly one
implementation of the export.

Why a separate origin at all: the site's rule is that oishefarhan.com never
ships a language runtime. It still doesn't. These exports fetch Pyodide from
jsdelivr at runtime and live on their own subdomain, one click from a post,
so a reader who wants the Python opts in and a reader who doesn't pays nothing.
"""

import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
NOTEBOOKS = ROOT / "notebooks"
OUT = ROOT / "notebooks-dist"

# Content-hashed by marimo's bundler, so `immutable` is safe. index.html embeds
# the notebook source and must never go stale.
#
# Deliberately no COOP/COEP. marimo runs fine without cross-origin isolation —
# the GitHub Pages deploy proves it, since Pages cannot set those headers at
# all. If you ever want SharedArrayBuffer, use `credentialless`, NOT
# `require-corp`: the latter blocks the Pyodide fetch from cdn.jsdelivr.net.
HEADERS = """\
/*/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
"""

INDEX = """\
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Notebooks — Oishe Farhan</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{
    font: 1rem/1.6 system-ui, sans-serif;
    max-width: 34rem; margin: 4rem auto; padding: 0 1.25rem;
  }}
  h1 {{ font-size: 1.4rem; }}
  li {{ margin: .4rem 0; }}
  .note {{ opacity: .7; font-size: .9rem; }}
</style>
</head>
<body>
  <h1>Notebooks</h1>
  <p>Live Python, running in your browser. Each one boots a real interpreter,
     so give it a few seconds.</p>
  <ul>
{items}
  </ul>
  <p class="note">The written versions, which load instantly and run no Python,
     are at <a href="https://oishefarhan.com">oishefarhan.com</a>.</p>
</body>
</html>
"""


def title_of(stem: str) -> str:
    """`01_signal_is_a_vector` -> `Signal is a vector`."""
    _, _, rest = stem.partition("_")
    words = (rest or stem).replace("_", " ")
    return words[:1].upper() + words[1:]


def main() -> int:
    notebooks = sorted(NOTEBOOKS.glob("*.py"))
    if not notebooks:
        print(f"no notebooks found under {NOTEBOOKS}", file=sys.stderr)
        return 1

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    for nb in notebooks:
        dest = OUT / nb.stem
        print(f"  exporting {nb.name}")
        # uvx, not the repo's pinned marimo: `--sandbox` makes marimo re-exec
        # itself into `uv run --isolated --no-project` built from the notebook's
        # PEP 723 header, so the launcher is thrown away and only the header's
        # marimo shapes the export. This workflow therefore needs no `uv sync`.
        subprocess.run(
            [
                "uvx", "marimo", "export", "html-wasm", "--sandbox", str(nb),
                "-o", str(dest),
                # `run` hides the editor chrome; `--show-code` is the point of
                # this host, which exists to show the Python. The fast
                # interactive version is the widget in the post.
                "--mode", "run", "--show-code",
            ],
            check=True,
        )
        if not (dest / "index.html").is_file():
            print(f"export produced no index.html for {nb.name}", file=sys.stderr)
            return 1
        # marimo bundles its own ~10 KB agent prompt into every export.
        (dest / "CLAUDE.md").unlink(missing_ok=True)

    (OUT / "_headers").write_text(HEADERS)

    items = "\n".join(
        f'    <li><a href="./{nb.stem}/">{title_of(nb.stem)}</a></li>'
        for nb in notebooks
    )
    (OUT / "index.html").write_text(INDEX.format(items=items))

    files = sum(1 for p in OUT.rglob("*") if p.is_file())
    largest = max((p.stat().st_size, p) for p in OUT.rglob("*") if p.is_file())
    total = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())

    # Cloudflare Workers static assets: 20,000 files and 25 MiB per file on the
    # free plan. Fail loudly here rather than at deploy time.
    print(f"\n  files   {files:,} / 20,000")
    print(f"  largest {largest[0] / 2**20:.2f} MiB / 25 MiB  ({largest[1].name})")
    print(f"  total   {total / 2**20:.1f} MiB on disk "
          f"(Cloudflare dedups by content hash, so the upload is far smaller)")

    if files > 20_000:
        print("\nover the 20,000-file limit", file=sys.stderr)
        return 1
    if largest[0] > 25 * 2**20:
        print(f"\n{largest[1]} exceeds the 25 MiB per-file limit", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
