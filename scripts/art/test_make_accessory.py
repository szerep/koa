"""Tests for make_accessory.py: the hollow (outline) cut and the unchanged checks.

Run:  python -I scripts/art/test_make_accessory.py
      KOA_ART_SLOW=1 python -I scripts/art/test_make_accessory.py   (adds the alignment, the hollow
      end-to-end extracts and the beanie regression, which re-extracts beanie_v02 and compares it
      with the committed overlay)
"""
import contextlib
import importlib.util
import io
import os
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("make_accessory", HERE / "make_accessory.py")
ma = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ma)

SLOW = os.environ.get("KOA_ART_SLOW") == "1"
H, W = 1536, 1024
GLASSES = ma.ITEMS["round-glasses"]
BEANIE = ma.ITEMS["beanie"]
LEFT_EYE, RIGHT_EYE = (383, 841), (646, 841)


def ring(cx, cy, r_in, r_out):
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.hypot(xx - cx, yy - cy)
    return (d >= r_in) & (d <= r_out)


def disc(cx, cy, r):
    return ring(cx, cy, -1, r)


def glasses_frame():
    """Two closed round rims around the eyes and a bridge between them (inside the allowed region)."""
    frame = ring(*LEFT_EYE, 80, 92) | ring(*RIGHT_EYE, 80, 92)
    frame[835:847, 475:555] = True  # bridge
    return frame


def cut(cfg, frame):
    """cut_item on a candidate where exactly `frame` changed and is in the item's colors."""
    return ma.cut_item(cfg, frame, frame, np.ones((H, W)))


class HollowCut(unittest.TestCase):
    def test_round_glasses_is_the_only_hollow_item(self):
        self.assertIs(GLASSES.get("hollow"), True)
        self.assertFalse(BEANIE.get("hollow", False))

    def test_closed_frame_does_not_fill_its_lens_interior(self):
        solid, out_a = cut(GLASSES, glasses_frame())
        for cx, cy in (LEFT_EYE, RIGHT_EYE):
            self.assertFalse(solid[disc(cx, cy, 78)].any())
            self.assertTrue(solid[ring(cx, cy, 82, 90)].all())

    def test_pixels_inside_the_lens_opening_are_transparent(self):
        _, out_a = cut(GLASSES, glasses_frame())
        for cx, cy in (LEFT_EYE, RIGHT_EYE):
            # The 0.9 px feather reaches 4 px per axis (5.7 px diagonally): beyond that the opening
            # is exactly 0. extract() zeroes overlay pixels at alpha <= 0.01, which clears the
            # opening from 3 px inside the rim; right at the rim only the faint feather edge remains.
            self.assertEqual(out_a[disc(cx, cy, 73)].max(), 0.0)
            self.assertFalse((out_a[disc(cx, cy, 77)] > 0.01).any())
            self.assertLess(out_a[disc(cx, cy, 79)].max(), 0.5)

    def test_hollow_cut_keeps_only_changed_pixels(self):
        frame = glasses_frame()
        solid, _ = cut(GLASSES, frame)
        self.assertFalse((solid & ~frame).any())

    def test_same_frame_through_the_solid_cut_is_filled(self):
        # The beanie's behavior on the same shape: enclosed regions become item pixels.
        solid, _ = cut(dict(GLASSES, hollow=False), glasses_frame())
        self.assertTrue(solid[disc(*LEFT_EYE, 78)].all())

    def test_overlay_through_the_eye_check_passes_hollow_and_fails_filled(self):
        master, blink = ma.load_rgba(ma.MASTER), ma.load_rgba(ma.MASTER_BLINK)

        def overlay(cfg):
            _, out_a = cut(cfg, glasses_frame())
            ov = np.zeros((H, W, 4))
            ov[..., :3] = GLASSES["swatch"]
            ov[..., 3] = out_a * 255
            return ov

        self.assertEqual(ma.check_overlay("round-glasses", overlay(GLASSES), master, blink), [])
        filled = ma.check_overlay("round-glasses", overlay(dict(GLASSES, hollow=False)), master, blink)
        self.assertTrue(any(f.startswith("eyes:") for f in filled), filled)

    def test_beanie_cut_still_fills_enclosed_regions(self):
        # A closed knit outline with a fur-matching (unchanged) patch inside: filled, as before.
        frame = ring(512, 600, 60, 110)
        solid, out_a = cut(BEANIE, frame)
        self.assertTrue(solid[disc(512, 600, 60)].all())
        self.assertEqual(out_a[disc(512, 600, 55)].min(), 1.0)

    def test_nothing_to_cut_returns_none(self):
        empty = np.zeros((H, W), bool)
        self.assertIsNone(cut(GLASSES, empty))


