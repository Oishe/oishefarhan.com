# One-time setup

Things that live in the Cloudflare and GitHub dashboards, not in this repo.
Once these are done, `git push` deploys everything and you never come back here.

---

## 1. GitHub secrets (needed by all three workflows)

The workflows in `.github/workflows/` deploy with Wrangler, which needs two
secrets. Add them at **GitHub → your repo → Settings → Secrets and variables →
Actions → New repository secret**:

| Secret | Where to find it |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → right sidebar, "Account ID" |
| `CLOUDFLARE_API_TOKEN` | created below |

### Creating the API token

Cloudflare dashboard → **My Profile → API Tokens → Create Token → Create Custom
Token**. It needs four permissions, not the two you'd expect:

| Type | Resource | Level |
|---|---|---|
| Account | Workers Scripts | Edit |
| Zone | Workers Routes | Edit |
| Zone | Zone | Read |
| Zone | DNS | **Edit** |

Scope both zone permissions to the `oishefarhan.com` zone.

**DNS:Edit is the one people miss.** Both `wrangler.jsonc` and
`wrangler.notebooks.jsonc` declare their routes with `custom_domain: true`, which
means Wrangler *creates the DNS record itself* on first deploy. A token with only
Workers permissions fails there with a permissions error that does not mention DNS.

---

## 2. The notebooks subdomain

`notebooks.oishefarhan.com` is a second Worker serving the marimo WASM exports.
You do **not** need to pre-create the DNS record — `custom_domain: true` does it
on the first deploy, given the token above.

First deploy, from your machine:

```sh
just notebooks                                    # builds notebooks-dist/ (~78 MB, gitignored)
npx wrangler deploy -c wrangler.notebooks.jsonc
```

After that, CI takes over: any push to `main` touching `notebooks/**` rebuilds
and redeploys it.

Then check `https://notebooks.oishefarhan.com/` lists three notebooks and that
one of them boots and runs a cell. First load is slow — it is fetching Pyodide
from jsdelivr and then a real Python interpreter starts.

Worth knowing:

- The build enforces Cloudflare's limits itself and fails loudly. You are
  currently at **2,219 files of 20,000** and a largest file of **4.60 MiB of 25**.
- The three exports each carry a byte-identical copy of the marimo frontend.
  Cloudflare uploads by content hash, so ~78 MB on disk is ~26 MB on the first
  deploy and near-zero after. Don't build a dedup step until ~13 notebooks.
- `notebooks/02` and `notebooks/03` fetch a random image from `picsum.photos`
  at runtime. It works, but it means every load hits a third party and the
  notebook is non-deterministic. Bundling a default image would fix both.

---

## 3. Cloudflare Web Analytics

Your domain is proxied through Cloudflare (the `custom_domain: true` routes), so
this needs **no change to the repo** — no beacon script, nothing render-blocking
that we own.

Cloudflare dashboard → **Analytics & Logs → Web Analytics → Add a site** →
choose `oishefarhan.com` → enable **Automatic Setup**. Cloudflare injects the
beacon at the edge.

Add `notebooks.oishefarhan.com` as a second site if you want traffic on the
notebooks separated out.

Two caveats, so the numbers don't surprise you:

- The beacon is served from `static.cloudflareinsights.com` and **ad blockers
  block it**. Expect undercounting, especially from a technical audience. Proxying
  the beacon through your own Worker to evade that is possible and is a choice
  about your readers, not a technical fix — it isn't done here.
- `quartz.config.yaml` has `analytics: null` and should stay that way. That
  setting is for Quartz injecting its own script tag; the edge injection is
  independent of it and strictly cheaper.

---

## 4. Check it worked

```sh
just serve      # the site, exactly as deployed
just lab        # the widget playground
```

Push to `main` and three workflows should run: `CI`, `Deploy site`, and — only if
you touched `notebooks/` — `Deploy notebooks`.
