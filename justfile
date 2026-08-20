# oishefarhan.com — prototype in Python, ship JavaScript.
# Nothing in here should ever put a language runtime in front of a reader.

explorables := "packages/explorables"
quartz      := "sites/quartz"
vault       := "vault"

# List all recipes.
default:
    @just --list

# --- dev loops (§6) -------------------------------------------------------

# Loop B (visuals) — Vite dev server over the widget lab, LAN-visible for phone QA.
lab:
    cd {{explorables}} && npm run lab

# Loop A (numerics) — Vitest in watch mode against the numpy/scipy fixtures.
test:
    cd {{explorables}} && npm run test

# --- build ----------------------------------------------------------------

# Bundle the widgets into Quartz's static tree.
widgets:
    cd {{explorables}} && npm run build

# Full site build. Output lands in sites/quartz/public.
site: widgets
    cd {{quartz}} && npx quartz build -d ../../{{vault}} -o public

# Build and serve locally exactly as deployed.
serve: widgets
    cd {{quartz}} && npx quartz build -d ../../{{vault}} -o public --serve

# --- generated inputs -----------------------------------------------------

# Regenerate the numpy/scipy parity fixtures (§5).
fixtures:
    uv run scripts/export_fixtures.py

# Rebuild any figure whose source is newer than its output (§8).
figures:
    make -f figures.mk

# --- gates ----------------------------------------------------------------

# Everything CI runs — the single source of truth for "is it green".
check:
    cd {{explorables}} && npm run typecheck
    cd {{explorables}} && npm run test:run
    just fixture-drift

# Fail if committed fixtures no longer match what Python produces.
fixture-drift:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! command -v uv >/dev/null; then echo "uv not installed, skipping"; exit 0; fi
    just fixtures
    if ! git diff --quiet -- {{explorables}}/test/fixtures; then
        echo "✗ fixtures drifted from the Python reference:"
        git --no-pager diff --stat -- {{explorables}}/test/fixtures
        exit 1
    fi
    echo "✓ fixtures match the Python reference"
