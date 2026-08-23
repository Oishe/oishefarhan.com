#!/bin/sh
set -eu

# Phase 9: the staged tree must be derivable from the vault, and nothing private
# may survive into any public derivative (section 22.2).

content="generated/quartz-content"
link_map="generated/link-map.json"
public="site/public"

node --experimental-strip-types --test scripts/prepare-publication.test.ts >/dev/null
node --experimental-strip-types scripts/prepare-publication.ts --require-quarto

test -f "$link_map"
test -f "$content/index.md"
test -f "$content/bibliography.bib"

# Every staged Markdown file is opt-in public.
missing_publish=$(grep -L '^publish: true$' $(find "$content" -name '*.md') || true)
if [ -n "$missing_publish" ]; then
  printf '%s\n' "Staged files without publish: true: $missing_publish" >&2
  exit 1
fi

# Stubs exist for the authoritative Quarto documents and carry bridge metadata.
for name in monte-carlo convergence-diagnostics interactive-ojs interactive-widgets; do
  grep -Fq 'quartoStub: true' "$content/research/$name.md"
  grep -Fq "sourcePath: \"vault/research/$name.qmd\"" "$content/research/$name.md"
  test -f "generated/quarto/research/$name.html"
done

# Only referenced attachments are staged.
test -f "$content/attachments/convergence.svg"
if [ -e "$content/attachments/unreferenced-sketch.svg" ]; then
  printf '%s\n' 'An unreferenced attachment reached the public tree.' >&2
  exit 1
fi

# Private notes leak into no derivative: staged tree, link map, or built site.
for canary in PRIVATE-MEASURE-THEORY-CANARY PRIVATE-MEETING-NOTES-CANARY; do
  for tree in "$content" "$link_map" "$public"; do
    if [ -e "$tree" ] && grep -rIFq "$canary" "$tree"; then
      printf '%s\n' "Private content leaked into $tree" >&2
      exit 1
    fi
  done
done

for slug in measure-theory meeting-notes; do
  if [ -e "$public" ] && grep -rIFq "$slug" "$public"; then
    printf '%s\n' "A private slug appears in the built site: $slug" >&2
    exit 1
  fi
done

# Canonical URLs in the link map match what the site emits.
if [ -d "$public" ]; then
  node --experimental-strip-types --input-type=module -e '
    import { readFile, access } from "node:fs/promises"
    const linkMap = JSON.parse(await readFile("generated/link-map.json", "utf8"))
    for (const document of linkMap.documents) {
      await access(`site/public/${document.slug}.html`)
    }
    for (const attachment of linkMap.attachments) {
      await access(`site/public${attachment.url}`)
    }
  '
fi

printf '%s\n' 'Publication prep validation passed.'
