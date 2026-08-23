# Experiment 2: Frozen Prose Loop

This fixture tests Quarto's frozen and cached computation paths with prose, LaTeX, Python, a table, a static Matplotlib figure, and an interactive Plotly figure.

```bash
cd experiments/quarto-frozen-prose-loop
UV_CACHE_DIR=/private/tmp/knowledge-uv-cache uv sync
UV_CACHE_DIR=/private/tmp/knowledge-uv-cache uv run quarto render frozen-loop.qmd
```

The execution-stamp cell provides direct evidence of whether Python reran. `_freeze/` is intentionally not ignored because the frozen computation artifact is part of the experiment.

The verified prose loop is an ordinary incremental file render with `execute.cache: true`. `--use-freezer` is inappropriate for this loop because it restores the old frozen prose as well as the old computation. `--no-execute` updates prose but omits prior outputs.

Run the output validator from the repository root:

```bash
./scripts/validate-frozen-prose-render.sh
```
