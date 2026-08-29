# Project: Diffusion, from a score field to a sampler

Four artifacts, published in order, that together argue one thing:
**diffusion is a spectral process, and I can both derive it and ship it.**

`PLAN.md` governs the architecture this has to live inside. `CLAUDE.md` governs
what the code may do. This file is the content plan and the study plan.

## Why this shape

The job market is saturated with `train_ddpm_mnist.ipynb`. It demonstrates that
the author can call a scheduler. What is scarce is someone who can explain *why*
the method works and then make the explanation run, fast, on a phone.

The ECE background is the asymmetry to lean on. Diffusion's forward process is a
noise floor rising through a signal's spectrum; denoising is coarse-to-fine
reconstruction. That is the same material as the existing sparsity thread, told
in the other direction. Nobody with a pure CS-ML background frames it that way,
and framing it that way is the differentiator — not the model size.

The data-engineering experience is the second asymmetry: the app at the end is
the part that says *shipped*, not *studied*. Most ML portfolios stop at a
notebook. This one ends at an origin serving generated images with no Python in
the loop.

## The four artifacts

| # | Artifact | Tier | Depends on |
|---|---|---|---|
| 1 | **Post — score fields and Langevin dynamics** | 1 | nothing |
| 2 | **Post — diffusion is spectral** | 0 + one widget | the existing DCT code |
| 3 | **Post — samplers and guidance** | 1 | post 1's trained weights |
| 4 | **App — 32x32 generation, WebGPU** | own origin | posts 1 and 3 |

Sequenced so that **post 1 alone is a shippable, differentiated artifact.**
Everything after is additive. If the job search starts before post 4 exists,
nothing is wasted and nothing is half-finished.

Posts 1 and 3 share one set of exported weights, so post 3 costs a sampler file
and prose.

## Where the work lives

```
notebooks/04_score_matching.py     derivation, training, figure sources
notebooks/05_spectral_diffusion.py post 2's numerics
scripts/export_weights.py          torch state_dict -> quantized JSON
packages/explorables/src/dsp/      score/sampler numerics, headless, Float64Array
packages/explorables/src/components/score-field.ts
packages/explorables/src/components/langevin-sampler.ts
vault/posts/                       the prose
```

Training runs on CPU in minutes for posts 1 and 3. Post 4 needs a GPU for a few
hours; that is the only paid step in the project.

---

# Post 1 — "Walking uphill in the dark"

**The claim:** if you know which way the density increases, you can sample from
it. That direction is $\nabla_x \log p(x)$, and it is the whole object.

## The structural trick

Use a **Gaussian mixture** as the data distribution, because its score is closed
form:

$$p(x) = \sum_k \pi_k \,\mathcal{N}(x; \mu_k, \sigma_k^2 I), \qquad
\nabla_x \log p(x) = \sum_k w_k(x)\,\frac{\mu_k - x}{\sigma_k^2}$$

with $w_k(x)$ the posterior responsibility. Better still, the **noise-perturbed**
density $p_\sigma = p * \mathcal{N}(0,\sigma^2 I)$ is *also* a GMM — convolving
Gaussians just adds variances — so the annealed score is closed form at every
noise level too.

Three consequences, all of them good:

1. Most of the post ships with **no neural network at all**, which is exactly the
   argument `PLAN.md` makes about `basis-rotation`: check whether the interactive
   part is closed-form before reaching for a runtime.
2. When the learned model does arrive, there is **ground truth to compare it to**.
   The post can show the error map. Almost no diffusion tutorial can do this,
   because almost all of them start on images where the true score is unknowable.
3. The reader meets the concept before the machinery, which is the house style.

## Section plan

**§1 — The sampling problem.** You have samples, not a density. Rejection
sampling and MCMC in one paragraph each, and why neither scales to pixels.
*Figure: the target density as a heatmap (Tier 0 SVG).*

**§2 — The score is a vector field.** Define $\nabla \log p$. Derive it for the
GMM. Note that it is invariant to the normalising constant — which is the entire
reason anyone uses it.
*Widget `<score-field>`: quiver plot over the density, drag a test point, see the
arrow. Pure closed form, no weights.*

**§3 — Langevin dynamics.** $x_{t+1} = x_t + \varepsilon \nabla\log p(x_t) +
\sqrt{2\varepsilon}\, z$. Show it converging. Then show it **failing**: with
well-separated modes, particles get trapped and the mixture weights come out
wrong. Do not hide this — the failure is the motivation for everything that
follows.
*Widget `<langevin-sampler>`: 500 particles, step-size and step-count sliders,
one Langevin step per animation frame.*

**§4 — Annealing.** Run at large $\sigma$ first, where the modes have merged into
one basin, then lower it. Because $p_\sigma$ is still a GMM this is entirely
analytic, so the $\sigma$ slider is closed form and instant.
*This is the section the post exists for.* Watching the modes fuse as $\sigma$
rises **is** the forward diffusion process, and the reader will have understood
it before the word "diffusion" appears.

