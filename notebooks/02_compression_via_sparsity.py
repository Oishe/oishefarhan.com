# /// script
# requires-python = ">=3.14"
# dependencies = [
#       "marimo",
#       "matplotlib",
#       "numpy",
#       "pillow",
#       "pywavelets",
#       "scipy"
# ]
# ///

import marimo

__generated_with = "0.23.10"
app = marimo.App(width="full")

with app.setup:
    import io
    import urllib.request

    import marimo as mo
    import matplotlib.pyplot as plt
    import numpy as np
    import pywt
    from PIL import Image
    from scipy.fft import dctn, fft2, fftshift, idctn, ifft2, ifftshift


@app.cell
def md_title():
    mo.md(r"""
    # Sparsity and Compression

    It is amazing that most natural signals, like images and audio, tend to be highly compressible.
    If we find an appropriate set of basis vectors to construct the image from, we will see that we only need a few terms and the rest will be zero.
    """)
    return


@app.cell(hide_code=True)
def _():
    mo.mermaid("""
    block-beta
        columns 3
        block:GroupPS:1
            columns 1
            PS["Pixel Space"]
            D["Dense pixels"]
            space
            R["Reconstruction"]
        end
        space:1
        block:GroupTS:1
            columns 1
            TS["Transform Space"]
            C["Coefficients"]
            space
            S["Sparse coefficients"]
        end
        D --"transform"--> C
        C --"threshold"--> S
        S --"inverse transform"--> R
        classDef blue fill:#4682b41f,stroke:#4682b48c
        classDef green fill:#3cb3711f,stroke:#3cb3718c
        class PS,GroupPS blue
        class TS,GroupTS green
    """)
    return


@app.cell
def _(fft_forward):
    _style = {"image-rendering": "pixelated"}
    _samples = []

    _rng = np.random.default_rng(0)
    _samples.append(_rng.random((256, 256, 3), dtype=np.float32))

    _url = "https://picsum.photos/256/256"
    _samples.append(np.asarray(get_image(_url).convert("RGB"), dtype=np.float32) / 255.0)

    _stack = []
    for _sample in _samples:
        _coeffs = fft_forward(_sample)
        _stack.append(
            mo.hstack(
                [
                    mo.image(_sample, width=400, style=_style),
                    coeff_display(_coeffs, width=400, style=_style),
                ],
                justify="center",
            )
        )
    mo.vstack(_stack)
    return


@app.cell(hide_code=True)
def art_md_sparse():
    mo.md(r"""
    ## 1. Dense vs. sparse

    An image is a vector $x \in \mathbb{R}^N$ with $N = H\cdot W$ pixels. In
    **pixel space** it is *dense*: almost every component is nonzero, because
    neighbouring pixels are highly correlated — storing a pixel is wasteful when its
    neighbour already implies most of it.

    Choose an **orthonormal basis** $\Psi$ (a rotation of the space) and represent
    the same image by its coefficients

    $$c = \Psi^\top x, \qquad x = \Psi c.$$

    We use the **DCT** as the running example transform (the FFT / DCT / wavelet
    choices are compared in section 4). Here is the sample from the top, now in DCT
    **coefficient space** — almost the entire field is near-zero (dark). That
    emptiness *is* the sparsity:
    """)
    return


@app.function
def get_image(url):
    with urllib.request.urlopen(url) as response:
        return Image.open(io.BytesIO(response.read()))


@app.cell
def compute_sample(DEFAULT_URL, play_url):
    # The single image source for the whole notebook: the URL form in the playground
    # (Act II) drives it, loading only on submit. Change it there and every demo above
    # — plus the playground — recomputes on the new image.
    _url = play_url.value if isinstance(play_url.value, str) else DEFAULT_URL
    sample = np.asarray(get_image(_url).convert("RGB"), dtype=np.float32) / 255.0
    return (sample,)


@app.cell
def art_sample(sample):
    # The working image, loaded from the playground's "Load image" control (Act II).
    mo.image(sample, width=560)
    return