class ChecksUnchanged(unittest.TestCase):
    """The checks are shared by both cuts; a hollow item gets no exemption."""

    @classmethod
    def setUpClass(cls):
        cls.master, cls.blink = ma.load_rgba(ma.MASTER), ma.load_rgba(ma.MASTER_BLINK)
        cls.eyes = ma.blink_region(cls.master, cls.blink)

    def glasses_overlay(self, extra=None):
        _, out_a = cut(GLASSES, glasses_frame())
        ov = np.zeros((H, W, 4))
        ov[..., :3] = GLASSES["swatch"]
        ov[..., 3] = out_a * 255
        if extra is not None:
            ov[extra] = [*GLASSES["swatch"], 255]
        return ov

    def check(self, ov):
        return ma.check_overlay("round-glasses", ov, self.master, self.blink)

    def test_clean_glasses_pass(self):
        self.assertEqual(self.check(self.glasses_overlay()), [])

    def test_blink_region_is_the_one_from_the_masters(self):
        # The eye check's region: where the blink differs from the Master, grown by 4 px.
        ys, xs = np.nonzero(self.eyes)
        self.assertTrue(self.eyes[LEFT_EYE[1], LEFT_EYE[0]] and self.eyes[RIGHT_EYE[1], RIGHT_EYE[0]])
        self.assertGreater(ys.min(), 740)
        self.assertLess(ys.max(), 940)

    def test_a_genuine_pixel_over_the_eye_still_fails(self):
        one = np.zeros((H, W), bool)
        one[LEFT_EYE[1], LEFT_EYE[0]] = True
        self.assertEqual(self.check(self.glasses_overlay(one)), ["eyes: the overlay covers 1 px of the blink region"])

    def test_a_faint_pixel_over_the_eye_still_fails(self):
        ov = self.glasses_overlay()
        ov[RIGHT_EYE[1], RIGHT_EYE[0]] = [*GLASSES["swatch"], 1]
        self.assertEqual(self.check(ov), ["eyes: the overlay covers 1 px of the blink region"])

    def test_region_check_unchanged(self):
        out = np.zeros((H, W), bool)
        out[700:710, 500:520] = True  # above y 740, in the brows
        self.assertEqual(self.check(self.glasses_overlay(out)), ["region: 200 px outside the allowed region"])

    def test_crop_check_unchanged(self):
        ov = self.glasses_overlay()
        ov[0, 600] = [*GLASSES["swatch"], 255]
        fails = self.check(ov)
        self.assertIn("not cropped: the overlay touches the canvas edge", fails)

    def test_empty_overlay_fails(self):
        self.assertEqual(self.check(np.zeros((H, W, 4)))[0], "the overlay is almost empty")

    def test_colour_report_unchanged(self):
        self.assertEqual(ma.color_report("round-glasses", self.glasses_overlay()),
                         "median rgb(58, 43, 34) vs catalog swatch rgb(58, 43, 34)")

    @unittest.skipUnless(SLOW, "set KOA_ART_SLOW=1")
    def test_alignment_of_the_master_with_itself(self):
        err, scale, dx, dy = ma.align(self.master, self.master, self.master[..., 3] / 255.0)
        self.assertAlmostEqual(scale, 1.0, places=6)
        self.assertEqual((dx, dy), (0, 0))
        self.assertLess(err, 1.0)  # bicubic resampling at identity leaves a fraction of a gray level