**§5 — Learning the score.** In reality $p$ is unknown. Denoising score matching:

$$\mathcal{L}(\theta) = \mathbb{E}_{x,\sigma,z}\left[\left\|
s_\theta(x + \sigma z,\, \sigma) + \frac{z}{\sigma} \right\|^2\right]$$

State why the denoising objective has the same minimiser as the intractable one
(Vincent 2011); do not reproduce the proof, link it.
*Figures: training loss; learned field beside analytic field; error heatmap.*
*The widgets from §2–4 gain a toggle: analytic score vs learned score.*

**§6 — What this misses**, and a link to post 2: nothing here says *why the
noise schedule looks the way it does on real images*. That needs the spectrum.

## Engineering

**The model.** MLP, `2 -> 64 -> 64 -> 2`, SiLU, conditioned on $\log\sigma$ via
random Fourier features. ~8.7k params. Deliberately small — see the cost analysis
below.

**Cost.** One forward pass is ~17 kFLOP. The animation is inherently incremental:
one Langevin step per frame, 500 particles, so ~8.5 MFLOP per frame. Comfortably
60 fps in scalar JS. Do **not** compute a full 100-step trajectory synchronously
on a slider event — that is 425 MFLOP and it will jank. Batch the layer as a
matrix multiply over a `Float64Array` and hoist the weight-row loop outermost.

**Weights.** Quantize to int8 per-tensor with an fp32 scale, ship as a committed
JSON asset under `sites/quartz/quartz/static/`, fetched lazily by the widget —
not bundled into the chunk. Roughly 10–15 KB. Remember `gitignore: true`: if the
weights land in `.gitignore` they will silently vanish from the Cloudflare build.

**Verification.** `scripts/export_fixtures.py` emits (a) analytic GMM scores on a
fixed grid and (b) the trained net's outputs on a fixed input batch, straight
from PyTorch. Vitest asserts the TS forward pass matches. Tolerance `1e-6`, not
`1e-10` — this is int8-quantized fp32 arithmetic, not an orthonormal transform,
and the test should carry a comment saying so.

**Accessibility and budget.** Static fallback child plus `alt` on both widgets.
`static lab` blocks with sensible bounds. Native `<input type="range">`,
rAF-throttled. Everything below the fold and lazily loaded, so the post's initial
payload should not move at all. Measure with a real Lighthouse run over gzip
before claiming that.

## Definition of done

- [ ] `notebooks/04_score_matching.py` — derivation, training, `@app.function` plot fns
- [ ] Figures exported to `vault/attachments/figs/`, ink from rcParams
- [ ] Fixtures exported; TS numerics parity-tested
- [ ] `<score-field>` and `<langevin-sampler>` shipped, in the lab
- [ ] Weights exported, quantized, committed, fetched lazily
- [ ] `vault/posts/walking-uphill-in-the-dark.md`
- [ ] Live notebook on `notebooks.oishefarhan.com`, linked from the post
- [ ] Lighthouse mobile over gzip, recorded in `PLAN.md`

---

# Post 2 — "Diffusion is spectral" (sketch)

Mostly Tier 0. Take real images; plot the radially-averaged power spectrum of
$x_t$ as $t$ sweeps. Natural images have roughly $1/f^\alpha$ spectra, so a flat
noise floor rising through that spectrum wipes out frequencies **in order**,
high to low. Reverse it and the model is committing to coarse structure first —
approximate autoregression in frequency.

Connects directly to the sparsity posts: same DCT code, same argument about where
the information lives, run backwards. One widget: sweep $t$, show the spectrum
with the noise floor overlaid, and the corresponding degraded image beside it.

Credit Dieleman's post explicitly, and read Milanfar's objection to "*just*
spectral autoregression" before writing — engaging with the pushback is worth
more than repeating the claim.

# Post 3 — "The sampler zoo" (sketch)

Reuses post 1's weights entirely. The probability-flow ODE makes the trajectory
deterministic and therefore drawable. Compare ancestral/DDPM, DDIM, Heun, and a
DPM-Solver step on the same seed with a step-count slider — the practitioner's
actual daily concern, which is why it reads as *has shipped something*.

Second half: classifier-free guidance drawn as literal vector arithmetic.
$\epsilon_\text{cfg} = \epsilon_\text{uncond} + w(\epsilon_\text{cond} -
\epsilon_\text{uncond})$ is an extrapolation; crank $w$ and watch samples leave
the data manifold. That is the visual explanation of oversaturation at high CFG,
and it is nearly absent from the internet.

# App — 32x32 generation (sketch)

~2M-param UNet, EDM preconditioning and schedule, trained on CIFAR-10 or a
QuickDraw subset. Sampling in a Worker via WebGPU, WASM fallback.

