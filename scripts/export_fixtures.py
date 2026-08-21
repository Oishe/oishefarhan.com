# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "scipy"]
# ///
"""Dump known-good numpy/scipy outputs for the TypeScript port to assert against.

Every function ported out of `notebooks/` gets a case here *before* it gets a
widget. The fixtures are committed; `just fixture-drift` fails CI if the Python
reference moves without someone saying why.

Scope so far: `01_signal_is_a_vector.py`. The helpers below are copied from that
notebook verbatim rather than imported, so a fixture regeneration cannot silently
follow a notebook edit — a drift here is a diff someone has to look at.
"""

import json
import pathlib

import numpy as np
from scipy.fft import dct, fft, idct

OUT = pathlib.Path(__file__).resolve().parents[1] / "packages/explorables/test/fixtures"

# Fixed seed. Fixtures must be byte-reproducible or the drift check is noise.
rng = np.random.default_rng(0)

# 24 and 100 are not powers of two: they exercise the Bluestein path in fft.ts.
SIZES = (16, 24, 64, 100, 256)
BASIS_SIZES = (8, 16, 24)


# --- verbatim from notebooks/01_signal_is_a_vector.py ----------------------


def build_signal(n):
    t = np.linspace(0, 1, n, endpoint=False)
    return (
        0.5
        + 4.0 * np.cos(2 * np.pi * 1 * t)
        + 2.0 * np.cos(2 * np.pi * 3 * t)
        + 1.2 * np.cos(2 * np.pi * 6 * t)
    )


def dct_basis(n):
    i = np.arange(n)
    k = np.arange(n)
    Psi = np.cos(np.pi * (2 * i[:, None] + 1) * k[None, :] / (2 * n))
    Psi[:, 0] *= np.sqrt(1 / n)
    Psi[:, 1:] *= np.sqrt(2 / n)
    return Psi


def fourier_basis(n):
    t = np.arange(n) / n
    columns = [np.ones(n) / np.sqrt(n)]
    for k in range(1, n // 2):
        columns.append(np.sqrt(2 / n) * np.cos(2 * np.pi * k * t))
        columns.append(np.sqrt(2 / n) * np.sin(2 * np.pi * k * t))
    columns.append(np.cos(np.pi * np.arange(n)) / np.sqrt(n))
    return np.column_stack(columns)


def coeffs_for_energy(s, frac=0.99):
    energy = np.sort(np.asarray(s, np.float64) ** 2)[::-1]
    total = energy.sum()
    if total == 0:
        return 0
    cumulative = np.cumsum(energy) / total
    return int(np.searchsorted(cumulative, frac) + 1)


def keep_top(s, r):
    kept = np.zeros_like(s)
    order = np.argsort(np.abs(s))[::-1][:r]
    kept[order] = s[order]
    return kept


# --- fixture assembly ------------------------------------------------------


def case(x: np.ndarray, **outputs) -> dict:
    return {
        "input": np.asarray(x).ravel().tolist(),
        **{k: (v.ravel().tolist() if isinstance(v, np.ndarray) else v) for k, v in outputs.items()},
    }


def main() -> None:
    fixtures: dict[str, dict] = {}

    for n in SIZES:
        x = rng.standard_normal(n)
        spectrum = fft(x)
        fixtures[f"fft_{n}"] = case(x, re=spectrum.real, im=spectrum.imag)
        fixtures[f"dct_{n}"] = case(x, expect=dct(x, type=2, norm="ortho"))
        # Same array read as coefficients, so DCT-III is checked against scipy
        # directly and not only through a round trip.
        fixtures[f"idct_{n}"] = case(x, expect=idct(x, type=2, norm="ortho"))

    for n in BASIS_SIZES:
        # Row-major, matching the Float64Array layout in dct.ts / fourier.ts.
        fixtures[f"dct_basis_{n}"] = case(np.array([n], dtype=np.float64), expect=dct_basis(n))
        fixtures[f"fourier_basis_{n}"] = case(
            np.array([n], dtype=np.float64), expect=fourier_basis(n)
        )

    for n in (16, 64):
        x = build_signal(n)
        fixtures[f"build_signal_{n}"] = case(np.array([n], dtype=np.float64), expect=x)

        s = dct(x, type=2, norm="ortho")
        energy = np.sort(s**2)[::-1]
        fixtures[f"energy_curve_{n}"] = case(
            s, energy=energy, cumulative=np.cumsum(energy) / energy.sum()
        )
        fixtures[f"coeffs_for_energy_{n}"] = case(
            s, fracs=[0.5, 0.9, 0.99], expect=[coeffs_for_energy(s, f) for f in (0.5, 0.9, 0.99)]
        )
        for r in (0, 1, 4, n // 2, n):
            fixtures[f"keep_top_{n}_{r}"] = case(s, r=r, expect=keep_top(s, r))

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "dsp.json").write_text(json.dumps(fixtures, indent=1) + "\n")
    print(f"wrote {len(fixtures)} fixtures to {OUT / 'dsp.json'}")


if __name__ == "__main__":
    main()
