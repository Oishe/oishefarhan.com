# /// script
# requires-python = ">=3.12"
# dependencies = [
#       "marimo",
#       "matplotlib",
#       "numpy",
# ]
# ///

# Prototyping and reference implementation for `vault/posts/a-signal-is-a-vector.md`.
#
# Two rules keep this file honest:
#
#   1. Every plotting function is `@app.function`, i.e. module level, so
#      `scripts/export_figures.py` can import and call it. Nested `def`s inside
#      `@app.cell` are invisible to the exporter — figures would then have to be
#      re-implemented, and re-implemented figures drift.
#   2. Ink (text, spines, ticks, grid) is never hardcoded. It comes from
#      rcParams, so the exporter can swap in a sentinel colour and post-process
#      the SVG into something that reads on both a light and a dark page.
#
# Data colours are the PALETTE constants below, chosen to clear 3:1 contrast
# against both the light and dark site backgrounds.

import marimo

__generated_with = "0.23.10"
app = marimo.App(width="medium")

with app.setup:
    import marimo as mo

    import matplotlib.pyplot as plt
    import numpy as np
    from matplotlib.patches import PathPatch
    from matplotlib.path import Path

    # Legible on #faf8f8 and on #161618 alike.
    C_SIGNAL = "#2f7ff0"
    C_WAVE = "#129e6a"
    C_ALT = "#e0483d"
    C_MUTED = "#8a8f98"


@app.cell(hide_code=True)
def _():
    mo.md(r"""
    # Compressing a Signal: Sparsity in the Right Basis

    A signal is usually stored as a long list of samples, but that list is rarely its most economical description. Choose the **right basis** — the right set of axes to measure it against — and nearly all of those numbers collapse to zero, leaving a **sparse** handful that compresses the signal with almost no loss.
    """)
    return


@app.cell
def compute_signal():
    n = 64
    x = build_signal(n)
    return n, x


@app.cell
def demo_signal(n, x):
    plot_signal(x, n)
    return


@app.cell
def demo_signal_samples(n, x):
    plot_signal_samples(x, n)
    return


@app.cell
def ui_rotate():
    rotate = mo.ui.slider(
        -90, 90, value=30, step=1,
        label=r"rotate the basis $\theta$ (degrees)", show_value=True, full_width=True,
    )
    rotate
    return (rotate,)


@app.cell
def demo_rotate(rotate):
    mo.vstack([theme(plot_rotate_coords(rotate.value)), rotate_equation(rotate.value)], align="center")
    return


@app.cell
def demo_basis_vectors(n):
    plot_basis_vectors(n)
    return


@app.cell
def demo_sum_equation(n, x):
    plot_sum_equation(x, n)
    return


@app.cell
def demo_matrix_equation(n, x):
    plot_matrix_equation(x, n)
    return


@app.cell
def demo_sparsity(n, x):
    plot_sparsity(x, n)
    return


@app.cell
def demo_partial_sums(n, x):
    plot_partial_sums(x, n)
    return


@app.cell
def ui_controls(n):
    keep_r = mo.ui.slider(1, n, value=4, label=r"terms kept $r$", show_value=True, full_width=True)
    basis_pick = mo.ui.radio(options=["Fourier", "DCT"], value="Fourier", label="basis", inline=True)
    mo.vstack([basis_pick, keep_r])
    return basis_pick, keep_r


@app.cell
def demo_keep(basis_pick, keep_r, n, x):
    plot_keep(x, n, basis_pick.value, keep_r.value)
    return


# --- numerics -------------------------------------------------------------


@app.function
def build_signal(n):
    """A smooth periodic signal built from a few pure cosines, so its Fourier expansion is exactly sparse."""
    t = np.linspace(0, 1, n, endpoint=False)
    return (
        0.5
        + 4.0 * np.cos(2 * np.pi * 1 * t)
        + 2.0 * np.cos(2 * np.pi * 3 * t)
        + 1.2 * np.cos(2 * np.pi * 6 * t)
    )


