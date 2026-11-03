# Koa — Visual Design Brief

## 1. The feeling

Koa should feel like **a small, warm room you go back to every day**: late afternoon light, a mug of tea, a soft plush friend keeping you company while you work. The interface is the room and the koala lives in it. The timer and controls are furniture: well made and easy to reach, but never the star.

Three words guide every decision: **soft, warm, crafted.**

| We are | We are not |
|---|---|
| A cozy indie mobile game (think *Animal Crossing* menus, *Alto's* restraint) | A SaaS productivity dashboard |
| Tactile: things squish, settle, and glow | Flat, sterile, or "clean" for its own sake |
| Calm while you focus and joyful when you finish | Gamified noise, confetti on every tap |
| One deliberate palette pulled from the mascot | Gradients, neon accents, decorative borders |

**Guiding rule:** during a focus session the UI goes *quieter*, with fewer elements, less motion, and dimmed chrome. Delight comes at the edges of a session (start, finish, break), not in the middle of it.

## 2. Color palette

The palette comes from the reference sheet. The sheet's printed hex labels are low resolution and the render is warm-shifted, so these values were sampled from the artwork itself and then tuned for UI use.

### Core tokens

*Source of truth: `src/styles/tokens.css`. This table mirrors it. Phase 3 re-sampled eucalyptus, fur and bark from the sheet's swatches. Intermediate steps such as `--euca-200/400/600/800` and `--honey-100/700` exist only in the tokens file.*

| Family | Token | Hex | Use |
|---|---|---|---|
| **Cream** (canvas) | `--cream-50` | `#FFFAF3` | Raised cards, sheets |
| | `--cream-100` | `#F9EEE1` | App background (matches the sheet's backdrop) |
| | `--cream-200` | `#F1E1CF` | Sunken surfaces, inactive track of the progress ring |
| | `--cream-300` | `#E6D2BC` | Dividers (used sparingly), pressed states |
| **Eucalyptus** (primary) | `--euca-100` | `#EEF0E4` | Selected chip background, soft tint |
| | `--euca-300` | `#C2C9A9` | Progress ring glow, hover |
| | `--euca-500` | `#96A07E` | **Hoodie green** (the sheet's swatch). Primary buttons, progress ring |
| | `--euca-700` | `#5F6A4B` | Text on light green, active nav icon |
| | `--euca-900` | `#2F3524` | Text on the primary button |
| **Koala grey** (neutral) | `--fur-200` | `#E2DEDD` | Disabled fills |
| | `--fur-400` | `#ADA6A5` | **Fur.** Secondary icons, placeholder strokes |
| | `--fur-600` | `#7E7776` | Muted text |
| **Blush** (affection) | `--blush-200` | `#F5DAD3` | Speech-bubble tint, "new" badges |
| | `--blush-400` | `#E5BCB3` | **Inner ear and cheek.** Hearts, likes, streak warmth |
| | `--blush-600` | `#B97A70` | Blush text and emphasis |
| **Bark** (ink) | `--bark-300` | `#C4A48C` | Wood props, shelf details |
| | `--bark-500` | `#936F57` | Decorative brown (sheet swatch); not for small text |
| | `--bark-600` | `#6E5646` | Secondary / muted text (5.9:1 on cream) |
| | `--bark-700` | `#5C4334` | **Logo brown.** Headings |
| | `--bark-900` | `#3A2B22` | Primary body text (never pure black) |
| **Honey** (reward) | `--honey-300` | `#F4D28C` | Coin highlight |
| | `--honey-500` | `#E3A948` | Coins, celebration sparkles (from the sheet's confetti) |

**Functional colors:** success is `--euca-700`, warning is `--honey-500`, and danger is a muted terracotta (`#C46A5E`). There are no saturated reds or blues anywhere.

**Shadows** are warm brown, never grey. Example: `0 8px 24px -8px rgb(92 67 52 / .18), 0 2px 4px rgb(92 67 52 / .06)`. Each elevation level adds blur, not darkness.

**Contrast:** body text uses `--bark-900` on cream (well above AA). Every text/background pair gets checked against WCAG AA in Phase 3. White text sits on `--euca-700`, not `--euca-500`.

**Evening theme (later):** a warm dusk variant for night study, with a deep bark-brown background (not black) and a lamp-glow accent. The sheet's little lantern can inspire it. Planned for Phase 8, not the MVP.

## 3. Typography

| Role | Typeface | Why |
|---|---|---|
| Display: screen titles, timer numerals, coin counts | **Fredoka** (variable, 500–600) | Rounded and chunky, a close match to the "Koa" wordmark on the sheet. Playful without being childish. |
| UI and body: labels, buttons, settings, stats | **Nunito Sans** (variable, 400–700) | Warm humanist sans that pairs with Fredoka's roundness while staying crisp at small sizes. Has real tabular figures. |

- Both fonts are self-hosted through `@fontsource-variable/*`, so they work offline in the PWA. There are no Google Fonts requests at runtime.
- The timer numerals use Fredoka with `font-variant-numeric: tabular-nums`. If Fredoka's tabular figures prove unstable in Phase 3, fall back to fixed-width digit boxes.
- Type scale (mobile, rem based on 16px):

| Token | Size / line height | Use |
|---|---|---|
| `timer` | 64/1.0 Fredoka 600 | Countdown |
| `display` | 32/1.1 Fredoka 600 | Screen titles |
| `title` | 22/1.2 Fredoka 500 | Card titles |
| `body` | 16/1.45 Nunito Sans 500 | Text |
| `label` | 14/1.3 Nunito Sans 700 | Buttons, chips |
| `caption` | 12/1.3 Nunito Sans 600 | Meta, nav labels |

- Use sentence case everywhere and no all-caps UI. The one exception is the small tracked tagline "THE STUDY KOALA" from the sheet, reserved for a future about screen. (The iOS splash screens from Phase 9 are image only: Koa on cream, no text.)

## 4. Shape, space, and motion language

- **Radii:** 12 (chips), 20 (buttons), 28 (cards), and fully round for icon buttons and pills. Corners are never sharp.
- **Spacing:** 4-pt base with steps of 4, 8, 12, 16, 24, 32, 48. Screen gutters are 20px on phone and 32px on tablet.
- **Surfaces:** separate surfaces with color and shadow, not borders. A card is `--cream-50` on a `--cream-100` background.
- **Buttons** feel physical. The primary button is a eucalyptus pill with a 3px darker "base" under it (`--euca-700`). It presses down 2px with a quick spring.
- **Motion:** springy but damped, never bouncy-cartoonish. UI transitions run 180–260ms. Character transitions crossfade over 250–400ms. `prefers-reduced-motion` turns movement into simple fades.
- **Haptics:** the Vibration API isn't available in iOS Safari. Treat haptics as a bonus on Android and never depend on them.

## 5. Home screen composition (iPhone, 390×844)

```
┌──────────────────────────────────────┐
│  ◯ Koa             🍃 3   (●) 1,240  │ ← streak leaf + coin pill (Fredoka numerals)
│                                      │
│   ( Focus )  Short break  Long break │ ← segmented chips, active = euca-100 fill
│                                      │
│  ╭────────────────────────────────╮  │
│  │        ╭─ progress ring ─╮      │  │ ← ring = halo BEHIND the koala
│  │      ╱    "We got this!"  ╲    │  │ ← speech bubble, rare + auto-dismiss
│  │     │                      │   │  │
│  │     │       [ KOALA ]      │   │  │ ← 260–300pt tall, sits on a soft
│  │      ╲    ▁▁▁▁▁▁▁▁▁▁▁    ╱    │  │    floor shadow / cushion
│  │        ╰─────────────────╯      │  │
│  │    room stage (cream + window  │  │ ← room theme layer (Phase 6+)
│  │    light, plant, books)        │  │
│  ╰────────────────────────────────╯  │
│                                      │
│               24:59                  │ ← timer numerals, 64pt Fredoka
│           ● ● ○ ○  Session 2 of 4    │ ← cycle dots as tiny leaves
│                                      │
│        ↺      ( ▶  Start )      ⏭    │ ← reset · primary pill · skip
│                                      │
│ ╭──────────────────────────────────╮ │
│ │  🏠 Home   🛍 Shop  📊 Stats  ⚙  │ │ ← floating pill nav, safe-area aware
│ ╰──────────────────────────────────╯ │
└──────────────────────────────────────┘
```

(The emoji above only mark positions in the sketch. The real UI uses Lucide icons, and the leaf and coin are custom glyphs.)

Key decisions:

1. **The koala is the hero.** It takes the top ~45% of the screen and sits inside its "room" stage, which later becomes the room-customization surface.
2. **The progress ring is a halo behind the koala**, not a separate widget. Progress and companion become one image: the koala is literally surrounded by your focus. The track is `--cream-200`, the fill is `--euca-500` with a soft glow, and a rounded end cap carries a tiny leaf.
3. **The timer reads below the koala**, large and calm. It's the second thing the eye lands on.
4. **One primary action.** Start, Pause, and Resume share a single morphing pill. Reset and Skip are quiet round icon buttons on either side, and Skip asks for confirmation during focus.
5. **Focus mode dims the chrome.** While a study session runs, the mode chips and nav fade to about 40% and the coin pill hides. Tapping anywhere brings them back for 3 seconds.
6. **Layouts:** on iPad and desktop, the stage and timer sit side by side (stage on the left, timer and controls on the right), centered with a max width of about 960px. The nav becomes a left rail on wide screens.
7. **Safe areas:** use `env(safe-area-inset-*)` throughout. The nav floats above the home indicator.

## 6. Other screens (direction only)

- **Shop:** a "cozy boutique" look. The koala preview is pinned at the top and tries items on live. Below it are category tabs (Hats, Glasses, Clothes, Scarves, Extras, and later Rooms) and a two-column grid of item cards on cream, each with a price chip. Owned items show an "Equip" state.
- **Stats:** a "study journal" look. Big Fredoka figures for total time and streak, a weekly bar chart in eucalyptus with rounded bars, and a daily-goal ring that echoes the timer ring.
- **Settings:** grouped cream cards with simple rows. No decoration, but the same type and radii as everywhere else.
