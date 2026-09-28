---
name: "Fox & Floe"
description: "Row the icy rapids: a few thin drawn lines of type float over a full-bleed 3D river, in an ink that follows the sky."
colors:
  ink-navy: "#13283a"
  ink-white: "#ffffff"
  gold-day: "#9a6a00"
  gold-night: "#ffcc4d"
  amber: "#ffb25c"
  river-shadow: "#04101c"
  night-slate: "#1b3548"
typography:
  display-hero:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "clamp(64px, 19vw, 118px)"
    lineHeight: 1
    letterSpacing: "0.04em"
  display-logo:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "clamp(32px, 9.6vw, 70px)"
    lineHeight: 1
    letterSpacing: "0.3em"
  display-score:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "clamp(36px, 9.5vw, 48px)"
    lineHeight: 1
    letterSpacing: "0.03em"
  headline-state:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "clamp(24px, 6vw, 32px)"
    letterSpacing: "0.42em"
  title-prompt:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "clamp(15px, 4.2vw, 19px)"
    letterSpacing: "0.3em"
  title-stat:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "19px"
    letterSpacing: "0.06em"
  body-tag:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "clamp(13px, 3.5vw, 16px)"
    letterSpacing: "0.28em"
  label-multiplier:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "15px"
    letterSpacing: "0.1em"
  label-distance:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "14px"
    lineHeight: 1
    letterSpacing: "0.1em"
  label-button:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "14px"
    letterSpacing: "0.3em"
  label-meta:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "13px"
    letterSpacing: "0.24em"
  label-call:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "13px"
    letterSpacing: "0.34em"
  label-hint:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "13px"
    letterSpacing: "0.24em"
  label-unit:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "max(13px, 0.17em)"
    letterSpacing: "0.24em"
  label-pop:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "17px"
    letterSpacing: "0.16em"
  label-pop-big:
    fontFamily: "print.js drawn monoline (SVG strokes, no font file)"
    fontSize: "22px"
    letterSpacing: "0.16em"
rounded:
  circle: "50%"
spacing:
  stack-tight: "7px"
  stack-hud: "12px"
  stack-foot: "14px"
  stack-head: "16px"
  hud-top: "18px"
  hud-gutter: "22px"
  panel-gutter: "24px"
  panel-bottom: "7vh"
  results-top: "11vh"
  panel-top: "13vh"
components:
  button-text:
    textColor: "{colors.ink-white}"
    typography: "{typography.label-button}"
    padding: "14px 8px"
  button-icon:
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.circle}"
    size: "48px"
  button-icon-night:
    textColor: "{colors.ink-white}"
    rounded: "{rounded.circle}"
    size: "48px"
  title-logo:
    textColor: "{colors.ink-navy}"
    typography: "{typography.display-logo}"
  title-logo-night:
    textColor: "{colors.ink-white}"
    typography: "{typography.display-logo}"
  hud-score:
    textColor: "{colors.ink-navy}"
    typography: "{typography.display-score}"
  hud-score-night:
    textColor: "{colors.ink-white}"
    typography: "{typography.display-score}"
  hud-meter:
    backgroundColor: "{colors.ink-navy}"
    width: "38px"
    height: "2px"
  hud-meter-night:
    backgroundColor: "{colors.ink-white}"
    width: "38px"
    height: "2px"
  hud-magnet:
    textColor: "{colors.gold-day}"
    size: "19px"
  hud-magnet-night:
    textColor: "{colors.gold-night}"
    size: "19px"
  prompt:
    textColor: "{colors.ink-white}"
    typography: "{typography.title-prompt}"
  stat-line:
    textColor: "{colors.ink-white}"
    typography: "{typography.label-meta}"
  stat-dot:
    backgroundColor: "{colors.ink-white}"
    rounded: "{rounded.circle}"
    size: "3px"
  results-hero:
    textColor: "{colors.ink-white}"
    typography: "{typography.display-hero}"
  pop:
    textColor: "{colors.ink-white}"
    typography: "{typography.label-pop}"
  error-line:
    textColor: "{colors.amber}"
    typography: "{typography.body-tag}"
---

# Design System: Fox & Floe

## Overview

**Creative North Star: "The River Is the Screen"**

The whole viewport belongs to the world: the valley, the sky turning from dawn to night, the river, the fox in its boat. The interface owns no surface of its own. It is a few thin lines of drawn type, a handful of line icons and two hairline meters, floating over the scene in the manner of Alto's Odyssey. There are no panels, cards, chips or frames. Legibility comes from light, not boxes: a zero-offset halo around every stroke, a faint scrim at the top and bottom of the screen, and an ink that changes with the sky.

