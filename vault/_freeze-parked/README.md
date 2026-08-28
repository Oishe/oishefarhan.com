# Parked frozen output

Frozen Quarto results for documents that are currently `publish: false`.

`scripts/prepare-publication.ts` rejects a tree under `vault/_freeze/` whose owning document is
not published — a frozen result can embed output derived from private data, so a stale one is
treated as a leak rather than a cache. Deleting the tree satisfies that check but throws away the
render, and re-publishing then costs a full Python execution.

Parking is the middle path. Prep never walks this directory: `collectFiles` skips any directory
whose name starts with `_`, and the freeze check reads `vault/_freeze/` alone. The frozen output
stays in version control, so bringing a document back is a directory move rather than a re-render.

```bash
# park:    publish: false, then
mv vault/_freeze/<section> vault/_freeze-parked/<section>

# restore: publish: true, then
mv vault/_freeze-parked/<section> vault/_freeze/<section>
```

Currently parked: `examples/` — the four example `.qmd` fixtures, set aside so the build renders
only `knowledge/signals-as-vectors.qmd` during the site design work.