class ExactChanges(unittest.TestCase):
    """Hollow items on a Master-preserved candidate: every exact difference from the Master counts."""

    @classmethod
    def setUpClass(cls):
        cls.master = ma.load_rgba(ma.MASTER)

    def test_only_hollow_items_on_an_exactly_placed_candidate(self):
        cand = self.master.copy()
        cand[841, 520, 0] += 1
        self.assertIsNone(ma.exact_changes(BEANIE, cand, self.master, 1.0, 0, 0, False))
        self.assertIsNone(ma.exact_changes(GLASSES, cand, self.master, 1.0, 0, 0, True))     # resized
        self.assertIsNone(ma.exact_changes(GLASSES, cand, self.master, 1.005, 0, 0, False))  # rescaled
        self.assertIsNone(ma.exact_changes(GLASSES, cand, self.master, 1.0, 2, 0, False))    # shifted
        exact = ma.exact_changes(GLASSES, cand, self.master, 1.0, 0, 0, False)
        self.assertEqual(int(exact.sum()), 1)
        self.assertTrue(exact[841, 520])

    def test_a_one_level_difference_counts(self):
        cand = self.master.copy()
        cand[800, 500, 2] -= 1
        cand[801, 500, 3] = 254 if self.master[801, 500, 3] == 255 else 255  # alpha counts too
        exact = ma.exact_changes(GLASSES, cand, self.master, 1.0, 0, 0, False)
        self.assertEqual(int(exact.sum()), 2)

    def test_hollow_feather_stays_on_changed_pixels(self):
        frame = glasses_frame()
        _, out_a = cut(GLASSES, frame)
        self.assertFalse((out_a[~frame] > 0).any())
        # The solid cut still feathers past its pixels, as before.
        _, solid_a = cut(dict(GLASSES, hollow=False), frame)
        self.assertTrue((solid_a[~frame] > 0).any())


FRAME_ON_NOSE = (86, 68, 58)  # a uniform dark frame brown, close to the Master's nose (~87, 74, 70)


def master_preserved_candidate(master, frame):
    """A test candidate: the Master's bytes, with `frame` pixels changed. Where the frame crosses the
    Master's dark nose it is a uniform brown close to the nose's own color (many pixels within the
    28-level threshold); elsewhere it is the catalog brown (well above it). Returns the candidate
    and the frame pixels within 28 levels of the Master (the ones the threshold alone rejects)."""
    cand = master.copy()
    gray = master[..., :3].mean(-1)
    nose = np.zeros(gray.shape, bool)
    nose[760:960, 440:592] = True
    nose &= (gray < 110) & (master[..., 3] > 250)
    cand[frame & nose] = [*FRAME_ON_NOSE, 255]
    cand[frame & ~nose] = [*GLASSES["swatch"], 255]
    diff = np.abs(cand[..., :3] - master[..., :3]).max(-1)
    return cand, frame & (diff <= 28)


