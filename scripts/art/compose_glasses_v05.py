"""Rebuild round-glasses_v05: the approved Koa Master, byte for byte, with only v04's glasses frame on it.

Phase 11 Step 2 (docs/phase-11/step-2-round-glasses.md §9). v04 (an ImageGen candidate) drew the right
glasses but re-rendered all of Koa. v05 keeps every Master pixel and takes only v04's frame pixels.
Nothing is drawn: every changed pixel's color is a v04 frame pixel.

  1. Align v04 to the Master with the pipeline's own alignment (make_accessory.align / affine).
  2. Frame pixels: v04 pixels in the frame's colors (hue <= 50 deg, saturation >= 0.33, value 0.10-0.60,
     opaque), inside the glasses' allowed region and outside 58 px discs around the eye centres (the
     irises are just as saturated). After a 1-step opening, the largest connected piece is kept: both
     rims joined by the bridge. Any other piece (v04's own redrawn nose) is Koa, not glasses, and is dropped.
  3. Edges: coverage is the frame's own shape softened by 0.8 px; edge pixels take the color of the
     nearest frame pixel, so no v04 fur, blush, nose or eye pixel is copied.
  4. Compose over the Master. The Master's alpha everywhere, and its exact bytes outside the frame.

Inputs (tracked): art/master/koa_idle_neutral.master.png, art/accessories/candidates/round-glasses_v04.png.

Usage:  python -I scripts/art/compose_glasses_v05.py [--out PATH] [--check]
        --check compares the result with the tracked art/accessories/candidates/round-glasses_v05.png.
This script only rebuilds the candidate; it never changes the extraction pipeline or its checks.
"""
import argparse
import hashlib
import importlib.util
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
V04 = ROOT / "art" / "accessories" / "candidates" / "round-glasses_v04.png"
V05 = ROOT / "art" / "accessories" / "candidates" / "round-glasses_v05.png"

# The Master's eye centres (source px, docs/phase-11/step-2-round-glasses.md §2) and the radius kept
# free of frame pixels around them (§9).
EYE_CENTRES = ((383, 841), (646, 841))
EYE_FREE_RADIUS = 58
# v04's alignment as recorded when v05 was approved (§8); the pipeline must still find exactly this.
V04_ALIGNMENT = (1.005, 0, 0)


def load_pipeline():
    spec = importlib.util.spec_from_file_location("make_accessory", HERE / "make_accessory.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def compose(ma):
    master = np.array(Image.open(ma.MASTER).convert("RGBA"))
    v04 = ma.load_rgba(V04)
    v04_a, _ = ma.candidate_alpha(v04)
    _, scale, dx, dy = ma.align(ma.load_rgba(ma.MASTER), v04, v04_a)
    if (round(float(scale), 3), dx, dy) != V04_ALIGNMENT:
        sys.exit(f"v04 now aligns at scale {scale:.3f}, shift ({dx}, {dy}); v05 was built at {V04_ALIGNMENT}")
    aligned = ma.affine(v04, scale, dx, dy)

    hue, sat = ma.hue_sat(aligned[..., :3])
    val = aligned[..., :3].max(-1) / 255
    h, w = sat.shape
    yy, xx = np.mgrid[0:h, 0:w]
    zone = np.zeros((h, w), bool)
    x0, y0, x1, y1 = ma.ITEMS["round-glasses"]["region"]
    zone[y0:y1, x0:x1] = True
    eyes = np.zeros((h, w), bool)
    for cx, cy in EYE_CENTRES:
        eyes |= np.hypot(xx - cx, yy - cy) < EYE_FREE_RADIUS

    frame_color = (hue <= 50) & (sat >= 0.33) & (val >= 0.10) & (val <= 0.60) & (aligned[..., 3] > 250)
    core = ndimage.binary_opening(frame_color & zone & ~eyes, iterations=1)
    labels, n = ndimage.label(core)
    if n == 0:
        sys.exit("no frame pixels found in v04")
    sizes = ndimage.sum(core, labels, range(1, n + 1))
    keep = int(np.argmax(sizes)) + 1
    core = labels == keep
    dropped = sorted((int(s) for i, s in enumerate(sizes) if i + 1 != keep), reverse=True)

    cov = np.clip(ndimage.gaussian_filter(core.astype(np.float64), 0.8) * 2, 0, 1)
    cov[core] = 1.0
    cov[~zone | eyes] = 0.0
    cov[cov < 0.02] = 0.0
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    frame_rgb = aligned[iy, ix, :3]

    out = master.astype(np.float64)
    out[..., :3] = cov[..., None] * frame_rgb + (1 - cov[..., None]) * master[..., :3]
    out[..., 3] = master[..., 3]
    v05 = np.clip(np.rint(out), 0, 255).astype(np.uint8)
    v05[cov == 0] = master[cov == 0]

    # Master preservation, checked on the result itself.
    differs = np.any(v05 != master, axis=-1)
    assert not (differs & (cov == 0)).any(), "a pixel outside the frame differs from the Master"
    assert (v05[..., 3] == master[..., 3]).all(), "the alpha channel differs from the Master"
    print(f"v04 alignment: scale {scale:.3f}, shift ({dx}, {dy})")
    print(f"frame piece kept: {int(sizes.max())} px; dropped pieces: {dropped}")
    print(f"pixels differing from the Master: {int(differs.sum())}, all inside the frame "
          f"({int((cov > 0).sum())} px with coverage); alpha identical to the Master")
    return v05


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=V05)
    parser.add_argument("--check", action="store_true", help="compare the result with the tracked v05")
    args = parser.parse_args()
    v05 = compose(load_pipeline())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(v05, "RGBA").save(args.out)
    print(f"written: {args.out}")
    if args.check:
        tracked = np.array(Image.open(V05).convert("RGBA"))
        same_px = np.array_equal(tracked, v05)
        same_bytes = hashlib.sha256(args.out.read_bytes()).digest() == hashlib.sha256(V05.read_bytes()).digest()
        print(f"identical to the tracked v05: pixels {same_px}, file bytes {same_bytes}")
        if not same_px:
            sys.exit(1)


if __name__ == "__main__":
    main()