@app.function
def coeff_display(coeffs, width=None, vmin=None, vmax=None, **kwargs):
    # Shared coefficient view: per-pixel magnitude summed over channels, log-scaled
    # (coefficients span many orders of magnitude), with percentile clipping so a
    # few huge low-frequency coefficients do not wash out the rest. Pass an explicit
    # vmin/vmax to hold the scale fixed across images (e.g. a before/after cut).
    view = np.log1p(np.abs(coeffs).sum(axis=-1))
    if vmin is None or vmax is None:
        vmin, vmax = np.percentile(view, [0.1, 99.9])
    return mo.image(view, vmin=vmin, vmax=vmax, width=width, **kwargs)


@app.cell
def art_demo_field(dct_forward, sample):
    # First look at transform space: the sample as DCT coefficients.
    mo.vstack(
        [
            mo.md("**the same image in DCT coefficient space**"),
            coeff_display(dct_forward(sample), width=560),
        ],
        align="center",
    )
    return


@app.cell(hide_code=True)
def art_md_sparse_tail():
    mo.md(r"""
    Sorted by magnitude the coefficients decay fast and a small fraction holds almost
    all the energy $E = \sum_i c_i^2$. Because $\Psi$ is orthonormal, error in
    coefficient space equals error in pixel space (**Parseval**),
    $\lVert x-\hat x\rVert_2 = \lVert c-\hat c\rVert_2$ — so discarding the
    *smallest* coefficients is provably the least-damaging approximation for a given
    number of retained terms. `energy_curve` makes the concentration precise:
    """)
    return


@app.function
def energy_curve(coeffs):
    # Coefficient magnitudes sorted high->low, paired with the cumulative fraction
    # of total energy (sum of squares) the top-k capture. The steepness of this
    # curve is exactly the "compaction" the transforms compete on.
    sorted_mag = np.sort(np.abs(coeffs).ravel())[::-1]
    cum_energy = np.cumsum(sorted_mag.astype(np.float64) ** 2)
    return sorted_mag, cum_energy / cum_energy[-1]


@app.cell
def art_demo_sparse(dct_forward, sample):
    # Static demo: the sample's DCT energy-compaction curve.
    _mag, _energy = energy_curve(dct_forward(sample))
    _n = _mag.size
    _c99 = (int(np.searchsorted(_energy, 0.99)) + 1) / _n
    _idx = np.unique(np.round(np.geomspace(1, _n, 3000)).astype(int)) - 1

    _fig, _ax = plt.subplots(figsize=(9, 4))
    _ax.plot((_idx + 1) / _n, _energy[_idx], color="mediumseagreen", linewidth=2)
    _ax.set_xscale("log")
    _ax.set_xlabel("fraction of coefficients kept (largest first)")
    _ax.set_ylabel("cumulative energy")
    _ax.set_ylim(0, 1.02)
    _ax.axhline(0.99, color="gray", linestyle="--", linewidth=1)
    _ax.set_title(f"just {_c99:.2%} of DCT coefficients hold 99% of the energy", fontsize=11)
    # Transparent so marimo's theme (light or dark) shows through and styles the text.
    _fig.patch.set_alpha(0)
    _ax.patch.set_alpha(0)
    _fig.tight_layout()
    _fig
    return


@app.cell(hide_code=True)
def art_md_pipeline():
    mo.md(r"""
    ## 2. The compression pipeline

    The transform is **exactly invertible** — it loses nothing (round-trip error
    $\sim 10^{-6}$ here in float32, $\sim 10^{-15}$ in float64). All loss enters in
    two lossy steps:

    - **Selection / sparsification** — set the small coefficients to zero
      (`threshold_keep`).
    - **Quantization** — round the survivors to a coarse grid (what real codecs do
      next; not modelled here).

    Everything after that (entropy coding) is lossless bookkeeping. Below, the whole
    pipeline is three function calls — forward transform → keep the top 5% of
    coefficients → invert — with the transform space shown *before and after*
    thresholding. Watch the coefficient field go dark: only the few largest survive,
    yet the reconstruction barely changes.
    """)
    return


