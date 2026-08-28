#!/bin/sh
# The staged tree must be derivable from the vault, and nothing private may
# survive into any public derivative (section 22.2).
#
# This is the most important check in the repo: it is the only thing standing
# between a private note and a public host. Quarto renders the vault in place
# now, so the boundary is the generated render allowlist rather than a staged
# copy -- which makes the leak surface *larger*, not smaller, and this check
# correspondingly more load-bearing.
set -eu
cd "$(dirname "$0")/.."

site="generated/site"
fixtures="generated/fixture-site"

test -d "$fixtures" || { echo "no fixture site; run npm run fixtures" >&2; exit 1; }

# 1. The allowlist is what Quarto renders, and it must never name a private
#    source. `_hidden/`, `*.hidden.*` and templates/ are the privacy boundary.
for profile in vault/_quarto-publish.yml vault/_quarto-fixtures.yml; do
  test -f "$profile" || continue
  ! grep -qE '_hidden|\.hidden\.|^\s+- "templates/' "$profile"
done

# 2. No private source may appear anywhere in a rendered tree, by name or by
#    content. Quarto copies listing contents and page resources into the output
#    on its own, so this is checked against the built site rather than inferred.
for tree in "$site" "$fixtures"; do
  test -d "$tree" || continue
  ! find "$tree" -path '*_hidden*' -print | grep -q .
  ! find "$tree" \( -name '*.hidden.*' -o -name 'tpl-*' \) -print | grep -q .
  # Raw sources are not deployable artifacts; a stray one means a listing or a
  # resource rule pulled a file in whole.
  ! find "$tree" \( -name '*.qmd' -o -name '*.md' \) -print | grep -q .
done

# 3. Fixtures build, and never reach the production tree. The separation rests
#    on one frontmatter flag, so it is checked from the outside.
test -f "$fixtures/examples/computational-features.html"
test -f "$fixtures/examples/interactive-features.html"
if [ -d "$site" ]; then
  ! test -e "$site/examples"
fi

# 4. Every published document has a page, and every page traces to a published
#    document. Prep asserts this during --require-quarto; re-checking it here
#    catches a tree that was edited after the fact.
node --experimental-strip-types --input-type=module -e '
  import { readFile, access } from "node:fs/promises"
  const map = JSON.parse(await readFile("generated/fixture-link-map.json", "utf8"))
  for (const document of map.documents) {
    await access(`generated/fixture-site/${document.slug}.html`)
  }
  console.log(`  ${map.documents.length} published document(s) have a rendered page`)
'

echo "publication prep: ok"
