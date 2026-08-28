#!/bin/sh
set -eu

source_qmd="vault/examples/computational-features.qmd"
stub_md="generated/fixture-content/examples/computational-features.md"
content_index="generated/fixture-site/static/contentIndex.json"

test -f "$source_qmd"
test -f "$stub_md"
test -f "$content_index"

grep -Fq 'quartoStub: true' "$stub_md"
grep -Fq 'sourcePath: "vault/examples/computational-features.qmd"' "$stub_md"
grep -Fq '## Python output' "$stub_md"
grep -Fq '## Static Matplotlib figure' "$stub_md"
# Prose links survive stub generation, rewritten to the resolved target that
# Quartz slugification understands.
grep -Fq '[Markdown Features](examples/markdown-features.md)' "$stub_md"
grep -Fq '[Interactive Features](examples/interactive-features.md)' "$stub_md"

if grep -Fq 'import pandas' "$stub_md" || grep -Fq 'sample_sizes = ' "$stub_md"; then
  printf '%s\n' 'Executable code leaked into the generated stub.' >&2
  exit 1
fi

# Include shortcodes must not survive into a stub. Quarto resolves `{{< include
# >}}` in a pre-engine pass the stub generator never runs, so a surviving
# shortcode reaches contentIndex.json and renders as literal text in search
# results, descriptions and popovers.
if grep -rlF '{{<' generated/fixture-content/; then
  printf '%s\n' 'A Quarto shortcode leaked into a generated stub.' >&2
  exit 1
fi

# The other half of that contract: the shortcode has to have actually resolved
# on the Quarto side rather than silently vanishing from both outputs.
# articles/signals-as-vectors.qmd includes _theme/_ojs-setup.qmd, so the three
# reactive values it defines must appear in the rendered artifact.
signals_html="generated/fixture-quarto/articles/signals-as-vectors.html"
test -f "$signals_html"
grep -Fq 'contentWidth' "$signals_html"
grep -Fq -e '--qmd-chart-ink' "$signals_html"

grep -Fq '"examples/computational-features"' "$content_index"
grep -Fq 'Python output' "$content_index"
grep -Fq 'Static Matplotlib figure' "$content_index"
grep -Fq '../examples/computational-features' generated/fixture-site/examples/index.html

printf '%s\n' 'QMD stub and Quartz index/backlink validation passed.'