@app.function
def dct_basis(n):
    # Orthonormal DCT-II synthesis matrix; each column is a cosine of increasing
    # frequency. x = Psi @ s and s = Psi.T @ x, exactly.
    i = np.arange(n)
    k = np.arange(n)
    Psi = np.cos(np.pi * (2 * i[:, None] + 1) * k[None, :] / (2 * n))
    Psi[:, 0] *= np.sqrt(1 / n)
    Psi[:, 1:] *= np.sqrt(2 / n)
    return Psi


@app.function
def fourier_basis(n):
    # Real orthonormal Fourier basis: DC, then cos/sin pairs by rising frequency,
    # closing on the Nyquist wave. Columns are orthonormal for even n.
    t = np.arange(n) / n
    columns = [np.ones(n) / np.sqrt(n)]
    labels = ["DC"]
    for k in range(1, n // 2):
        columns.append(np.sqrt(2 / n) * np.cos(2 * np.pi * k * t))
        columns.append(np.sqrt(2 / n) * np.sin(2 * np.pi * k * t))
        labels += [rf"$\cos {k}$", rf"$\sin {k}$"]
    columns.append(np.cos(np.pi * np.arange(n)) / np.sqrt(n))
    labels.append("Nyq")
    return np.column_stack(columns), labels


@app.function
def coeffs_for_energy(s, frac=0.99):
    # How many of the largest-magnitude coordinates capture `frac` of the total energy.
    energy = np.sort(np.asarray(s, np.float64) ** 2)[::-1]
    total = energy.sum()
    if total == 0:
        return 0
    cumulative = np.cumsum(energy) / total
    return int(np.searchsorted(cumulative, frac) + 1)


@app.function
def keep_top(s, r):
    kept = np.zeros_like(s)
    order = np.argsort(np.abs(s))[::-1][:r]
    kept[order] = s[order]
    return kept


@app.function
def rotation(degrees):
    # The 2x2 change of basis: columns are the rotated basis vectors, so
    # v = B @ x_prime and x_prime = B.T @ v.
    theta = np.deg2rad(degrees)
    return np.array([[np.cos(theta), -np.sin(theta)], [np.sin(theta), np.cos(theta)]])


# --- figure styling -------------------------------------------------------


@app.function
def style_signal_axes(ax):
    ax.grid(True, alpha=0.25, linewidth=0.6)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)


@app.function
def theme(fig):
    # Transparent so the host page's background shows through and its own
    # light/dark styling is what the reader sees behind the figure.
    fig.patch.set_alpha(0)
    for ax in fig.axes:
        ax.patch.set_alpha(0)
    fig.tight_layout()
    return fig


@app.function
def draw_stem(ax, idx, vals, color, markersize=4):
    # markersize=0 drops the dots. Worth doing once the stems are dense enough
    # that the dots touch: they stop reading as samples and just add elements.
    # Every stem in ONE compound path. matplotlib's SVG backend emits a separate
    # <path> per segment for both ax.stem and a LineCollection, which at n = 64
    # across three panels is ~200 elements; a single Path of MOVETO/LINETO pairs
    # is one element for identical output.
    idx = np.asarray(idx, dtype=float)
    vals = np.asarray(vals, dtype=float)
    if idx.size:
        verts = np.empty((idx.size * 2, 2))
        verts[0::2, 0] = idx
        verts[0::2, 1] = 0.0
        verts[1::2, 0] = idx
        verts[1::2, 1] = vals
        codes = np.tile([Path.MOVETO, Path.LINETO], idx.size)
        ax.add_patch(
            PathPatch(Path(verts, codes), edgecolor=color, facecolor="none", linewidth=1.1)
        )
        if markersize:
            ax.plot(idx, vals, linestyle="none", marker="o", markersize=markersize, color=color)
    ax.axhline(0, color=color, linewidth=0.8, alpha=0.35)
    ax.autoscale_view()


@app.function
def blank(ax):
    ax.set_xticks([])
    ax.set_yticks([])
    for side in ("top", "right", "left", "bottom"):
        ax.spines[side].set_visible(False)


# --- figures --------------------------------------------------------------