@app.cell
def fn_transforms():
    # Transform primitives. Each transform is a (forward, inverse) pair with an
    # identical signature: forward maps an image (H, W, C) to a coefficient array of
    # the same 2D layout; inverse maps coefficients back to a real image. All are
    # orthonormal (norm="ortho"), so Parseval holds and the round-trip is exact to
    # float precision.


    def fft_forward(img):
        # DC recentered (fftshift) so low frequencies sit in the middle of the view.
        return fftshift(fft2(img, axes=(0, 1), norm="ortho"), axes=(0, 1))


    def fft_inverse(coeffs):
        # .real: the inverse FFT returns complex; the imaginary part is numerical noise.
        return ifft2(ifftshift(coeffs, axes=(0, 1)), axes=(0, 1), norm="ortho").real


    def dct_forward(img):
        return dctn(img, axes=(0, 1), norm="ortho")


    def dct_inverse(coeffs):
        return idctn(coeffs, axes=(0, 1), norm="ortho")


    def dwt_forward(img, wavelet="db4", mode="periodization", level=2):
        coeffs = pywt.wavedec2(img, wavelet, mode=mode, level=level, axes=(0, 1))
        return pywt.coeffs_to_array(coeffs, axes=(0, 1))[0]


    def dwt_inverse(arr, wavelet="db4", mode="periodization", level=2):
        # The subband layout is a pure function of the array shape, so re-derive it
        # from a zero-primed forward rather than threading state out of dwt_forward.
        _, layout = pywt.coeffs_to_array(
            pywt.wavedec2(np.zeros_like(arr), wavelet, mode=mode, level=level, axes=(0, 1)),
            axes=(0, 1),
        )
        coeffs = pywt.array_to_coeffs(arr, layout, output_format="wavedec2")
        return pywt.waverec2(coeffs, wavelet, mode=mode, axes=(0, 1))

    return (
        dct_forward,
        dct_inverse,
        dwt_forward,
        dwt_inverse,
        fft_forward,
        fft_inverse,
    )


@app.function
def threshold_keep(coeffs, keep_frac):
    # Keep the top keep_frac of coefficients by magnitude, zero the rest — the
    # sparsifying step. A global magnitude cutoff, so the kept set is exactly the
    # largest-|c| coefficients wherever they sit in the spectrum.
    mag = np.abs(coeffs)
    n = mag.size
    k = int(round(keep_frac * n))
    if k <= 0:
        return np.zeros_like(coeffs)
    if k >= n:
        return coeffs
    thresh = np.partition(mag.ravel(), n - k)[n - k]
    return np.where(mag >= thresh, coeffs, 0)


@app.cell
def art_demo_pipeline(dct_forward, dct_inverse, sample):
    # The pipeline as a 2x2 grid that separates the two spaces, matching the title diagram:
    # pixel space (left) holds the dense pixels and the reconstruction; transform space
    # (right) holds the coefficients before and after thresholding, on a shared color
    # scale. pipeline_recon feeds the section-5 PSNR readout.
    pipeline_keep = 0.05
    _coeffs = dct_forward(sample)
    _sparse = threshold_keep(_coeffs, pipeline_keep)
    pipeline_recon = np.clip(dct_inverse(_sparse), 0.0, 1.0)
    _vmin, _vmax = np.percentile(np.log1p(np.abs(_coeffs).sum(axis=-1)), [0.1, 99.9])


    def _tile(_title, _body):
        return mo.vstack([mo.md(f"*{_title}*"), _body], align="center")


    _pixel = mo.callout(
        mo.vstack(
            [
                mo.md("### pixel space"),
                _tile("dense pixels", mo.image(sample, width=300)),
                _tile("reconstruction", mo.image(pipeline_recon, width=300)),
            ],
            align="center",
        ),
        kind="neutral",
    )
    _transform = mo.callout(
        mo.vstack(
            [
                mo.md("### transform space"),
                _tile("coefficients", coeff_display(_coeffs, width=300, vmin=_vmin, vmax=_vmax)),
                _tile(
                    f"sparse · top {pipeline_keep:.0%}",
                    coeff_display(_sparse, width=300, vmin=_vmin, vmax=_vmax),
                ),
            ],
            align="center",
        ),
        kind="neutral",
    )
    mo.hstack([_pixel, _transform], justify="center", gap=1, align="start")
    return pipeline_keep, pipeline_recon


