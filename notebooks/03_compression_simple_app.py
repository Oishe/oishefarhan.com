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
app = marimo.App(width="medium")

with app.setup:
    import io
    import urllib.request

    import marimo as mo
    import numpy as np
    import pywt
    from PIL import Image
    from scipy.fft import dctn, idctn, fft2, ifft2, fftshift, ifftshift

    import matplotlib.pyplot as plt


@app.cell(hide_code=True)
def title():
    mo.md(r"""
    #️Sparsity Exploration
    """)
    return


@app.cell
def _():
    url_input = mo.ui.text(
        value="https://picsum.photos/1500/1000",
        kind="url",
        full_width=True,
    )

    load_image = mo.ui.run_button(
        label="Load Image",
        full_width=True,
    )

    mo.hstack(
        [url_input, load_image],
        align="stretch",
        justify="center",
        widths=[4, 1],
    )
    return load_image, url_input


@app.cell
def cell_get_image(load_image, url_input):
    load_image


    def get_image(url, longest_side=1024):
        # Everything downstream — transform, mask, inverse, both encodes — costs in
        # proportion to the pixel count, and the panels below render at ~535 px.
        with urllib.request.urlopen(url) as response:
            image = Image.open(io.BytesIO(response.read()))
        if max(image.size) > longest_side:
            scale = longest_side / max(image.size)
            size = (round(image.width * scale), round(image.height * scale))
            image = image.resize(size, Image.LANCZOS)
        return image


    image = get_image(url_input.value)
    rgb = np.asarray(image, dtype=np.float32) / 255.0

    mo.image(rgb)
    return (rgb,)


@app.cell
def _():
    # Transform primitives. Each transform exposes a matching forward/inverse pair:
    # forward maps an image (H, W, C) to a coefficient array with the same 2D layout,
    # inverse maps coefficients back to a real image of the original shape. All three
    # are orthonormal filter banks (norm="ortho"), so the round-trip is exact to float
    # precision. Parseval holds exactly for FFT and DCT; for DWT the packed coefficient
    # array is marginally larger than the image when the dimensions do not divide by
    # 2**level, so its coefficient energy runs slightly above the image's.
    #
    # DWT is also the only inverse that needs to know how the subbands were packed, and
    # under periodization that layout follows from the *image* shape, not the coefficient
    # shape. Keeping it as instance state is what lets all three share one interface.


    class FFT:
        def forward(self, img):
            # DC recentered (fftshift) so low frequencies sit in the middle of the view.
            return fftshift(fft2(img, axes=(0, 1), norm="ortho"), axes=(0, 1))

        def inverse(self, coeffs):
            # .real: the inverse FFT returns complex; the imaginary part is numerical noise.
            return ifft2(ifftshift(coeffs, axes=(0, 1)), axes=(0, 1), norm="ortho").real


    class DCT:
        def forward(self, img):
            return dctn(img, axes=(0, 1), norm="ortho")

        def inverse(self, coeffs):
            return idctn(coeffs, axes=(0, 1), norm="ortho")


    class DWT:
        def __init__(self, wavelet="db4", mode="periodization", max_level=6):
            self.wavelet = wavelet
            self.mode = mode
            self.max_level = max_level
            self._layout = None
            self._shape = None

        def _level(self, shape):
            # An 8-tap db4 filter limits how far a small image can be decomposed.
            return min(
                self.max_level,
                pywt.dwt_max_level(min(shape[:2]), pywt.Wavelet(self.wavelet).dec_len),
            )

        def forward(self, img):
            coeffs = pywt.wavedec2(
                img, self.wavelet, mode=self.mode, level=self._level(img.shape), axes=(0, 1)
            )
            arr, self._layout = pywt.coeffs_to_array(coeffs, axes=(0, 1))
            self._shape = img.shape
            return arr

        def inverse(self, arr):
            if self._layout is None:
                raise RuntimeError("DWT.inverse requires a preceding forward")
            coeffs = pywt.array_to_coeffs(arr, self._layout, output_format="wavedec2")
            img = pywt.waverec2(coeffs, self.wavelet, mode=self.mode, axes=(0, 1))
            # Periodization rounds subband sizes up; trim back to the original shape.
            return img[: self._shape[0], : self._shape[1]]


    transforms = {
        "FFT": FFT(),
        "DCT": DCT(),
        "DWT": DWT(),
    }

    transform_choice = mo.ui.dropdown(
        options=list(transforms),
        value="FFT",
        label="Transforms",
    )
    transform_choice
    return transform_choice, transforms


@app.cell
def _(rgb, transform_choice, transforms):
    transform = transforms[transform_choice.value]

    s = transform.forward(rgb)
    s_abs = np.abs(s)  # Absolute value pre-calculated
    s_log = np.log1p(s_abs)

    # One colour scale for every coefficient panel, held fixed while the threshold
    # moves: re-deriving percentiles per frame makes the field flicker as it empties.
    log_span = np.percentile(s_log, [0.1, 99.9])
    return log_span, s, s_abs, s_log, transform