@app.function
def plot_signal(x, n):
    t = np.linspace(0, 1, n, endpoint=False)
    fig, ax = plt.subplots(figsize=(9, 3.2))
    ax.plot(t, x, color=C_SIGNAL, linewidth=1.8)
    ax.set_xlabel("time")
    ax.set_ylabel("amplitude")
    ax.set_title("a signal", fontsize=11)
    style_signal_axes(ax)
    return theme(fig)


@app.function
def plot_signal_samples(x, n):
    i = np.arange(n)
    fig, ax = plt.subplots(figsize=(9, 3.2))
    draw_stem(ax, i, x, C_SIGNAL)
    ax.set_xlabel("sample index $i$")
    ax.set_ylabel("$x_i$")
    ax.set_title(rf"the same signal, sampled at n = {n} points", fontsize=11)
    style_signal_axes(ax)
    return theme(fig)


@app.function
def plot_rotate_coords(degrees, v_std=(1.0, 1.6)):
    # The interactive figure. `basis-rotation` in packages/explorables ships the
    # live version; this renders the static fallback at the same default angle.
    v_std = np.asarray(v_std, dtype=float)
    B = rotation(degrees)
    x_prime = B.T @ v_std

    fg = plt.rcParams.get("text.color", "black")
    e1p, e2p = B[:, 0], B[:, 1]
    foot1, foot2 = x_prime[0] * e1p, x_prime[1] * e2p
    L = 2.2
    fig, ax = plt.subplots(figsize=(5.4, 5.4))

    def axis(vec, color):
        ax.annotate(
            "", xy=vec * L, xytext=(0, 0), arrowprops=dict(arrowstyle="->", color=color, lw=1.6)
        )
        ax.plot([0, -vec[0] * L], [0, -vec[1] * L], color=color, lw=0.8, alpha=0.4)

    axis(np.array([1.0, 0.0]), C_SIGNAL)
    axis(np.array([0.0, 1.0]), C_SIGNAL)
    axis(e1p, C_ALT)
    axis(e2p, C_ALT)

    ax.plot([v_std[0], v_std[0]], [v_std[1], 0], color=C_SIGNAL, lw=1.0, ls="--", alpha=0.7)
    ax.plot([v_std[0], 0], [v_std[1], v_std[1]], color=C_SIGNAL, lw=1.0, ls="--", alpha=0.7)
    ax.plot([v_std[0], foot1[0]], [v_std[1], foot1[1]], color=C_ALT, lw=1.0, ls="--", alpha=0.7)
    ax.plot([v_std[0], foot2[0]], [v_std[1], foot2[1]], color=C_ALT, lw=1.0, ls="--", alpha=0.7)

    ax.annotate("", xy=v_std, xytext=(0, 0), arrowprops=dict(arrowstyle="->", color=fg, lw=2.6))

    ax.text(*(np.array([1.0, 0.0]) * L * 1.05), r"$\hat{e}_1$", color=C_SIGNAL, fontsize=11)
    ax.text(*(np.array([0.0, 1.0]) * L * 1.05), r"$\hat{e}_2$", color=C_SIGNAL, fontsize=11)
    ax.text(*(e1p * L * 1.05), r"$\hat{e}_1'$", color=C_ALT, fontsize=11)
    ax.text(*(e2p * L * 1.05), r"$\hat{e}_2'$", color=C_ALT, fontsize=11)
    ax.text(v_std[0] + 0.08, v_std[1] + 0.08, r"$\mathbf{V}$", color=fg, fontsize=13)

    ax.axhline(0, color=C_MUTED, lw=0.5, alpha=0.3)
    ax.axvline(0, color=C_MUTED, lw=0.5, alpha=0.3)
    ax.set_xlim(-L, L)
    ax.set_ylim(-L, L)
    ax.set_aspect("equal")
    blank(ax)
    return theme(fig)