@app.cell(hide_code=True)
def art_md_why():
    mo.md(r"""
    ## 3. Why a transform helps

    Energy compaction is decorrelation. The pixel covariance of natural images is
    strong and local; a good transform concentrates that shared structure into a few
    low-frequency coefficients and pushes the rest toward zero.

    The optimal basis is the data's **Karhunen–Loève transform** (KLT / PCA), which
    fully decorrelates the signal — but it is image-dependent and costly. For the
    *smooth-plus-edges* statistics of real images, the **DCT and wavelets are
    excellent fixed approximations** to the KLT, so codecs get most of the benefit
    with no per-image training and a fast, separable algorithm.
    """)
    return


@app.cell(hide_code=True)
def art_md_transforms():
    mo.md(r"""
    ## 4. The transforms: FFT · DCT · Wavelets

    Three fixed orthonormal bases, one registry (`TRANSFORMS`), one shared
    coefficient view (`coeff_display`). Every `(forward, inverse)` pair is exactly
    invertible.

    - **2-D FFT** — complex sinusoids $e^{j2\pi(ux+vy)/N}$. Global frequency content;
      the magnitude spectrum exposes periodic structure. Coefficients are *complex*
      (~2× storage) and truncation rings at edges (Gibbs). A superb analysis tool, a
      weak codec.
    - **2-D DCT** — real cosines. Near-optimal energy compaction (asymptotically the
      KLT for a first-order Markov model); even symmetry tames the edge discontinuity
      that plagues the DFT. On 8×8 blocks it is the engine of **JPEG**.
    - **2-D Wavelets** (db4) — scaled, shifted copies of a mother wavelet: a
      multiresolution decomposition (one LL approximation + LH/HL/HH detail subbands
      per scale), localized in *both* space and frequency. No blocking, edges stay
      sharp, naturally progressive. The engine of **JPEG 2000**.

    | | basis | locality | coefficients | typical artifact | codec |
    |---|---|---|---|---|---|
    | **FFT** | global sinusoids | frequency only | complex | ringing | analysis / filtering |
    | **DCT** | global cosines | frequency only | real | blocking (8×8) | **JPEG** |
    | **Wavelet** | scaled wavelets | space **and** frequency | real | mild ringing | **JPEG 2000** |

    Below: each transform's log-magnitude coefficient field for the sample — their
    distinctive fingerprints.
    """)
    return


@app.cell
def fn_registry(
    dct_forward,
    dct_inverse,
    dwt_forward,
    dwt_inverse,
    fft_forward,
    fft_inverse,
):
    # name -> (forward, inverse). Functions, not a class hierarchy: adding a transform
    # is one row, and the pipeline never branches on type. Coefficient display is
    # shared across transforms, so it lives on its own as coeff_display.
    TRANSFORMS = {
        "FFT": (fft_forward, fft_inverse),
        "DCT": (dct_forward, dct_inverse),
        "DWT": (dwt_forward, dwt_inverse),
    }
    return (TRANSFORMS,)


@app.cell
def art_demo_transforms(TRANSFORMS, sample):
    # Static demo: the coefficient field of each transform, via the registry.
    mo.hstack(
        [
            mo.vstack([mo.md(f"**{_name}**"), coeff_display(_fwd(sample), width=340)], align="center")
            for _name, (_fwd, _inv) in TRANSFORMS.items()
        ],
        justify="center",
        gap=2,
    )
    return


@app.cell(hide_code=True)
def art_md_quant():
    mo.md(r"""
    ## 5. Quantization → measuring distortion

    Sparsification sets coefficients to zero. Real codecs then **quantize** the
    survivors — round them to a coarse grid $\hat c_i = q\,\operatorname{round}(c_i/q)$,
    with coarser steps for high frequencies (JPEG's quantization matrix) — and
    entropy-code the result. That step is what finally turns sparsity into *fewer
    bits*. We don't model it here, but the distortion it trades against is exactly
    what `psnr` / `mse` measure:

    $$\mathrm{MSE}=\frac1N\sum_i (x_i-\hat x_i)^2,\qquad
    \mathrm{PSNR}=10\log_{10}\frac{\mathrm{MAX}^2}{\mathrm{MSE}}\ \text{dB}.$$

    For the top-5% global-DCT reconstruction from section 2:
    """)
    return


