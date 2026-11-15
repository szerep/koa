"""Turn an ImageGen accessory candidate into an app overlay, check it, export it and build a review sheet.

Phase 11 (docs/phase-11/step-1-beanie.md). An accessory candidate is an EDIT of the approved Koa
Master (the same 1024x1536 image, now wearing the item). This script never draws anything: every
overlay pixel is a candidate pixel. It only cuts the item out, aligns it to the Master and exports it.

  extract  <item> <candidate.png>   ->  art/accessories/<item>@idle.master.png (Master pixel space)
                                        art/review-phase11/<item>_extract.png (debug panels)
  export   <item>                   ->  art/accessories/<item>@idle.normalized.png (house grid)
                                        public/characters/accessories/<item>@idle.webp (+ -512)
  review   <item>                   ->  art/review-phase11/<item>_review.png (for approval)

Every step re-runs the checks; any failure exits non-zero and writes nothing to public/.

Checks (all must pass):
  - eyes: the overlay is fully transparent where the blink frame differs from the Master, so the
    idle and blink frames both show their eyes and the blink stays readable;
  - region: the overlay stays inside the item's allowed region (a hat stays above the eyes);
  - tuft: hats cover the crown tuft (character bible: "Hats must sit over the crown tuft");
  - not cropped: nothing touches the canvas edges;
  - alignment: the candidate's body (which the edit must not change) matches the Master.

Usage:  python -I scripts/art/make_accessory.py extract beanie art/accessories/candidates/beanie_v01.png
        python -I scripts/art/make_accessory.py export beanie
        python -I scripts/art/make_accessory.py review beanie
Options: --art-dir, --public-dir, --review-dir (used to dry-run the pipeline outside the repo).
"""
import argparse
import importlib.util
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
MASTER_DIR = ROOT / "art" / "master"
MASTER = MASTER_DIR / "koa_idle_neutral.master.png"
MASTER_BLINK = MASTER_DIR / "koa_idle_blink.master.png"
NORMALIZED = MASTER_DIR / "koa_idle_neutral.normalized.png"
NORMALIZED_BLINK = MASTER_DIR / "koa_idle_blink.normalized.png"

CREAM = (249, 238, 225)  # --cream-100
DARK = (52, 44, 40)      # a dark review background (not an app color)

# Per item, in Master (source) pixels. Only the items being produced are listed (Phase 11: two).
ITEMS = {
    "beanie": {
        "kind": "hat",
        # Allowed region: between the outer ear rims, from the canvas top down to just above the
        # brows. The blink edit starts at y = 795, so a hat can never reach the eyes.
        "region": (150, 0, 874, 790),
        # The item's own color family (hue in degrees, minimum saturation): sage knit.
        "hue": (35, 120),
        "min_sat": 0.14,
        "swatch": (0x8D, 0xA4, 0x7C),  # catalog swatch (src/config/catalog.ts), compared only
    },
    # Phase 11 Step 2 (docs/phase-11/step-2-round-glasses.md §4, approved 2026-11-13).
    "round-glasses": {
        "kind": "glasses",
        # Allowed region: across the face between the cheeks, from below the brows to above the
        # mouth. Rims around the eyes fit inside; arms reaching for the ears or frames climbing
        # into the brows fail the region check instead of being cut.
        "region": (230, 740, 795, 940),
        # The frame's color family: warm dark brown (#3a2b22 is hue 22°, saturation 0.41).
        "hue": (0, 50),
        "min_sat": 0.18,
        "swatch": (0x3A, 0x2B, 0x22),
        # Review close-up on the house grid (y0, y1, x0, x1): the face, eyes at y 821.
        "closeup": (640, 1010, 170, 854),
        # A hollow outline: the lens openings are holes in the frame, not part of the item, so the
        # cut never fills enclosed regions, keeps only changed pixels, and on a Master-preserved
        # candidate counts every exact difference from the Master as changed (see cut_item and
        # exact_changes). Every check is the same as for the beanie.
        "hollow": True,
    },
}
# The review close-up for items without their own: the head (house grid y0, y1, x0, x1).
HEAD_CLOSEUP = (380, 900, 170, 854)
TUFT_BOX = (420, 530, 620, 640)  # the crown tuft and the top of the crown, Master pixels


