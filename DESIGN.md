---
name: Sprout
description: A dusk glade where confirmed progress grows as leaves, lit by one warm lantern.
colors:
  lantern-amber: "#E9B44C"
  lantern-amber-hover: "#F0C266"
  lantern-ink: "#2B2412"
  moss: "#3F5A36"
  moss-deep: "#334B2B"
  lichen: "#9DB27C"
  berry: "#B8486A"
  dusk: "#2F2C52"
  dusk-deep: "#232042"
  sky: "#EEF0E2"
  sky-soft: "#C4CAB4"
  mist: "#E4E9DA"
  panel: "#F3F5EC"
  field: "#FBFCF7"
  line: "#C8D1B6"
  page: "#EDE6D1"
  page-light: "#F5EFDF"
  page-edge: "#CDC4A9"
  ink: "#2B2838"
  ink-soft: "#5B5868"
  placeholder: "#8C8A96"
  knot-amber: "#C9A04A"
typography:
  hero:
    fontFamily: "IM Fell English, Georgia, serif"
    fontSize: "clamp(3.25rem, 2rem + 3.6vw, 5.25rem)"
    fontWeight: 400
    lineHeight: 1
  headline:
    fontFamily: "IM Fell English, Georgia, serif"
    fontSize: "2.625rem"
    fontWeight: 400
    lineHeight: 1.08
  title:
    fontFamily: "IM Fell English, Georgia, serif"
    fontSize: "2.125rem"
    fontWeight: 400
    lineHeight: 1.12
  name:
    fontFamily: "Alegreya, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.1
  quote:
    fontFamily: "Alegreya, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Alegreya Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Alegreya Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Alegreya Sans SC, Alegreya Sans, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.45
rounded:
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  frame: "24px"
  panel: "20px"
  card: "16px"
components:
  button-journal:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "14px 28px 14px 24px"
  button-confirm:
    backgroundColor: "{colors.moss}"
    textColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-confirm-hover:
    backgroundColor: "{colors.moss-deep}"
  button-night:
    backgroundColor: "{colors.dusk-deep}"
    textColor: "{colors.sky}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  chip:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  input-journal:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "14px 16px"
  panel-side:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    width: "440px"
  card-lantern:
    backgroundColor: "{colors.dusk-deep}"
    textColor: "{colors.sky}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
---

# Design System: Sprout

## Overview

**Creative North Star: "The Lantern-Lit Glade"**

Sprout is a cool dusk forest with one source of warmth. The Grove sits under a deep indigo sky fading to moss at the horizon, with stars, fireflies and drifting seeds moving slowly enough to feel like breathing. Against that cool field, amber light is reserved for Tomorrow's Lantern: the one thing that glows. The primary action, "Reflect on your day", is a parchment button with a quill, because reflecting means writing in the journal.

The night scene is the cover; the panels are the pages. Reading and writing happen on pale, paper-toned side panels (440px) that slide in from the right while the Grove stays visible and usable beside them. Typography carries the storybook voice: an antique-print face for the headers that lead a screen, a calligraphic book serif for tree names and the user's own words, and a humanist sans for everything functional.

Components feel tactile and bookish: crafted, paper-like, a little hand-made, never glossy or techy. Everything the user reads or writes is paper (grained cream pages, slips and inset sheets); controls that float on the night sky wear an engraved double rule; filled buttons are letterpressed. A fine film grain and soft vignette sit over the whole night scene, like an old illustrated plate.

**Key Characteristics:**
- Cool dusk field; warm amber light belongs to the Lantern alone.
- Grained paper for everything read or written, beside the scenery, never modals over it.
- Engraved double-rule frames for controls on the night; letterpress depth on filled buttons.
- Three type voices with strict jobs: heading (IM Fell), story (Alegreya), interface (Alegreya Sans).
- Slow, quiet ambient motion; one polished moment (the leaf flying onto its tree).
- Plain language over metaphor in every label.

## Colors

A two-temperature palette: cool indigo, moss and mist for the world; amber for light; berry only for errors.