@app.cell
def fn_metrics():
    def mse(x, x_hat):
        return float(np.mean((np.asarray(x, np.float64) - np.asarray(x_hat, np.float64)) ** 2))


    def psnr(x, x_hat, data_range=1.0):
        # Peak signal-to-noise ratio in dB — the distortion axis of the sparsity
        # tradeoff. Infinite for a perfect reconstruction; ~30-40 dB reads as "clean".
        error = mse(x, x_hat)
        if error == 0:
            return float("inf")
        return float(10.0 * np.log10(data_range**2 / error))

    return mse, psnr


@app.cell
def art_demo_metrics(mse, pipeline_keep, pipeline_recon, psnr, sample):
    # PSNR / MSE for the section-2 reconstruction (data_range 1.0 on [0,1] images).
    mo.hstack(
        [
            mo.stat(f"{pipeline_keep:.0%}", label="DCT coefficients kept"),
            mo.stat(f"{psnr(sample, pipeline_recon):.1f} dB", label="PSNR"),
            mo.stat(f"{mse(sample, pipeline_recon):.2e}", label="MSE"),
        ],
        justify="start",
        gap=2,
    )
    return


@app.cell(hide_code=True)
def art_md_formats():
    mo.md(r"""
    ## 6. Standard image formats

    The *same pixels* cost wildly different bytes depending on the container and
    whether it is lossless.

    | Format | Loss | Core transform / method | Best for |
    |---|---|---|---|
    | **PNG** | lossless | row filters + DEFLATE (LZ77 + Huffman) | graphics, exact pixels, alpha |
    | **GIF** | lossless\* | ≤256-colour palette + LZW | tiny graphics, animation |
    | **JPEG** | lossy | **8×8 DCT** + quantization + Huffman; chroma subsampled 4:2:0 | photographs |
    | **JPEG 2000** | lossy / lossless | **wavelet** (CDF 9/7 lossy, 5/3 lossless) + EBCOT | quality scalability, medical |
    | **WebP** | lossy / lossless | VP8 intra blocks (DCT/WHT) + prediction | web photos + graphics |
    | **AVIF / HEIC** | lossy / lossless | AV1 / HEVC intra coding | best ratio today |

    \* GIF is lossless *given* ≤256 colours; reducing to that palette is the lossy step.

    Lossless containers exploit *redundancy*; lossy containers additionally exploit
    *sparsity + perception* — the sparsity this article is about.
    """)
    return


@app.cell(hide_code=True)
def md_act2():
    mo.md(r"""
    ## See it live

    The article above fixes the recipe — a global **DCT** keeping the **top 5%** — so
    the story stays legible. Here the same functions run with **every knob live**:
    load any image, pick a transform, and drag the keep-% slider; the reconstruction,
    coefficient field, PSNR and energy curve all update. Loading a new image also
    refreshes the sample used throughout the article above.
    """)
    return


@app.cell
def ui_play_controls(TRANSFORMS):
    # One control panel driving the whole playground. The URL loads only on submit
    # (a form), so typing does not refetch; transform and keep-% update live.
    DEFAULT_URL = "https://picsum.photos/1500/1000"
    play_url = mo.ui.text(value=DEFAULT_URL, kind="url", full_width=True).form(
        submit_button_label="Load image"
    )
    play_transform = mo.ui.dropdown(options=list(TRANSFORMS), value="DCT", label="Transform")
    play_keep = mo.ui.slider(start=0.1, stop=100, value=5, step=0.1, label="Keep %", show_value=True)
    mo.vstack(
        [
            play_url,
            mo.hstack([play_transform, play_keep], justify="start", gap=2, widths=[1, 3]),
        ]
    )
    return DEFAULT_URL, play_keep, play_transform, play_url