# ----------------------------------------------------------------------------------------- helpers

def load_rgba(path):
    return np.array(Image.open(path).convert("RGBA")).astype(np.float64)


def to_image(arr):
    return Image.fromarray(np.clip(np.rint(arr), 0, 255).astype(np.uint8), "RGBA")


def blink_region(neutral, blink, margin=4):
    """Pixels where the blink frame differs from the open-eye frame, grown by a margin."""
    diff = np.any(np.abs(neutral - blink) > 0, axis=-1)
    return ndimage.binary_dilation(diff, iterations=margin)


def hue_sat(rgb):
    r, g, b = (rgb[..., i] / 255.0 for i in range(3))
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    delta = mx - mn
    sat = np.where(mx > 0, delta / np.maximum(mx, 1e-9), 0)
    safe = np.maximum(delta, 1e-9)
    hue = np.where(
        mx == r, ((g - b) / safe) % 6, np.where(mx == g, (b - r) / safe + 2, (r - g) / safe + 4)
    ) * 60
    return np.where(delta > 0, hue, 0), sat


def candidate_alpha(cand):
    """True alpha if the candidate has it; otherwise key out a flat background (gate 0 §5)."""
    alpha = cand[..., 3]
    if (alpha < 250).mean() > 0.05:
        return alpha / 255.0, "alpha channel"
    h, w = alpha.shape
    corners = np.concatenate([
        cand[:32, :32, :3].reshape(-1, 3), cand[:32, w - 32:, :3].reshape(-1, 3),
        cand[h - 32:, :32, :3].reshape(-1, 3), cand[h - 32:, w - 32:, :3].reshape(-1, 3),
    ])
    bg = np.median(corners, axis=0)
    dist = np.max(np.abs(cand[..., :3] - bg), axis=-1)
    keyed = np.clip((dist - 8) / 22.0, 0, 1)
    # Only background connected to the border is removed (a cream pom-pom must survive).
    outside = ndimage.label(keyed < 0.5)[0]
    border_labels = set(np.unique(np.concatenate([outside[0], outside[-1], outside[:, 0], outside[:, -1]]))) - {0}
    is_bg = np.isin(outside, list(border_labels))
    return np.where(is_bg, keyed, 1.0), f"keyed background rgb{tuple(int(v) for v in bg)}"


def affine(img_arr, scale, dx, dy, center=(512, 1400)):
    """Resample so that out(p) = in(center + (p - center) * scale - (dx, dy))."""
    cx, cy = center
    coeffs = (scale, 0, cx - cx * scale - dx, 0, scale, cy - cy * scale - dy)
    img = to_image(img_arr)
    out = img.transform(img.size, Image.AFFINE, coeffs, resample=Image.BICUBIC, fillcolor=(0, 0, 0, 0))
    return np.array(out).astype(np.float64)


def flat_gray(arr, alpha):
    gray = arr[..., :3].mean(axis=-1)
    return gray * alpha + 128 * (1 - alpha)


