# Experiment 2 results

Verified with Quarto 1.10.18 and Python 3.14.6 on 2026-08-23.

## Initial frozen render

- All four Python cells executed.
- Execution stamp: `2026-08-23T06:24:24.469760+00:00`.
- `_freeze/frozen-loop/execute-results/html.json` was created.

## Prose edit with freezer

After changing only narrative Markdown:

- `quarto render frozen-loop.qmd --use-freezer` kept the initial stamp;
- the output HTML also kept the initial prose;
- a global `quarto render` with `freeze: true` behaved the same way.

Conclusion: the freezer reuses engine-produced Markdown, not cell outputs independently from prose.

## Prose edit with no execution

`quarto render frozen-loop.qmd --no-execute` incorporated the current prose but omitted the execution stamp, table output, static figure output, and interactive figure output.

Conclusion: `--no-execute` is useful diagnostically but is not a complete computational-document preview.

## Prose edit with Jupyter Cache

After enabling `cache: true` and priming Jupyter Cache:

- priming execution stamp: `2026-08-23T06:28:22.548464+00:00`;
- a prose-only edit followed by an incremental file render reported `Notebook read from cache`;
- the resulting HTML contained the new prose;
- the execution stamp remained `2026-08-23T06:28:22.548464+00:00`;
- `_freeze/` was refreshed with the newly composed document.

Conclusion: combine Jupyter Cache for prose iteration with freeze for reproducible global builds.