@app.function
def rotate_equation(degrees, v_std=(1.0, 1.6)):
    v_std = np.asarray(v_std, dtype=float)
    B = rotation(degrees)
    x_prime = B.T @ v_std
    return mo.md(
        r"$$\underbrace{\begin{bmatrix} 1 & 0 \\ 0 & 1 \end{bmatrix}}_{[\,\hat{e}_1\ \ \hat{e}_2\,]}\,"
        r"\underbrace{\begin{bmatrix}"
        rf" {v_std[0]:.2f} \\ {v_std[1]:.2f}"
        r" \end{bmatrix}}_{\mathbf{x}} = "
        r"\underbrace{\begin{bmatrix}"
        rf" {B[0, 0]:.2f} & {B[0, 1]:.2f} \\ {B[1, 0]:.2f} & {B[1, 1]:.2f}"
        r" \end{bmatrix}}_{[\,\hat{e}_1'\ \ \hat{e}_2'\,]}\,"
        r"\underbrace{\begin{bmatrix}"
        rf" {x_prime[0]:.2f} \\ {x_prime[1]:.2f}"
        r" \end{bmatrix}}_{\mathbf{x}'}$$"
    )


@app.function
def plot_basis_vectors(n, cols=6):
    Psi_f, _ = fourier_basis(n)
    Psi_d = dct_basis(n)
    t = np.arange(n)
    fig, axes = plt.subplots(2, cols, figsize=(11, 3.0), sharex=True, sharey=True)
    for k in range(cols):
        axes[0, k].plot(t, Psi_f[:, k], color=C_WAVE, linewidth=1.4)
        axes[1, k].plot(t, Psi_d[:, k], color=C_WAVE, linewidth=1.4)
        axes[0, k].set_title(rf"$\boldsymbol{{\psi}}_{{{k + 1}}}$", fontsize=10)
    axes[0, 0].set_ylabel("Fourier", fontsize=10)
    axes[1, 0].set_ylabel("DCT", fontsize=10)
    for ax in axes.ravel():
        ax.axhline(0, color=C_MUTED, linewidth=0.6, alpha=0.5)
        blank(ax)
    return theme(fig)


@app.function
def plot_sum_equation(x, n, k_terms=3):
    Psi, _ = fourier_basis(n)
    s = Psi.T @ x
    order = np.argsort(np.abs(s))[::-1]
    idx = np.arange(n)
    fig, axes = plt.subplots(
        1, 1 + k_terms, figsize=(9, 3.4), sharey=True, gridspec_kw={"wspace": 0.7}
    )

    def vplot(ax, vals, color):
        ax.plot(vals, idx, color=color, linewidth=1.6)
        ax.axvline(0, color=C_MUTED, linewidth=0.6, alpha=0.4)
        blank(ax)

    vplot(axes[0], x, C_SIGNAL)
    axes[0].invert_yaxis()
    axes[0].set_title(r"$\mathbf{x}$", fontsize=13)

    for j in range(k_terms):
        k = order[j]
        vplot(axes[j + 1], s[k] * Psi[:, k], C_WAVE)
        axes[j + 1].set_title(rf"$s_{{{j + 1}}}\,\boldsymbol{{\psi}}_{{{j + 1}}}$", fontsize=13)
        op = "=" if j == 0 else "+"
        axes[j + 1].text(
            -0.35, 0.5, op, transform=axes[j + 1].transAxes,
            ha="center", va="center", fontsize=17, clip_on=False,
        )
    axes[-1].text(
        1.25, 0.5, r"$+\ \cdots$", transform=axes[-1].transAxes,
        ha="center", va="center", fontsize=15, clip_on=False,
    )
    return theme(fig)


@app.function
def plot_matrix_equation(x, n):
    Psi, _ = fourier_basis(n)
    s = Psi.T @ x
    fig, (ax_x, ax_p, ax_s) = plt.subplots(
        1, 3, figsize=(6.8, 4.2), gridspec_kw={"width_ratios": [1, 9, 1], "wspace": 0.55}
    )

    def strip(ax, m, title):
        peak = np.abs(m).max()
        ax.imshow(m, cmap="RdBu_r", vmin=-peak, vmax=peak, aspect="auto", interpolation="nearest")
        ax.set_title(title, fontsize=13)
        ax.set_xticks([])
        ax.set_yticks([])

    strip(ax_x, x[:, None], r"$\mathbf{x}$")
    strip(ax_p, Psi, r"$\Psi$")
    strip(ax_s, s[:, None], r"$\mathbf{s}$")
    ax_p.text(
        -0.10, 0.5, "=", transform=ax_p.transAxes,
        ha="center", va="center", fontsize=17, clip_on=False,
    )
    ax_p.text(
        1.06, 0.5, r"$\times$", transform=ax_p.transAxes,
        ha="center", va="center", fontsize=15, clip_on=False,
    )
    return theme(fig)