@unittest.skipUnless(SLOW, "set KOA_ART_SLOW=1")
class HollowExtractEndToEnd(unittest.TestCase):
    """The real extract() on Master-preserved test candidates (each run takes about 30 s)."""

    @classmethod
    def setUpClass(cls):
        cls.master = ma.load_rgba(ma.MASTER)

    def run_extract(self, cand):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        path = Path(tmp.name) / "cand.png"
        Image.fromarray(cand.astype(np.uint8), "RGBA").save(path)
        ma.extract("round-glasses", path, Path(tmp.name) / "art", Path(tmp.name) / "review")
        return np.array(Image.open(Path(tmp.name) / "art" / "round-glasses@idle.master.png")).astype(np.float64)

    def test_faint_frame_over_the_nose_is_kept_and_the_lenses_stay_open(self):
        frame = glasses_frame()
        cand, faint = master_preserved_candidate(self.master, frame)
        diff = np.abs(cand[..., :3] - self.master[..., :3]).max(-1)
        self.assertGreater(int(faint.sum()), 1000)
        self.assertGreater(int((faint & (diff <= 10)).sum()), 300)
        # The threshold alone loses them (the cut before this change):
        a_c = cand[..., 3] / 255
        lo, hi = GLASSES["hue"]
        hue, sat = ma.hue_sat(cand[..., :3])
        in_color = (hue >= lo) & (hue <= hi) & (sat >= GLASSES["min_sat"])
        _, old_a = ma.cut_item(GLASSES, (diff > 28) & (a_c > 0.5), in_color, a_c)
        self.assertLess((old_a[faint] > 0).mean(), 0.5)
        overlay = self.run_extract(cand)
        a = overlay[..., 3]
        # 1. Frame pixels within 28 levels of the Master's nose (some within 1-10 levels) are kept.
        self.assertTrue((a[faint] > 0).all())
        # 2. Frame pixels above the 28-level threshold are kept too.
        strong = frame & ~faint
        self.assertGreater((a[strong] > 0).mean(), 0.97)
        # 3. The lens openings stay transparent.
        for cx, cy in (LEFT_EYE, RIGHT_EYE):
            self.assertEqual(a[disc(cx, cy, 79)].max(), 0)
        # No unchanged Master pixel joins the overlay, and the overlay passes the unchanged checks.
        self.assertFalse((a[~frame] > 0).any())
        self.assertEqual(ma.check_overlay("round-glasses", overlay, self.master, ma.load_rgba(ma.MASTER_BLINK)), [])

    def test_a_faint_frame_over_an_eye_still_fails_the_eye_check(self):
        # 4. A real hollow-accessory pixel over an eye: a small rim right around the left eye, only
        # a few levels off the Master (kept by the exact comparison), must fail the eye check.
        frame = glasses_frame() | ring(*LEFT_EYE, 20, 30)
        cand, _ = master_preserved_candidate(self.master, frame)
        over_eye = ring(*LEFT_EYE, 20, 30)
        cand[over_eye, :3] = np.clip(self.master[over_eye, :3] + [6, 0, -6], 0, 255)
        cand[over_eye, 3] = 255
        with self.assertRaises(SystemExit) as stop:
            self.run_extract(cand)
        self.assertEqual(stop.exception.code, 1)


    def test_an_arm_past_the_allowed_region_still_fails_the_spill_check(self):
        # 6. The spill check is unchanged: an arm running from the rim out past x 230 to the ear.
        frame = glasses_frame()
        frame[835:845, 180:300] = True
        cand, _ = master_preserved_candidate(self.master, frame)
        out = io.StringIO()
        with contextlib.redirect_stdout(out), self.assertRaises(SystemExit) as stop:
            self.run_extract(cand)
        self.assertEqual(stop.exception.code, 1)
        self.assertIn("FAIL region: the round-glasses continues", out.getvalue())


@unittest.skipUnless(SLOW, "set KOA_ART_SLOW=1")
class BeanieRegression(unittest.TestCase):
    def test_beanie_v02_extracts_to_the_committed_overlay(self):
        with tempfile.TemporaryDirectory() as tmp:
            ma.extract("beanie", ma.ROOT / "art/accessories/candidates/beanie_v02.png", Path(tmp) / "art", Path(tmp) / "review")
            new = np.array(Image.open(Path(tmp) / "art" / "beanie@idle.master.png"))
        committed = np.array(Image.open(ma.ROOT / "art/accessories/beanie@idle.master.png"))
        self.assertTrue(np.array_equal(new, committed))


if __name__ == "__main__":
    unittest.main(verbosity=2)
