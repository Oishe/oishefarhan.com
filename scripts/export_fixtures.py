# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "scipy"]
# ///
"""Dump known-good numpy/scipy outputs for the TypeScript port to assert against.

Every function ported out of `notebooks/` gets a case here *before* it gets a
widget. The fixtures are committed; `just fixture-drift` fails CI if the Python
reference moves without someone saying why.
"""

import json
import pathlib

import numpy as np

OUT = pathlib.Path(__file__).resolve().parents[1] / "packages/explorables/test/fixtures"

# Fixed seed. Fixtures must be byte-reproducible or the drift check is noise.
rng = np.random.default_rng(0)

SIZES = (16, 64, 256)


def case(x: np.ndarray, **outputs: np.ndarray) -> dict:
    return {"input": x.tolist(), **{k: v.tolist() for k, v in outputs.items()}}


def main() -> None:
    fixtures: dict[str, dict] = {}

    # Phase 1 fills this in: dct/idct, fft, dwt(db4), threshold_keep,
    # energy_curve, psnr, mse — each ported from notebooks/ with a case here.
    for n in SIZES:
        x = rng.standard_normal(n)
        fixtures[f"identity_{n}"] = case(x, expect=x)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "dsp.json").write_text(json.dumps(fixtures, indent=1) + "\n")
    print(f"wrote {len(fixtures)} fixtures to {OUT / 'dsp.json'}")


if __name__ == "__main__":
    main()