@app.cell
def compute_play(TRANSFORMS, mse, play_keep, play_transform, psnr, sample):
    # The whole pipeline, reactive to transform + keep-%: forward -> threshold -> invert,
    # plus the energy curve and distortion metrics. Reuses Act I's functions verbatim.
    _fwd, _inv = TRANSFORMS[play_transform.value]
    play_keep_frac = play_keep.value / 100.0
    play_coeffs = _fwd(sample)
    play_sparse = threshold_keep(play_coeffs, play_keep_frac)
    play_recon = np.clip(_inv(play_sparse), 0.0, 1.0)
    play_sorted_mag, play_energy_frac = energy_curve(play_coeffs)
    _k = max(1, min(int(round(play_keep_frac * play_sorted_mag.size)), play_sorted_mag.size))
    play_kept_energy = float(play_energy_frac[_k - 1])
    play_psnr = psnr(sample, play_recon)
    play_mse = mse(sample, play_recon)
    return (
        play_coeffs,
        play_energy_frac,
        play_keep_frac,
        play_kept_energy,
        play_mse,
        play_psnr,
        play_recon,
        play_sorted_mag,
        play_sparse,
    )


@app.cell
def out_play_images(play_recon, sample):
    mo.hstack(
        [
            mo.vstack([mo.md("**original**"), mo.image(sample, width=420)], align="center"),
            mo.vstack([mo.md("**reconstruction**"), mo.image(play_recon, width=420)], align="center"),
        ],
        justify="center",
        gap=2,
    )
    return


@app.cell
def out_play_coeffs(play_coeffs, play_sparse):
    # Transform space before/after the current cut, on a shared color scale.
    _vmin, _vmax = np.percentile(np.log1p(np.abs(play_coeffs).sum(axis=-1)), [0.1, 99.9])
    mo.hstack(
        [
            mo.vstack(
                [
                    mo.md("**coefficients**"),
                    coeff_display(play_coeffs, width=300, vmin=_vmin, vmax=_vmax),
                ],
                align="center",
            ),
            mo.vstack(
                [
                    mo.md("**sparse**"),
                    coeff_display(play_sparse, width=300, vmin=_vmin, vmax=_vmax),
                ],
                align="center",
            ),
        ],
        justify="center",
        gap=2,
    )
    return


@app.cell
def out_play_stats(play_keep_frac, play_kept_energy, play_mse, play_psnr):
    mo.hstack(
        [
            mo.stat(f"{play_keep_frac:.2%}", label="coefficients kept"),
            mo.stat(f"{play_kept_energy:.2%}", label="energy retained"),
            mo.stat(f"{play_psnr:.1f} dB", label="PSNR"),
            mo.stat(f"{play_mse:.2e}", label="MSE"),
        ],
        justify="start",
        gap=2,
    )
    return


@app.cell
def out_play_energy(
    play_energy_frac,
    play_keep_frac,
    play_kept_energy,
    play_sorted_mag,
):
    # Energy-compaction curve with the current keep marker.
    _n = play_sorted_mag.size
    _idx = np.unique(np.round(np.geomspace(1, _n, 3000)).astype(int)) - 1
    _fig, _ax = plt.subplots(figsize=(9, 3.6))
    _ax.plot((_idx + 1) / _n, play_energy_frac[_idx], color="mediumseagreen", linewidth=2)
    _ax.set_xscale("log")
    _ax.set_xlabel("fraction of coefficients kept (largest first)")
    _ax.set_ylabel("cumulative energy")
    _ax.set_ylim(0, 1.02)
    _ax.axvline(play_keep_frac, color="crimson", linestyle="--", linewidth=1.5)
    _ax.axhline(play_kept_energy, color="crimson", linestyle=":", linewidth=1)
    _ax.set_title(f"keep {play_keep_frac:.2%} → {play_kept_energy:.2%} of the energy", fontsize=11)
    _fig.patch.set_alpha(0)
    _ax.patch.set_alpha(0)
    _fig.tight_layout()
    _fig
    return


if __name__ == "__main__":
    app.run()