### Primary
- **Lantern Amber** (#E9B44C): the Lantern's light (its glow, the warm wash on its card, the "Tomorrow's Lantern" label), focus rings, and the text-selection highlight. Its rarity is the point.

### Secondary
- **Moss** (#3F5A36): confirming actions on light panels ("Save", "Grow 3 leaves"), inline text links and actions, the input focus border, bloom labels.
- **Lichen** (#9DB27C): quiet tints behind evidence quotes (at 15%) and the moss glow at the horizon.

### Tertiary
- **Berry** (#B8486A): errors and destructive hover only. Never decoration.

### Neutral
- **Dusk Deep** (#232042) and **Dusk** (#2F2C52): the night sky, translucent fills for controls floating over the Grove.
- **Sky** (#EEF0E2) and **Sky Soft** (#C4CAB4): text on dusk; Sky Soft for secondary text and leaf counts.
- **Panel** (#F3F5EC), **Field** (#FBFCF7), **Mist** (#E4E9DA): paper surfaces; Field for inputs and the entry being read.
- **Ink** (#2B2838) and **Ink Soft** (#5B5868): text on paper; Ink Soft for secondary text, dates and metadata.
- **Line** (#C8D1B6): borders and dividers on paper.

### Named Rules
**The One Lantern Rule.** Only the Lantern glows. Amber elsewhere is thread-thin (focus, selection), never a fill.

**The Plain Error Rule.** Berry appears only when something went wrong or is about to be removed.

## Typography

**Heading Font:** IM Fell English (with Georgia)
**Story Font:** Alegreya (with Georgia)
**Interface Font:** Alegreya Sans (with Segoe UI, system-ui); Alegreya Sans SC for labels

**Character:** an antique printed title over a lively book serif, with a humanist sans that shares Alegreya's skeleton, so the three voices read as one family across centuries.

### Hierarchy
- **Hero** (IM Fell 400, clamp(3.25rem, 2rem + 3.6vw, 5.25rem), 1): the single onboarding question. One per product, not per page.
- **Headline** (IM Fell 400, 2.625rem, 1.08): the goal over the Grove, onboarding steps.
- **Title** (IM Fell 400, 2.125rem, 1.12): every panel and drawer title.
- **Name** (Alegreya 500, 1.5rem, 1.1): a tree's name in the Grove.
- **Quote** (Alegreya 400, 1.0625rem, 1.55): evidence quotes and journal text, always in the user's own words.
- **Body** (Alegreya Sans 400, 1.0625rem, 1.5): interface text and interpretations (700 for an interpretation's headline).
- **Small** (Alegreya Sans 400, 0.9375rem, 1.45): descriptions, counts, dates, helper text.
- **Label** (Alegreya Sans SC 700, 0.9375rem): the few labels that name a thing: Tomorrow's Lantern, New growth, A knot, Your entry.

### Named Rules
**The Three Voices Rule.** IM Fell only leads a screen; Alegreya only carries names and the user's words; Alegreya Sans does everything else. The one control set in a serif is the journal button, whose label is the title of the book.

**The Their Words Rule.** Anything quoted from the journal is set in Alegreya inside curly quotes, upright. Italic is reserved for the surrounding context when an entry is expanded.

**The Night Weight Rule.** Light text on dusk steps up one weight (500) so it doesn't thin out.

## Layout

The Grove is a full-viewport pannable, zoomable canvas. Everything over it sits on one frame with a 24px inset: the goal (Headline) and "Your journal" share a top row, with Tomorrow's Lantern directly under the goal (max 32rem wide) so the screen reads goal, next step, evidence, action; "Reflect on your day" and the zoom controls share one bottom row with aligned bottoms, the CTA centered on the visible Grove. The trees fill the space between the header and the bottom row, measured live, standing on a ground line just above the bottom row.

Side panels are 440px wide, slide in from the right, and the frame's controls make room for them; on the journal panel, the CTA steps aside. Panels use 20px padding and a vertical timeline (a 2px rule with leaf or dot markers) for dated history. Prose in panels stays well under 75ch.

Desktop is the target. Below 900px the bottom row wraps and panels go full width.

## Elevation & Depth

Depth comes from the scene (layered hills, mist, light) more than from shadows. Shadows are soft, offset downward, and tinted with the night (rgba(10,8,30,…)): floating controls and popovers lift off the dusk, panels cast a long soft shadow leftward onto the Grove. Translucent dusk fills with backdrop blur are used for controls that float over moving scenery, so text stays legible over fireflies.

### Shadow Vocabulary
- **Lantern lift** (`box-shadow: 0 14px 30px -12px rgba(10,8,30,.8)`): celebratory toasts.
- **Popover** (`box-shadow: 0 18px 40px -16px rgba(10,8,30,.7)`): the leaf evidence pop-up.
- **Panel cast** (`box-shadow: -20px 0 50px -20px rgba(10,8,30,.55)`): side panels over the Grove.

### Materials
- **Page** (`paper-page`): side panels and the onboarding pillar page. Warm parchment (#EDE6D1) with grain, a shaded spine and stacked page edges on the left.
- **Slip** (`paper`): loose paper on the night or on a page: the leaf pop-up, the goal input.
- **Journal** (`journal-cover`): the "Reflect on your day" button.
- **Inset sheet** (`paper-inset`): lighter paper (#F5EFDF) set into a page for the entry being written or read, pillar rows, fields.
- **Ruled** (`ruled`): faint notebook rules under each line of the journal textarea.
- **Engraved frame** (`night-frame`): dusk fill with a sky hairline and an inner amber rule, for "Your journal", the zoom controls and the tip.
- **Letterpress** (`press`): a lit top edge and pressed bottom on filled buttons; it sinks 1px when pressed.
- **Plate grain** (`grain-overlay`): fine grain and a vignette over the night scene.

### Named Rules
**The Lit-Not-Lifted Rule.** Importance is shown with light (amber glow) before elevation. No glowing halos without offset on cards; glow belongs to light sources.

## Shapes

Buttons, chips and floating controls are full pills. Paper is cut, not molded: pages and slips use near-square corners (2–6px), inset sheets and cards 6px; small hit areas (close buttons) use 8px. Leaves are drawn as a pointed oval (one rounded and one sharp corner, rotated 45°) and reused as bullets and markers wherever a confirmed leaf is referenced; friction uses a round dot. Icons are drawn SVG with a single 1.75 stroke and round caps.

## Components

### Buttons
- **Shape:** full pill (9999px).
- **Primary (Journal):** `journal-cover`: a grained parchment pill in the same engraved double rule as the night controls (a dark hairline outside, a moss rule inside), a drawn quill, and the label in IM Fell (1.5rem). Lifts 2px on hover. Used only for "Reflect on your day".
- **Confirm:** moss fill, panel-colored text, for committing actions inside paper panels.
- **Night:** translucent dusk with a hairline sky border, for secondary actions over the Grove ("Your journal", zoom).
- **Text actions:** moss, 700, no fill; underline offset 2px when inline.
- **Hover / Focus:** a slightly lighter or deeper fill on hover; a 2px amber focus outline with 2px offset everywhere.

### Chips
- **Style:** pill, Field fill with a Line border on paper; translucent sky on dusk. Used for writing prompts and goal suggestions.

### Cards / Containers
- **Corner Style:** 6px, paper-cut.
- **Background:** tinted by meaning: lichen for a new leaf, warm amber for a knot, dusk for the Lantern.
- **Border:** 1px hairline in the tint's own hue; dashed Line for a pruned item.
- **Internal Padding:** 16px.

### Inputs / Fields
- **Style:** an inset sheet (lighter paper, 1px page-edge border, 6px corners) with notebook rules; 19px text on a 30px line.
- **Focus:** border shifts to moss with a soft 3px amber ring; caret is moss.

### Tomorrow's Lantern (signature)
A small drawn lantern hanging on a cord under the goal, as if from a branch above the glade, with moths orbiting its glow. Beside it, with no card, sit the amber small-caps label and the next step in Sky (500) with a soft dark text shadow. Unlit, with no moths and a Sky Soft invitation line, until the first confirmation. A new step fades in and the lantern flares. When the user follows it, the lantern flares and its moths break orbit, flutter out across the sky and settle in as fireflies for the rest of the visit, while new moths gather at the lantern (`FreedMoths`); nothing is counted or kept. With reduced motion the fireflies simply appear.

### Evidence quote (signature)
The user's words in Alegreya, curly-quoted, on a 15% tint of the item's meaning, with a small moss "in your words" mark where provenance matters.

## Do's and Don'ts

### Do:
- **Do** keep amber light for the Lantern; elsewhere amber is only thread (focus, selection).
- **Do** put reading and writing on paper panels beside the Grove, keeping the Grove visible.
- **Do** set every user quote in Alegreya inside curly quotes.
- **Do** keep every floating control on the 24px frame and bottom-aligned with its row.
- **Do** honor reduced motion: the scenery holds still, fireflies stay as soft lights.

### Don't:
- **Don't** show streaks, scores, percentages, or wilting.
- **Don't** set interface controls in IM Fell or Alegreya.
- **Don't** use berry for anything but errors and removal.
- **Don't** use typed glyphs or emoji as icons; draw them in the shared 1.75 stroke.
- **Don't** cover the Grove with a modal for tasks that a side panel can hold.
