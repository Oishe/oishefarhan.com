# Quartz upstream pin

This spike was copied from the official Quartz repository without its Git metadata.

- Branch: `v5`
- Commit: `075afd3f712da0088a07f5284a7b3aba37dd61b6`
- Quartz package version: `5.0.0`
- Retrieved: `2026-08-23`

The exact npm dependency graph is pinned by `package-lock.json`. The default Quartz plugins used by the Obsidian template are npm packages and are pinned there. `quartz.lock.json` is created for Git-sourced plugins; this spike does not use any yet.

The `content` directory is a symlink to `../generated/quartz-content`. Quartz therefore consumes only staged public content, never a raw vault.

## Files removed from the upstream copy

These were deleted deliberately. They are recoverable from upstream at the pinned commit, or from
this repository's history before the cleanup commit.

| Removed                           | Why                                                                                                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/`                        | Quartz's own CI: five workflows (including `deploy-v5` and `docker-build-push`), `dependabot.yml`, and a `FUNDING.yml` crediting Quartz's author. All would fire or mislead if this repo ever gains a GitHub remote. |
| `docs/`                           | 2.6 MB of Quartz's own website content, unrelated to this project. The `docs` npm script that served it was removed with it.                                                                                         |
| `CODE_OF_CONDUCT.md`, `README.md` | Quartz project files; the second is confusing next to this repo's own README.                                                                                                                                        |
| `Dockerfile`                      | Container build for Quartz's site; deployment here targets a static host.                                                                                                                                            |

Kept on purpose: `LICENSE.txt` (Quartz is MIT-licensed and this is a vendored copy, so the licence
must travel with it) and `quartz.config.default.yaml` (useful reference when configuring plugins).

## Upgrading

Because the bridge currently lives _inside_ `quartz/plugins/`, a future upgrade is easier as a
re-vendor than a merge: fetch the new upstream tree, delete the files listed above again, and re-apply
the three bridge files plus `quartz.ts`. Phase 10 moves the bridge out to `site/bridge/`, after which
the vendored tree becomes untouched upstream code and this step gets simpler.

The bridge files are:

```text
quartz/plugins/pageTypes/quartoPage.tsx
quartz/plugins/pageTypes/quartoPageHtml.ts
quartz/plugins/pageTypes/quartoPage.test.ts
quartz/plugins/emitters/quartoArtifacts.ts
quartz.ts
```

## Local commands

```bash
cd site
npm install
node quartz/bootstrap-cli.mjs build
node quartz/bootstrap-cli.mjs build --serve
```

Invoking the bootstrap file directly avoids a user-level npm cache permission issue observed with `npx` on the initial machine.

The Open Graph image plugin is disabled in `quartz.config.yaml` for the local spike because it requires a build-time font fetch. It can be re-enabled once the font and deployment strategy is selected.