def align(master, cand, cand_a, body_rows=(980, 1500)):
    """Find the scale and shift that best map the candidate's body onto the Master's body."""
    y0, y1 = body_rows
    m_gray = flat_gray(master, master[..., 3] / 255.0)[y0:y1:2, ::2]
    rgba = cand.copy()
    rgba[..., 3] = cand_a * 255
    best = (np.inf, 1.0, 0, 0)
    for scale in np.arange(0.97, 1.0301, 0.005):
        scaled = affine(rgba, scale, 0, 0)
        c_gray = flat_gray(scaled, scaled[..., 3] / 255.0)[::2, ::2]
        for sy in range(-12, 13):
            rows = c_gray[(y0 // 2) - sy:(y1 // 2) - sy]
            for sx in range(-12, 13):
                err = np.abs(np.roll(rows, sx, axis=1) - m_gray).mean()
                if err < best[0]:
                    best = (err, scale, sx * 2, sy * 2)
    _, scale, dx, dy = best
    # Refine the shift at full resolution.
    m_full = flat_gray(master, master[..., 3] / 255.0)[y0:y1]
    for ddy in range(-2, 3):
        for ddx in range(-2, 3):
            moved = affine(rgba, scale, dx + ddx, dy + ddy)
            err = np.abs(flat_gray(moved, moved[..., 3] / 255.0)[y0:y1] - m_full).mean()
            if err < best[0]:
                best = (err, scale, dx + ddx, dy + ddy)
    return best


def checker(h, w, size=24):
    yy, xx = np.mgrid[0:h, 0:w]
    tile = ((yy // size + xx // size) % 2).astype(np.float64)
    g = 200 + 40 * tile
    return np.dstack([g, g, g, np.full((h, w), 255.0)])


def over(top, bottom):
    """Alpha-composite two float RGBA arrays (0..255)."""
    return np.array(Image.alpha_composite(to_image(bottom), to_image(top))).astype(np.float64)


def flat(color, h, w):
    return np.dstack([np.full((h, w), float(c)) for c in color] + [np.full((h, w), 255.0)])


# ------------------------------------------------------------------------------------------ checks

def check_overlay(item, overlay, neutral, blink, transform=None):
    """Return a list of failures for an overlay in the pixel space of `neutral`/`blink`."""
    cfg = ITEMS[item]
    alpha = overlay[..., 3] / 255.0
    failures = []
    h, w = alpha.shape
    if (alpha > 0).sum() < 2000:
        failures.append("the overlay is almost empty")
    eyes = blink_region(neutral, blink)
    if (alpha[eyes] > 0).any():
        failures.append(f"eyes: the overlay covers {(alpha[eyes] > 0).sum()} px of the blink region")
    x0, y0, x1, y1 = cfg["region"]
    if transform:
        x0, y0, x1, y1 = transform(x0, y0, x1, y1)
    allowed = np.zeros_like(alpha, bool)
    allowed[max(0, int(y0)):int(y1), max(0, int(x0)):int(x1)] = True
    if (alpha[~allowed] > 0).any():
        failures.append(f"region: {(alpha[~allowed] > 0).sum()} px outside the allowed region")
    edge = np.concatenate([alpha[:2].ravel(), alpha[-2:].ravel(), alpha[:, :2].ravel(), alpha[:, -2:].ravel()])
    if (edge > 0).any():
        failures.append("not cropped: the overlay touches the canvas edge")
    if cfg["kind"] == "hat":
        tx0, ty0, tx1, ty1 = transform(*TUFT_BOX) if transform else TUFT_BOX
        box = (slice(int(ty0), int(ty1)), slice(int(tx0), int(tx1)))
        fur = neutral[box][..., 3] > 128
        covered = alpha[box][fur] >= 0.95
        share = covered.mean() if fur.any() else 1.0
        if share < 0.97:
            failures.append(f"tuft: only {share:.0%} of the crown tuft is covered (needs 97%)")
    return failures


def color_report(item, overlay):
    alpha = overlay[..., 3]
    px = overlay[alpha > 250][:, :3]
    med = np.median(px, axis=0) if len(px) else np.zeros(3)
    sw = np.array(ITEMS[item]["swatch"], float)
    return f"median rgb{tuple(int(v) for v in med)} vs catalog swatch rgb{tuple(int(v) for v in sw)}"


# ------------------------------------------------------------------------------------------ extract

def region_mask(cfg, shape):
    x0, y0, x1, y1 = cfg["region"]
    region = np.zeros(shape, bool)
    region[y0:y1, x0:x1] = True
    return region


def exact_changes(cfg, cand, master, scale, dx, dy, resized):
    """Hollow items only: pixels where a Master-preserved candidate differs from the Master at all.

    A frame crossing a part of the Master in its own colors (the glasses' bridge over the dark nose)
    can differ by less than the 28-level threshold. When the candidate sits on the Master exactly
    (same size, alignment scale 1 and no shift), the raw candidate is compared with the Master byte
    for byte (RGBA), so any genuine edit counts. Comparing the resampled candidate instead would
    count resampling noise. Returns None (threshold only) for solid items or any other alignment.
    """
    if not cfg.get("hollow", False) or resized or scale != 1.0 or dx != 0 or dy != 0:
        return None
    return np.any(cand != master, axis=-1)


def cut_item(cfg, changed, item_color, a_c):
    """Cut the item out of the aligned candidate: returns (solid mask, overlay alpha 0..1), or None.

    `changed` marks pixels that differ from the Master, `item_color` pixels in the item's colors,
    `a_c` is the candidate's alpha. A solid item (the beanie) has its enclosed regions filled, so
    knit texture that happens to match the fur can't punch holes in it. A hollow item
    (`"hollow": True`, the round glasses) is an outline: enclosed regions (the lens openings) are
    left alone and only changed pixels are kept, so the Master shows through the openings; its
    edge feather stays on those pixels, so no unchanged Master pixel joins the overlay.
    """
    hollow = cfg.get("hollow", False)
    fill = (lambda m: m) if hollow else ndimage.binary_fill_holes
    region = region_mask(cfg, changed.shape)
    core = changed & item_color & region
    core = ndimage.binary_opening(core, iterations=2)
    core = ndimage.binary_closing(core, iterations=6)
    labels, n = ndimage.label(core)
    if n == 0:
        return None
    sizes = ndimage.sum(core, labels, range(1, n + 1))
    keep = [i + 1 for i, s in enumerate(sizes) if s >= max(800, 0.02 * sizes.max())]
    solid = fill(np.isin(labels, keep))
    # Grow a little into the changed, non-fur edge pixels (knit shading, the brim's dark rim).
    grown = ndimage.binary_dilation(solid, iterations=3) & changed & region
    solid = fill(solid | grown) & region & (a_c > 0.02)
    if hollow:
        # Only pixels the edit actually changed: the closing never bridges unchanged Master pixels in.
        solid &= changed
    soft = ndimage.gaussian_filter(solid.astype(np.float64), 0.9)
    soft = np.where(ndimage.binary_erosion(solid, iterations=2), 1.0, soft)
    out_a = np.clip(soft, 0, 1) * a_c
    out_a[~region] = 0
    if hollow:
        out_a[~solid] = 0
    # The eye region is never cleared here: an item over the eyes must fail the check, not get a hole.
    return solid, out_a


def extract(item, candidate_path, art_dir, review_dir):
    cfg = ITEMS[item]
    master = load_rgba(MASTER)
    blink = load_rgba(MASTER_BLINK)
    cand_img = Image.open(candidate_path).convert("RGBA")
    resized = cand_img.size != (1024, 1536)
    if resized:
        ratio = cand_img.size[0] / cand_img.size[1]
        if abs(ratio - 1024 / 1536) > 0.005:
            sys.exit(f"candidate is {cand_img.size}; it must be a 2:3 portrait edit of the Master")
        cand_img = cand_img.resize((1024, 1536), Image.LANCZOS)
    cand = np.array(cand_img).astype(np.float64)
    cand_a, alpha_source = candidate_alpha(cand)

    err, scale, dx, dy = align(master, cand, cand_a)
    print(f"[{item}] candidate alpha: {alpha_source}")
    print(f"[{item}] alignment: scale {scale:.3f}, shift ({dx}, {dy}) px, body mismatch {err:.1f} gray levels")
    if err > 14:
        print("  WARNING: the body doesn't match the Master well; the edit may have redrawn the whole koala.")

    rgba = cand.copy()
    rgba[..., 3] = cand_a * 255
    aligned = affine(rgba, scale, dx, dy)
    a_c = aligned[..., 3] / 255.0
    a_m = master[..., 3] / 255.0

    lo, hi = cfg["hue"]

    def is_item_color(rgb):
        hue, sat = hue_sat(rgb)
        return (hue >= lo) & (hue <= hi) & (sat >= cfg["min_sat"])

    item_color = is_item_color(aligned[..., :3])
    # Changed = clearly different from the Master, or newly in the item's colors (sage can be
    # within a few levels of the warm grey fur per channel while its hue is entirely different).
    diff = np.max(np.abs(aligned[..., :3] - master[..., :3]), axis=-1)
    newly_item = item_color & ~(is_item_color(master[..., :3]) & (a_m > 0.5))
    changed = (((diff > 28) | newly_item) & (a_c > 0.5)) | ((a_c > 0.5) & (a_m < 0.5))
    # Hollow items on a Master-preserved candidate: the pixels that actually differ from the Master
    # replace the thresholded (resampled) comparison. Every pixel over the threshold differs exactly
    # too, and no unchanged Master pixel can be picked by resampling noise. The spill check below
    # keeps using `changed` exactly as before.
    picked = changed
    exact = exact_changes(cfg, cand, master, scale, dx, dy, resized)
    if exact is not None:
        picked = exact & (a_c > 0.5)
        print(f"[{item}] exact Master comparison: {int(exact.sum())} px differ from the Master "
              f"({int((picked & ~changed).sum())} of them not picked by the 28-level threshold)")
    elif cfg.get("hollow", False):
        print(f"[{item}] exact Master comparison: not available (the candidate doesn't sit on the "
              f"Master exactly); the 28-level threshold applies")

    region = region_mask(cfg, changed.shape)
    cut = cut_item(cfg, picked, item_color, a_c)
    if cut is None:
        sys.exit(f"[{item}] no {item} pixels found in the candidate (is it an edit of the Master?)")
    solid, out_a = cut

    overlay = aligned.copy()
    overlay[..., 3] = out_a * 255
    overlay[out_a <= 0.01] = 0

    failures = check_overlay(item, overlay, master, blink)
    # The region only limits the cut; it must never hide an item that runs past it (over the eyes).
    whole = ndimage.binary_opening(changed & item_color, iterations=2)
    whole_labels, _ = ndimage.label(whole)
    touching = np.unique(whole_labels[solid & whole])
    spill = np.isin(whole_labels, touching[touching > 0]) & ~region
    if spill.sum() > 200:
        ys, xs = np.nonzero(spill)
        failures.append(f"region: the {item} continues {spill.sum()} px past its allowed region "
                        f"(x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()})")
    print(f"[{item}] {color_report(item, overlay)}")

    review_dir.mkdir(parents=True, exist_ok=True)
    h, w = master.shape[:2]
    mask_view = flat((0, 0, 0), h, w)
    mask_view[picked] = [90, 90, 90, 255]
    mask_view[solid] = [141, 164, 124, 255]
    panels = [
        over(aligned, checker(h, w)),
        mask_view,
        over(overlay, checker(h, w)),
        over(overlay, over(master, flat(CREAM, h, w))),
    ]
    sheet = np.concatenate([p[380:1000] for p in panels], axis=1)
    to_image(sheet).convert("RGB").save(review_dir / f"{item}_extract.png")
    print(f"[{item}] debug panels: {review_dir / f'{item}_extract.png'} (aligned candidate | changed + kept | overlay | over the Master)")

    if failures:
        for f in failures:
            print(f"  FAIL {f}")
        sys.exit(1)
    art_dir.mkdir(parents=True, exist_ok=True)
    out = art_dir / f"{item}@idle.master.png"
    to_image(overlay).save(out)
    print(f"[{item}] overlay written: {out}  ({int((out_a > 0).sum())} px)")


# ------------------------------------------------------------------------------------------- export

def load_normalizer():
    spec = importlib.util.spec_from_file_location("normalize_export", Path(__file__).with_name("normalize_export.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def idle_transform(norm):
    """The exact idle transform of normalize_export.py: bbox, output size and offset."""
    cfg = norm.POSES["idle"]
    master = norm.clean_alpha(Image.open(norm.ART / cfg["master"]))
    bbox = master.getbbox()
    scale = norm.HEAD_WIDTH_TARGET / cfg["head_width_px"]
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    size = (round(bw * scale), round(bh * scale))
    offset = (norm.AXIS_X - size[0] // 2, norm.GROUND_Y - size[1])
    return bbox, size, offset


def to_house_grid(norm, overlay_img, pad_out=420):
    """Apply the idle transform to a Master-space layer without cropping to the Koa bbox.

    normalize_export crops the Master to its bbox and resizes it. An accessory can reach outside
    that bbox (a pom-pom above the head), so the same per-axis scale is applied to a box extended
    by `pad_out` output pixels on every side. Pixel centers line up with the Koa frames exactly.
    """
    bbox, size, offset = idle_transform(norm)
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    rx, ry = bw / size[0], bh / size[1]
    pad_src = int(np.ceil(pad_out * max(rx, ry))) + 4
    w, h = overlay_img.size
    padded = Image.new("RGBA", (w + 2 * pad_src, h + 2 * pad_src), (0, 0, 0, 0))
    padded.paste(overlay_img, (pad_src, pad_src))
    box = (
        bbox[0] + pad_src - pad_out * rx, bbox[1] + pad_src - pad_out * ry,
        bbox[2] + pad_src + pad_out * rx, bbox[3] + pad_src + pad_out * ry,
    )
    out_size = (size[0] + 2 * pad_out, size[1] + 2 * pad_out)
    body = padded.resize(out_size, Image.LANCZOS, box=box)
    # `body` starts pad_out pixels up and left of the Koa bbox's corner, so it goes at `offset` on a
    # canvas padded by pad_out on every side, which is then cropped back to the house grid.
    big =Image.new("RGBA", (norm.CANVAS[0] + 2 * pad_out, norm.CANVAS[1] + 2 * pad_out), (0, 0, 0, 0))
    big.alpha_composite(body, (offset[0], offset[1]))
    return norm.clean_alpha(big.crop((pad_out, pad_out, pad_out + norm.CANVAS[0], pad_out + norm.CANVAS[1])))


def grid_box(norm):
    """Maps a Master-space box to house-grid pixels (for the checks)."""
    bbox, size, offset = idle_transform(norm)
    sx, sy = size[0] / (bbox[2] - bbox[0]), size[1] / (bbox[3] - bbox[1])

    def tf(x0, y0, x1, y1):
        return (offset[0] + (x0 - bbox[0]) * sx, offset[1] + (y0 - bbox[1]) * sy,
                offset[0] + (x1 - bbox[0]) * sx, offset[1] + (y1 - bbox[1]) * sy)
    return tf


def export(item, art_dir, public_dir):
    norm = load_normalizer()
    src = art_dir / f"{item}@idle.master.png"
    if not src.exists():
        sys.exit(f"missing {src}: run extract first")
    grid = to_house_grid(norm, Image.open(src).convert("RGBA"))
    neutral, blink = load_rgba(NORMALIZED), load_rgba(NORMALIZED_BLINK)
    failures = check_overlay(item, np.array(grid).astype(np.float64), neutral, blink, transform=grid_box(norm))
    if failures:
        for f in failures:
            print(f"  FAIL {f}")
        sys.exit(1)
    normalized = art_dir / f"{item}@idle.normalized.png"
    grid.save(normalized)
    print(f"[{item}] {normalized}")
    public_dir.mkdir(parents=True, exist_ok=True)
    for w in norm.EXPORT_WIDTHS:
        img = grid if w == norm.CANVAS[0] else grid.resize((w, round(norm.CANVAS[1] * w / norm.CANVAS[0])), Image.LANCZOS)
        suffix = "" if w == norm.CANVAS[0] else f"-{w}"
        path = public_dir / f"{item}@idle{suffix}.webp"
        img.save(path, "WEBP", **norm.WEBP)
        print(f"  {path}  {img.size}  {path.stat().st_size / 1000:.1f} kB")


# ------------------------------------------------------------------------------------------- review

def label(img, text):
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, img.width, 34), fill=(255, 255, 255))
    d.text((10, 10), text, fill=(40, 40, 40))
    return img


def review(item, public_dir, review_dir):
    """Review sheet built from the exported WebP files (exactly what the app stacks)."""
    def webp(path):
        return np.array(Image.open(path).convert("RGBA")).astype(np.float64)

    chars = ROOT / "public" / "characters"
    rows = []
    for suffix, scale_note in (("", "1024 export"), ("-512", "512 export (shown at 2x)")):
        neutral = webp(chars / f"koa_idle_neutral{suffix}.webp")
        blink = webp(chars / f"koa_idle_blink{suffix}.webp")
        acc = webp(public_dir / f"{item}@idle{suffix}.webp")
        h, w = neutral.shape[:2]
        cells = []
        for bg_name, bg in (("cream", CREAM), ("dark", DARK)):
            for frame_name, frame in (("idle", neutral), ("blink", blink)):
                stacked = over(acc, over(frame, flat(bg, h, w)))
                cells.append((f"{item} + {frame_name} on {bg_name} ({scale_note})", stacked))
        before = over(neutral, flat(CREAM, h, w))
        cells.insert(0, (f"Master without {item} ({scale_note})", before))
        crop = (slice(int(h * 0.26), int(h * 0.93)), slice(int(w * 0.06), int(w * 0.94)))
        imgs = []
        for text, arr in cells:
            im = to_image(arr[crop]).convert("RGB")
            if suffix == "-512":
                im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
            imgs.append(label(im, text))
        row = Image.new("RGB", (sum(i.width for i in imgs) + 12 * (len(imgs) - 1), imgs[0].height), (255, 255, 255))
        x = 0
        for im in imgs:
            row.paste(im, (x, 0))
            x += im.width + 12
        rows.append(row)
    # Close-up at 1:1 of the 1024 export (the head, or the item's own window): Master vs with the item vs blink with the item.
    neutral = webp(chars / "koa_idle_neutral.webp")
    blink = webp(chars / "koa_idle_blink.webp")
    acc = webp(public_dir / f"{item}@idle.webp")
    h, w = neutral.shape[:2]
    y0, y1, x0, x1 = ITEMS[item].get("closeup", HEAD_CLOSEUP)
    head = (slice(y0, y1), slice(x0, x1))
    close = [
        label(to_image(over(neutral, flat(CREAM, h, w))[head]).convert("RGB"), "close-up: Master"),
        label(to_image(over(acc, over(neutral, flat(CREAM, h, w)))[head]).convert("RGB"), f"close-up: {item} + idle"),
        label(to_image(over(acc, over(blink, flat(CREAM, h, w)))[head]).convert("RGB"), f"close-up: {item} + blink"),
    ]
    row = Image.new("RGB", (sum(i.width for i in close) + 24, close[0].height), (255, 255, 255))
    x = 0
    for im in close:
        row.paste(im, (x, 0))
        x += im.width + 12
    rows.append(row)
    width = max(r.width for r in rows)
    sheet = Image.new("RGB", (width, sum(r.height for r in rows) + 24 * len(rows)), (255, 255, 255))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height + 24
    review_dir.mkdir(parents=True, exist_ok=True)
    out = review_dir / f"{item}_review.png"
    sheet.save(out)
    print(f"[{item}] review sheet: {out}  {sheet.size}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=("extract", "export", "review"))
    parser.add_argument("item", choices=sorted(ITEMS))
    parser.add_argument("candidate", nargs="?")
    parser.add_argument("--art-dir", type=Path, default=ROOT / "art" / "accessories")
    parser.add_argument("--public-dir", type=Path, default=ROOT / "public" / "characters" / "accessories")
    parser.add_argument("--review-dir", type=Path, default=ROOT / "art" / "review-phase11")
    args = parser.parse_args()
    if args.step == "extract":
        if not args.candidate:
            parser.error("extract needs the candidate PNG")
        extract(args.item, Path(args.candidate), args.art_dir, args.review_dir)
    elif args.step == "export":
        export(args.item, args.art_dir, args.public_dir)
    else:
        review(args.item, args.public_dir, args.review_dir)


if __name__ == "__main__":
    main()
