# Quartz upstream pin

This spike was copied from the official Quartz repository without its Git metadata.

- Branch: `v5`
- Commit: `075afd3f712da0088a07f5284a7b3aba37dd61b6`
- Quartz package version: `5.0.0`
- Retrieved: `2026-08-23`

The exact npm dependency graph is pinned by `package-lock.json`. The default Quartz plugins used by the Obsidian template are npm packages and are pinned there. `quartz.lock.json` is created for Git-sourced plugins; this spike does not use any yet.

The `content` directory is a symlink to `../generated/quartz-content`. Quartz therefore consumes only staged public content, never a raw vault.

## Local commands

```bash
cd site
npm install
node quartz/bootstrap-cli.mjs build
node quartz/bootstrap-cli.mjs build --serve
```

Invoking the bootstrap file directly avoids a user-level npm cache permission issue observed with `npx` on the initial machine.

The Open Graph image plugin is disabled in `quartz.config.yaml` for the local spike because it requires a build-time font fetch. It can be re-enabled once the font and deployment strategy is selected.