The type carries the identity. It is one monoline, condensed face built on DIN proportions and drawn as SVG strokes by `src/print.js`, set thin and widely tracked. There is no font file, because the game ships fully offline: every visible word and figure is a stroke in the current ink, and the line icons are drawn in the same stroke grammar, so letters and icons read as one hand. Hierarchy comes from size and stroke weight alone, and the larger a line is, the finer its stroke relative to its size.

The mood stays quiet and unhurried even when the river is fast. The HUD settles in, the title writes itself stroke by stroke, prompts breathe, and results arrive one line at a time. The user chose this direction after rejecting a handheld, pocket-LCD device frame, so nothing in the system may bring back a frame, panel or bezel.

**Key Characteristics:**
- A full-bleed 3D river with no interface containers: only type, line icons and hairline meters.
- One drawn monoline typeface from `src/print.js`, with no font files: size comes from `font-size`, weight from the `--pw` stroke property.
- Monochrome ink that follows the sky: navy over bright skies, white at dusk and night, and always white over the river or a dimmed scene.
- Legibility from zero-offset halos and gradient scrims, never from boxes.
- Wide tracking on words (0.16em to 0.42em), tight tracking on figures (0.03em to 0.1em).
- Only two quiet hues: gold for the golden-fish magnet and amber for an error.

## Colors

A monochrome ink over a moving painting: every hue belongs to the world, and the interface draws in navy or white depending on what is behind it.