**Cannot live on a post.** ONNX Runtime Web alone is ~2 MB of WASM against a
250 KB budget. It gets its own origin, exactly like the notebooks — one click
from a post, so the reader opts in. That pattern already exists in this repo;
this is its second tenant.

Ship it with numbers: parameter count, training wall-clock and cost, FID, and
sampling latency at 10/25/50 steps on a real phone.

---

# Study plan

Staged against the artifacts. Do not read ahead — the first stage is the only
one needed to start writing.

## Stage 1 — before post 1

| Resource | Why |
|---|---|
| [Yang Song, *Generative Modeling by Estimating Gradients of the Data Distribution*](https://yang-song.net/blog/2021/score/) | The single closest match to post 1. Score, Langevin, annealing, in that order. Read it twice. |
| [Song & Ermon 2019, NCSN](https://arxiv.org/abs/1907.05600) | The paper behind that blog. Section 3 is post 1's §3–4. |
| [Vincent 2011, *A Connection Between Score Matching and Denoising Autoencoders*](https://www.iro.umontreal.ca/~vincentp/Publications/smdae_techreport.pdf) | The one proof to actually work through: why the denoising objective has the right minimiser. Post 1 §5 rests on it. |
| [MIT 6.S184 lecture notes](https://arxiv.org/abs/2506.02070) ([course site](https://diffusion.csail.mit.edu/)) | Self-contained, ODE/SDE-first, and the most current framing. Lectures 1–3 cover stage 1. |
| [Lilian Weng, *What are Diffusion Models?*](https://lilianweng.github.io/posts/2021-07-11-diffusion-models/) | Reference sheet for notation, not a first read. |

## Stage 2 — post 2

- [Dieleman, *Diffusion is spectral autoregression*](https://sander.ai/2024/09/02/spectral-autoregression.html) — the source of the framing. Has a companion Colab.
- Milanfar's rebuttal thread, and Fabian Falck's response post — read both before writing.
- [Ho et al. 2020, DDPM](https://arxiv.org/abs/2006.11239) — by now this reads as a special case rather than a starting point, which is the right way to meet it.
- [Kingma et al., *Variational Diffusion Models*](https://arxiv.org/abs/2107.00630) — the SNR view, which is what makes the spectral argument quantitative.
- [Dieleman, *Noise schedules considered harmful*](https://sander.ai/2024/06/14/noise-schedules.html)

## Stage 3 — post 3

- [Song et al. 2021, *Score-Based Generative Modeling through SDEs*](https://arxiv.org/abs/2011.13456) — the unification, and the probability-flow ODE.
- [Song et al. 2020, DDIM](https://arxiv.org/abs/2010.02502)
- [Karras et al. 2022, EDM](https://arxiv.org/abs/2206.00364) — the design-space paper. The most practically useful paper in the whole list; its preconditioning is what post 4 should train with.
- [Ho & Salimans 2022, classifier-free guidance](https://arxiv.org/abs/2207.12598)
- [Dieleman, *Guidance: a cheat code*](https://sander.ai/2022/05/26/guidance.html) and [*The geometry of diffusion guidance*](https://sander.ai/2023/08/28/geometry.html)

## Stage 4 — currency

Interviews in 2026 will ask about flow matching, because that is what current
image and video models are trained with.

- [Lipman et al. 2023, *Flow Matching for Generative Modeling*](https://arxiv.org/abs/2210.02747)
- [Liu et al. 2022, *Rectified Flow*](https://arxiv.org/abs/2209.03003)
- [Lipman et al. 2024, *Flow Matching Guide and Code*](https://arxiv.org/abs/2412.06264) + [`facebookresearch/flow_matching`](https://github.com/facebookresearch/flow_matching)

**Worth considering:** frame the whole series in flow-matching terms rather than
DDPM terms. The derivation is shorter, it is the modern framing, and "here are
DDPM, score-SDE and rectified flow, and here is the widget showing they are the
same object under different parameterisations" is an explorable that does not
currently exist anywhere good. Decide this before post 3, not after.

## Deliberately not on this list

Hugging Face `diffusers` tutorials, "build stable diffusion in 300 lines" posts,
and anything that starts by importing a pretrained UNet. They teach the API, and
the API is not what is being demonstrated here.

---

# Risks

- **Scope.** Four artifacts is a lot. The sequencing exists so that stopping
  after any one of them still leaves something finished. Ship post 1 before
  starting post 2.
- **Post 4 is the one that can eat months.** WebGPU inference is real
  engineering that is not about diffusion. Timebox it, and fall back to ONNX
  Runtime Web rather than hand-written kernels unless profiling demands otherwise.
- **The GMM trick is pedagogy, not a result.** Post 1 must be explicit that the
  closed form is a teaching scaffold, or a reviewer will read it as not knowing
  the difference.