@app.function
def to_image(values, lo, hi):
    # Scaling here rather than letting mo.image min-max normalize keeps every panel on
    # one scale, so brightness stays comparable as the threshold moves. compress_level=3
    # halves the encode time for about a quarter more bytes — the right trade for
    # something that runs on every slider step.
    scaled = ((values - lo) * (255.0 / (hi - lo))).clip(0, 255).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(scaled).save(buf, format="PNG", compress_level=3)
    return mo.image(buf)


@app.cell
def _(s_abs):
    # Sorted, downsampled coefficient distribution for the plot.
    # ~1.5M sorted magnitudes -> ~3k log-spaced ranks (keeps head detail on log-y).
    # Descending. np.sort(descending=True) needs numpy >= 2.3; Pyodide ships older.
    s_sorted = np.sort(s_abs.ravel())[::-1]
    sampled_idxs = np.unique(np.geomspace(1, s_sorted.size, 3000).round().astype(int)) - 1
    sampled_mags = s_sorted[sampled_idxs]
    return s_sorted, sampled_idxs, sampled_mags


@app.function
def theme(fig):
    for ax in fig.axes:
        for spine in ["top", "right"]:
            ax.spines[spine].set_visible(False)
        ax.patch.set_alpha(0)
    fig.patch.set_alpha(0)
    fig.tight_layout()
    return fig


@app.function
def plot_magnitude_decay(idxs, mags, n_kept, n_total):
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(idxs + 1, mags, color="blue", linewidth=1.6)
    ax.axvline(
        n_kept,
        color="red",
        linestyle="--",
        linewidth=1.2,
        # At rank 1 the line lands on the left spine; clipping would erase it there.
        clip_on=False,
        label="Threshold",
    )
    ax.set_xscale("log")
    # Pinned, so rank n sits at exactly log10(n) / log10(n_total) across the axes.
    ax.set_xlim(1, n_total)
    ax.set_ylabel("magnitude")
    ax.set_xlabel("rank (coefficients sorted by magnitude)")
    ax.set_title("coefficient magnitudes decay over many orders", fontsize=11)
    ax.grid(True, which="both", linewidth=0.4, alpha=0.25)
    ax.legend(frameon=False)

    return theme(fig)


@app.cell
def out_keep_readout(n_kept, rgb):
    mo.md(f"""
    **Keep** {100 * n_kept / rgb.size:.3g}% — top {n_kept:,} of {rgb.size:,} coefficients
    """)
    return


@app.cell
def ui_keep_rank(rgb):
    # The slider holds a rank, not a percentage: its handle moves linearly in the step
    # index and the plot's x-axis is logarithmic in rank, so geometrically spaced steps
    # are what keep the handle level with the threshold line. No np.unique — dropping
    # the repeated integers at the head would collapse the first decades of rank into a
    # linear stretch of the track. Spanning the image rather than the coefficients keeps
    # the slider from resetting when the transform changes.
    _ranks = np.geomspace(1, rgb.size, 601).round().astype(int).tolist()

    keep_rank = mo.ui.slider(
        steps=_ranks,
        value=_ranks[int(np.searchsorted(_ranks, round(0.05 * rgb.size)))],
        full_width=True,
    )
    keep_rank
    return (keep_rank,)


@app.cell
def compute_keep(keep_rank):
    n_kept = keep_rank.value
    return (n_kept,)


@app.cell
def plot_decay(n_kept, rgb, sampled_idxs, sampled_mags):
    plot_magnitude_decay(sampled_idxs, sampled_mags, n_kept, rgb.size)
    return


@app.cell
def compute_sparse(n_kept, s, s_abs, s_log, s_sorted, transform):
    keep = s_abs >= s_sorted[n_kept - 1]
    reconstructed = transform.inverse(np.where(keep, s, 0.0))
    kept_log = np.where(keep, s_log, 0.0)
    return kept_log, reconstructed


@app.cell
def _(log_span, rgb, s_log):
    # One row per cell, deliberately. Four full-resolution images in a single output
    # exceeds marimo's default output_max_bytes, and the WASM export does not inherit
    # the raised cap in pyproject.toml, so a combined vstack renders as an
    # "output is too large" error on the deployed site while working fine locally.
    mo.hstack(
        [to_image(rgb, 0.0, 1.0), to_image(s_log, *log_span)],
        align="center",
        widths=[1, 1],
    )
    return


@app.cell
def _(kept_log, log_span, reconstructed):
    mo.hstack(
        [to_image(reconstructed, 0.0, 1.0), to_image(kept_log, *log_span)],
        align="center",
        widths=[1, 1],
    )
    return


if __name__ == "__main__":
    app.run()