### Primary
- **Floe Navy** (#13283a): the day ink. The HUD, the title lockup and the corner icon draw in it whenever the sky is bright (`#app[data-tone="dark"]`).
- **Snow White** (#ffffff): the night ink (`data-tone="light"`), and the fixed ink for everything over the river or a dimmed scene: prompts, stat lines, results, the pause menu, loading, error, and the pops at the boat.

### Secondary
- **Golden Fish** (#9a6a00 by day, #ffcc4d at night): the golden-fish magnet icon in the HUD, and nothing else. The darker day value holds contrast against a bright sky; the night value pairs with Snow White.

### Tertiary
- **Ember Amber** (#ffb25c): the error line on the load-failure screen. It is the interface's only alarm color.

### Neutral
- **River Shadow** (#04101c): never used solid. Every dark halo, scrim and dim in the interface is this color at a set alpha (see Elevation & Depth).
- **Night Slate** (#1b3548): the page behind the canvas, the browser theme color and the installed app's splash. It shows only before the river draws.

The tone switch swaps the whole token set on `#app` at once:

| Token | Bright sky (`data-tone="dark"`) | Dusk and night (`data-tone="light"`) | Over the river or a dimmed scene |
|---|---|---|---|
| `--ink` | Floe Navy | Snow White | Snow White |
| `--halo` | Snow White at 60% | River Shadow at 60% | River Shadow at 62% |
| `--scrim` | Snow White at 16% | River Shadow at 24% | n/a |
| `--gold` | Golden Fish, day | Golden Fish, night | Golden Fish, night |
| `--accent` | n/a | n/a | Ember Amber (set only on the white panels; the error line is its one use) |

### Named Rules
**The Ink Follows the Sky Rule.** Text in the sky takes its ink from the sky. The game continuously passes the luminance of the sky's middle band to the UI; the ink turns white when it falls below 0.16 and turns navy again only when it climbs back above 0.22, so dawn and dusk never flicker. The color change eases over 0.9s.

**The White Over Water Rule.** Anything over the river or over a dimmed scene is Snow White with a River Shadow halo, whatever the sky is doing. When the scene dims for pause or results, the HUD and the corner icon turn white too, and gold takes its night value.

**The Color Belongs to the World Rule.** The interface adds no hue beyond Golden Fish and Ember Amber. Anything that needs attention gets size, position or motion, not color.

## Typography

**Display Font:** the drawn monoline face in `src/print.js` (no fallback: every visible glyph is an SVG stroke)
**Body Font:** the same face; the system has exactly one
**Label/Mono Font:** the same face; its figures are tabular (every digit is 6.6 of 14 units wide)

**Character:** Monoline, condensed and DIN-built, with round bowls drawn as true arcs, butt stroke ends and sharp joins. Set thin and airy, it reads like a line drawn over the landscape rather than a label stuck on it.

`printify()` replaces an element's text with one SVG per word (so long lines still wrap) and keeps the words in a visually hidden twin for assistive tech; `printSVG()` draws a single run; `printNumber()` draws a live counter that reuses its glyph slots, so it makes no garbage per frame. CSS drives all of it: `font-size` sets the size (`clamp()` allowed), `letter-spacing` the tracking, `text-transform: uppercase` the case, and `--pw` the stroke width in em-box units. The em is 14 units (caps from 1 to 11, x-height from 3.6, descenders to 14), so a stroke renders at `--pw × font-size ÷ 14` CSS px. The glyph set is A–Z, a–z, 0–9 and `. , : - · × + ! ? ' ’ ( ) / & … ↑ ↓ ← →`; any other character draws as "?", so a new character must be added to `print.js` before it is used.

### Hierarchy
- **Display: hero** (stroke 0.5, clamp(64px, 19vw, 118px), line-height 1, 0.04em): the results score, the largest thing the interface draws. Its unit, POINTS, rides the baseline at max(13px, 0.17em), 0.24em, stroke 1.5, uppercase.
- **Display: logo** (stroke 0.72, clamp(32px, 9.6vw, 70px), line-height 1, 0.3em, uppercase): FOX & FLOE on the title and error screens.
- **Display: score** (stroke 0.8, clamp(36px, 9.5vw, 48px), line-height 1, 0.03em): the live score, top center.
- **Headline: state** (stroke 0.9, clamp(24px, 6vw, 32px), 0.42em, uppercase): the one-word state on the pause screen.
- **Title: prompt** (stroke 1.2, clamp(15px, 4.2vw, 19px), 0.3em, lowercase): "tap to row", breathing at the foot of the title and results screens.
- **Title: stat** (stroke 1.3, 19px, 0.06em): the fish count beside its 21px icon.
- **Body: tag** (stroke 1.15, clamp(13px, 3.5vw, 16px), 0.28em, lowercase): the tagline under the logo, and the loading and error lines.
- **Label: multiplier** (stroke 1.4, 15px, 0.1em): the "×3" above the chain meter.
- **Label: distance** (stroke 1.35, 14px, line-height 1, 0.1em): "49m" under the score, with the unit 0.12em from the figure.
- **Label: button** (stroke 1.35, 14px, 0.3em, uppercase): text buttons.
- **Label: stat line** (stroke 1.45, 13px, 0.24em with figures at 0.1em, uppercase): "BEST SCORE 185 · ROWED 60 M" and the results stats.
- **Label: call** (stroke 1.4, 13px, 0.34em, uppercase): the event call under the distance.
- **Label: hint** (stroke 1.3, 13px, 0.24em, lowercase; the long desktop keys line runs at 0.2em): the first-run coach line and the keys line.
- **Label: pop** (stroke 1.5, 17px, 0.16em, lowercase; big pops are 22px at stroke 1.4): the words that float up from the boat.

Case follows voice: lowercase for what is said to the player (tagline, prompts, hints, pops), uppercase for names, states, buttons, stat lines, calls and units. Figures take thousands separators ("1,250").

### Named Rules
**The Drawn Word Rule.** Every visible word is drawn by `print.js`. The `system-ui` stack on `body` exists only for the visually hidden twins and must never render; no font file, web font or CDN may be added.

**The 13px Floor Rule.** No drawn text is smaller than 13px, including relative sizes (`max(13px, …)`) and the low end of every `clamp()`.

**The 1.6 Device-Pixel Floor Rule.** On standard-density screens (`max-resolution: 1.49dppx`) the stroke weights rise so that no stroke renders under about 1.6 device px: stat lines, the keys line, calls and the coach line go to `--pw` 1.75; distance, multiplier and text buttons to 1.65; tagline and prompt to 1.5; the HUD's 19–21px line icons to stroke 1.9. Weights reach the drawing through `--pw` in CSS (the call line reads it too) so the override can apply; the display sizes, the 24px corner icon and the pops clear the floor at their own weights.

## Layout

The viewport is one full-bleed scene. `#app` is fixed to the screen, the WebGL canvas fills it, and every interface layer above it is absolutely positioned and ignores the pointer, except the buttons. The river itself is the control surface: a pointer cursor in menus, `ew-resize` while rowing.

- **HUD:** a three-column grid (1fr auto 1fr) along the top edge, inset 18px below the top safe area and at least 22px from each side. The center column stacks score, distance, call and coach 7px apart; the left column stacks the fish count, multiplier and power-ups 12px apart; the right column stays empty for the corner button.
- **Corner:** one 48px icon button, 9px below the top safe area and at least 10px from the right edge.
- **Panels** (title, loading, error, pause, results): full-screen centered columns padded 13vh plus the safe area at the top, 24px at the sides, and 7vh plus the safe area at the bottom. The head (logo and tagline, or the results) stacks at 16px; the foot (prompt, stat line, keys line) is pushed to the bottom and stacks at 14px. Results start higher, at 11vh. Pause, loading and error center vertically instead: 30px between the pause word and its choices, 20px between loading or error lines, and the two pause choices 22px apart.
- **Responsive:** there are no width breakpoints. Display sizes scale with `clamp()` on viewport width, and one composition serves portrait phones and landscape desktops. The copy adapts to the input instead: `data-input` swaps the touch lines ("tap to row", "drag to steer · tap to row") for keyboard lines ("press space to row", the keys line), and it updates on every pointer press.

**The Open Water Rule.** During play the interface keeps to the top edge. The middle and lower screen belong to the river, and the only thing that appears there is a pop at the boat, gone within a second. The first-run coach line sits under the numbers, where no hazard passes.

## Elevation & Depth

The interface is flat; depth belongs to the 3D world, with its lighting, fog and bloom. Nothing in the interface casts a directional shadow, and there is no `box-shadow` anywhere. Type lifts off the scene through zero-offset glows (CSS `drop-shadow` filters on the stroke layer) and gradient scrims of River Shadow or white.

### Shadow Vocabulary
- **Sky halo** (`filter: drop-shadow(0 0 6px var(--halo))`): the HUD and the corner icon.
- **Panel halo** (`filter: drop-shadow(0 0 7px var(--halo))`): each block of a menu panel.
- **Tight edge** (`filter: drop-shadow(0 0 1.5px rgba(4, 16, 28, .5)) drop-shadow(0 0 7px var(--halo))`): white text that can land on bright snow or ice, which means every panel foot and the results head.
- **Pop halo** (`filter: drop-shadow(0 0 5px rgba(4, 16, 28, .65))`): the words at the boat.
- **Top scrim** (`linear-gradient(180deg, var(--scrim) 0%, transparent 24%)`): always on, under the HUD and the title.
- **Bottom scrim** (`linear-gradient(0deg, rgba(4, 16, 28, .34) 0%, transparent 32%)`): menus only, under the white prompts; off while rowing.
- **Pause dim** (`background-color: rgba(4, 16, 28, .38)`): over the whole scene while paused.
- **Results pool** (`radial-gradient(90% 46% at 50% 20%, rgba(4, 16, 28, .5), transparent 72%)`, with the bottom scrim at .42 and a .14 wash over everything): a soft dark pool behind the numbers so they read over bright snow.

### Named Rules
**The Zero-Offset Rule.** Every shadow in the interface is a centered glow: no offsets, no hard edges, no `box-shadow`.

**The Tight Edge Rule.** White text that can land on bright snow or ice carries a 1.5px River Shadow edge at 50% under its 7px halo, because the soft halo alone washes out on ice.

## Shapes

With no containers there are almost no shapes. Form is stroke: butt ends, sharp miter joins that bevel once they pass a 1.5 miter limit, and true circular arcs for bowls. The few closed forms:

- **Stat dot:** a 3px circle in the ink at 75% opacity between the items of a stat line. Inside a lowercase hint, the drawn middle dot (·) does the same job.
- **Meter:** a 38 × 2px hairline. The track is the ink at 28%; the fill is the ink, growing from the left.
- **Button tick:** a 1px line under a text button, 35% of the word at 45% opacity at rest, the full word at 90% on hover or focus.
- **Focus ring:** 1.5px solid in the ink, 3px out; a circle around the icon button's 48px hit area, square around a text button.

The circle (50% radius) is the only radius. There are no borders and no fills behind text.

## Components

### Buttons
Invisible until touched: a word or an icon, with nothing around it.
- **Text button** (the pause menu's RESUME and RESTART): label-button type in Snow White over the dimmed scene, 14px 8px padding, no fill, no border. The tick grows to full width over 0.35s on hover and focus-visible; the focus ring sits 3px out.
- **Icon button** (the corner): a 48px circular hit area holding a 24px line icon at stroke 1.6 in the ink, with the sky halo. It presses to 90% scale over 0.15s. It follows the tone over the sky and turns white when the scene dims. There is one corner icon at a time: pause while rowing, sound or mute in menus, and none while loading or crashing.

### HUD
The glanceable layer while rowing: numbers top center, stats top left, one icon top right.
- **Score cluster:** the live score (display-score), the distance under it, then the call line and the coach line. The call line shows one uppercase event call at a time (a river section, a distance milestone, a new best) for 1.9s, with a 0.45s fade. The coach line shows once, on the first run, for 5.2s.
- **Stat column:** the fish count (21px fish icon, 8px gap, 19px figure); the multiplier ("×3", 15px) over its chain meter, shown only above ×1; power-ups as icons (the thermos shield, and the golden fish in Golden Fish with its magnet meter), each shown only while active, with icon and meter 7px apart.
- **Entrance:** a 0.6s fade with an 8px drop when rowing starts. The HUD stays through the crash and the pause.

### Title Lockup
- The logo writes itself in: each stroke of FOX & FLOE draws from nothing to full length over 0.8s, staggered 60ms left to right after a 0.2s pause. The tagline sits 16px below. Both are in the sky, so both follow the tone.
- The foot: the prompt breathes (opacity 1 to 0.8 and back over 2.8s); below it sits the stat line (best score · rowed distance), hidden until there has been a first run, and on keyboard devices the keys line. All of it is white, with the tight edge.

### Results
- The score leads as the hero figure with POINTS on its baseline. Below it comes the stat line (distance · fish · close calls), then the best line, which reads "BEST 185" or, when the run beats it, "NEW BEST" (at 0.36em) in the same place. The lines arrive one at a time, each rising 10px over 0.6s, 0.15s apart. The foot reads "tap to row again". Everything is white over the results pool.

### Pause
- PAUSED (headline-state) centered over the pause dim, with the two text buttons 30px below it and 22px apart.

### Pops
- Short lowercase words at the boat ("+25", "smash", "air", "fish magnet"): 17px, 0.16em, Snow White, with the pop halo. Each rises from 8px below its anchor to 44px above it over 1s, fades in over the first 14% and fades out after. A new pop lifts those still in the air by 1.5em over 0.25s, so quick chains stack instead of overlapping, and at most five are alive at once. Big pops (hits, air, multiplied fish) are 22px.

### Loading and Error
- Loading is one tag line, "filling the river…", breathing over 2.2s at the center. Error is the logo, the reason in Ember Amber, and "reload the page to try again". Both are white.

### Line Icons
- Drawn on a 24-unit box at stroke 1.6 in the current ink, with butt ends, miter joins (limit 1.5) and no fills: pause, play, sound, mute, restart, fish, thermos, and the golden fish (the fish with three short rays). They size by `font-size` at 1em: 24px in the corner, 21px beside the fish count, 19px for power-ups; on standard-density screens the HUD icons draw at stroke 1.9 to stay above the 1.6 device-pixel floor.

### Accessibility
- Drawn words keep a visually hidden text twin. Drawn figures are hidden from assistive tech, so the HUD is hidden as a whole, and the pause, a new best and the results are announced through a polite live region. Reduced motion removes the breathing, the write-on and the results stagger, and cuts the pops to an instant.

## Do's and Don'ts

### Do:
- **Do** draw every visible word with `printify()`, `printSVG()` or `printNumber()` from `src/print.js`, and set its size, tracking, case and stroke weight (`--pw`) in CSS.
- **Do** keep drawn text at 13px or larger, and on standard-density screens keep every stroke at or above about 1.6 device px (`--pw × font-size ÷ 14 × dppx`).
- **Do** let only text in the sky follow `data-tone`; set anything over the river or a dimmed scene in Snow White (#ffffff) with the River Shadow halo.
- **Do** give white text that can land on bright snow or ice the tight 1.5px edge under its 7px halo.
- **Do** put status such as NEW BEST in the results stat line, and use the call line for events during play.
- **Do** separate the items of a stat line with the 3px stat dot.
- **Do** draw new icons on the 24-unit box at stroke 1.6 in the type's stroke grammar, colored by `currentColor`.
- **Do** ease entrances with `--ease` (cubic-bezier(.22, 1, .36, 1)) and keep a reduced-motion path.

### Don't:
- **Don't** put a container behind type: no panels, cards, chips, pills, frames, fills or borders. Legibility comes from halos and scrims.
- **Don't** bring back a device frame or handheld, pocket-LCD styling; the user rejected it.
- **Don't** add eyebrow or kicker labels above a heading or a figure. The call line under the distance and the uppercase stat lines are not kickers.
- **Don't** set visible text in a font: no `system-ui`, no web fonts, no font files, CDNs or remote assets.
- **Don't** use emoji or font glyphs as icons.
- **Don't** use `box-shadow` or offset shadows.
- **Don't** add interface hues beyond Golden Fish (the magnet) and Ember Amber (an error).
- **Don't** hard-code a stroke weight in JavaScript for a role the standard-density override covers; read `--pw` from CSS.
