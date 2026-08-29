# oishefarhan.com — prototype in Python, ship JavaScript.
#
# Four stages, and you rarely touch more than one:
#   1. WRITE      Obsidian, in vault/
#   2. PROTOTYPE  marimo, in notebooks/   →  `just figures`, then push
#   3. OPTIMIZE   only if a figure should move  →  `just lab`
#   4. PUBLISH    `just publish`
#
# See WORKFLOW.md.

explorables := "packages/explorables"
quartz      := "sites/quartz"
vault       := "vault"

# List all recipes.
default:
    @just --list

# --- stage 3: the dev loops ------------------------------------------------

# The widget playground. Vite prints a LAN URL — use it for phone QA.
lab:
    cd {{explorables}} && npm run lab

# Numerics in watch mode. Only needed when you hand-write a transform.
test:
    cd {{explorables}} && npm run test

# --- stage 2: prototype in Python ------------------------------------------

# A notebook's PEP 723 header is its dependency list, and `--sandbox` builds the
# kernel env from exactly that header — `uv run --isolated --no-project`, so
# .venv/ is never on its path. There is still no second place for a *notebook*
# dependency to drift out of; `just notebooks` and CI export from the same
# headers.
#
# .venv/ exists only to pin the marimo launcher via uv.lock, so every machine
# and CI drive the same marimo; see pyproject.toml. `uv run` syncs it on first
# use, so a fresh clone needs no setup step. Equivalent by hand:
#
#   uv run marimo edit --sandbox --no-token --watch ./notebooks/01_signal_is_a_vector.py
#
# --watch reloads the file when Obsidian or an agent rewrites it underneath you.
# --no-token drops the auth token, so the printed URL opens straight up.

# Open a notebook in marimo. The argument is a filename prefix: `just edit 02`.
edit nb:
    #!/usr/bin/env bash
    set -euo pipefail
    shopt -s nullglob
    matches=(notebooks/*{{nb}}*.py)
    if [ ${#matches[@]} -ne 1 ]; then
        printf 'need exactly one notebook matching %s, found %d:\n' '{{nb}}' "${#matches[@]}" >&2
        printf '  %s\n' "${matches[@]}" >&2
        exit 1
    fi
    exec uv run marimo edit --sandbox --no-token --watch "${matches[0]}"

# Notebook figures → vault/attachments/figs/*.svg. Byte-reproducible.
figures:
    uv run --script scripts/export_figures.py

# numpy/scipy parity fixtures. Only when porting numerics by hand.
fixtures:
    uv run --script scripts/export_fixtures.py

# Build the WASM notebook exports locally, as CI does. Debugging only.
notebooks:
    uv run --script scripts/build_notebooks.py

# --- the gate --------------------------------------------------------------

# Is it green? Pure Node — no uv, no numpy. Fixture drift is checked in CI.
check:
    cd {{explorables}} && npm run typecheck
    cd {{explorables}} && npm run test:run

# --- ship ------------------------------------------------------------------

# Bundle widgets and symlink local Quartz plugins. A fresh clone has no
# .quartz/, so install-plugins is not optional.
[private]
prep:
    cd {{explorables}} && npm run build
    cd {{quartz}} && npm run install-plugins

# Build the site into sites/quartz/public.
[private]
build: prep
    cd {{quartz}} && npx quartz build -d ../../{{vault}} -o public

# Build and serve exactly as deployed.
serve: prep
    cd {{quartz}} && npx quartz build -d ../../{{vault}} -o public --serve

# Check, build, deploy. Needs `wrangler login`.
publish: check build
    npx wrangler deploy