@app.function
def plot_sparsity(x, n):
    coords = {
        "standard": x,
        "DCT": dct_basis(n).T @ x,
        "Fourier": fourier_basis(n)[0].T @ x,
    }
    colors = {"standard": C_SIGNAL, "DCT": C_WAVE, "Fourier": C_ALT}
    idx = np.arange(n)
    fig, axes = plt.subplots(1, 3, figsize=(11, 3.0), sharey=True)
    for ax, (name, s) in zip(axes, coords.items()):
        draw_stem(ax, idx, s, colors[name], markersize=0)
        ax.set_title(
            rf"$\mathbf{{s}}$ in {name} — {coeffs_for_energy(s)} coords for 99% energy", fontsize=10
        )
        ax.set_xlabel("coordinate $k$")
        style_signal_axes(ax)
    axes[0].set_ylabel("value")
    return theme(fig)


@app.function
def plot_partial_sums(x, n, steps=(1, 2, 3, 4)):
    Psi, _ = fourier_basis(n)
    s = Psi.T @ x
    i = np.arange(n)
    fig, axes = plt.subplots(1, len(steps), figsize=(11, 2.6), sharey=True)
    for ax, r in zip(axes, steps):
        recon = Psi @ keep_top(s, r)
        err = np.linalg.norm(x - recon) / np.linalg.norm(x)
        ax.plot(i, x, color=C_MUTED, linewidth=1.0, alpha=0.6, zorder=1)
        ax.plot(i, recon, color=C_WAVE, linewidth=1.8, zorder=2)
        ax.set_title(rf"$r={r}$   (error {err:.0%})", fontsize=10)
        ax.set_xticks([])
        ax.set_yticks([])
        style_signal_axes(ax)
    return theme(fig)


@app.function
def compress(x, n, basis_name, r):
    Psi = dct_basis(n) if basis_name == "DCT" else fourier_basis(n)[0]
    s = Psi.T @ x
    s_kept = keep_top(s, r)
    recon = Psi @ s_kept
    error = float(np.linalg.norm(x - recon) / np.linalg.norm(x))
    energy = float(np.sum(s_kept**2) / np.sum(s**2))
    return s, s_kept, recon, error, energy


@app.function
def plot_keep(x, n, basis_name, r):
    s, s_kept, recon, _, _ = compress(x, n, basis_name, r)
    i = np.arange(n)
    fig, (ax_sig, ax_coef) = plt.subplots(1, 2, figsize=(11, 3.4))

    ax_sig.plot(i, x, color=C_MUTED, linewidth=1.2, alpha=0.6, label="original", zorder=1)
    ax_sig.plot(i, recon, color=C_WAVE, linewidth=1.9, label="reconstruction", zorder=2)
    ax_sig.set_title("signal", fontsize=11)
    ax_sig.set_xlabel("sample index $i$")
    ax_sig.legend(frameon=False, fontsize=9)
    style_signal_axes(ax_sig)

    kept_mask = s_kept != 0
    draw_stem(ax_coef, i[~kept_mask], s[~kept_mask], C_MUTED, markersize=3)
    draw_stem(ax_coef, i[kept_mask], s[kept_mask], C_ALT, markersize=4)
    ax_coef.set_title(rf"{basis_name} coordinates — top {r} kept", fontsize=11)
    ax_coef.set_xlabel("coordinate $k$")
    style_signal_axes(ax_coef)
    return theme(fig)


if __name__ == "__main__":
    app.run()
