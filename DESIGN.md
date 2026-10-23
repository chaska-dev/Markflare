---
name: Markflare
description: A self-hosted block editor on Cloudflare, presented as a signal kit with its instructions printed on the label.
colors:
  flare: "#f38020"
  ink: "#141414"
  label-white: "#ffffff"
  aluminium: "#b3b3ae"
  aluminium-deep: "#7d7d78"
  ink-soft: "#4a2a10"
  ink-quiet: "#55554f"
  paper-soft: "#bdbdb6"
typography:
  display:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "clamp(4.6rem, 20.4vw, 18.2rem)"
    fontWeight: 800
    lineHeight: 0.78
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "clamp(3rem, 8vw, 6.5rem)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "clamp(1.6rem, 2.3vw, 2.15rem)"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "'Barlow', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace"
    fontSize: "0.84rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  none: "0px"
  rivet: "50%"
spacing:
  rule: "3px"
  rule-heavy: "6px"
  gutter: "clamp(36px, 6vw, 96px)"
  gutter-mobile: "28px"
  section: "clamp(64px, 8vw, 120px)"
  plate-inset: "18px"
  button-gap: "12px"
components:
  button-solid:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.label-white}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "52px"
  button-solid-hover:
    backgroundColor: "{colors.label-white}"
    textColor: "{colors.ink}"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "52px"
  button-line-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.flare}"
  button-flare:
    backgroundColor: "{colors.flare}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "52px"
  button-flare-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.flare}"
  command-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.label-white}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    padding: "15px 18px"
  tag:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.flare}"
    rounded: "{rounded.none}"
    padding: "3px 9px 4px"
  plate:
    backgroundColor: "{colors.aluminium}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "18px 18px 0"
  nav:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-soft}"
    typography: "{typography.label}"
    height: "56px"
---

# Design System: Markflare

## Overview

**Creative North Star: "The Signal Kit"**

Markflare presents like a piece of field equipment: one orange case, its parts listed on the lid, its operating instructions printed in heavy condensed capitals on a label. Every surface is a flat spot ink. Whole regions flood with flare orange, ink black, label white, or aluminium grey, and nothing is tinted, blended, or lifted. Structure comes from thick black rules and boxed panels, the way an equipment label divides its fields, not from cards floating on a background.

Density is high and confident. Headings are set huge and tight in Barlow Condensed caps, body copy stays in plain Barlow at a readable measure, and JetBrains Mono appears only where something is meant to be typed. Real product screenshots sit inside riveted aluminium plates, never as glowing mockups. The single piece of motion is the fuse, a dashed cord down the left gutter of each section that burns solid as the section scrolls past.

The world refuses the dark SaaS hero: no glowing screenshot, no gradient wash, no grid of rounded cards with soft shadows.

**Key Characteristics:**
- Four flat inks flood whole sections; regions alternate flare, label white, ink, aluminium.
- Heavy condensed uppercase for every label, title, and button.
- Thick ink rules (3px, 6px) divide content into label fields.
- Square corners everywhere; the only circle is a rivet.
- Real screenshots live in riveted aluminium plates with a stamped caption rail.
- One signature motion: the fuse burns down the gutter on scroll.

## Colors

Four spot inks plus three ground-mixed secondary text tones; no tints, no transparency, no blends.

### Primary
- **Flare Orange** (#f38020): the case. Floods the page ground, the hero, the specs and close sections. On ink it becomes the accent: section titles, step numbers, pictogram squares, the copy button, links, and the active-language chip. It is a brand commitment and must remain.

### Neutral
- **Signal Ink** (#141414): text on light grounds, every rule and border, the sticky nav, the instructions section ground, the footer, command bands, tags, and solid buttons.
- **Label White** (#ffffff): the contents section ground (the printed label), text on ink, and the hover fill of solid buttons.
- **Aluminium** (#b3b3ae): plate and nameplate surfaces that hold screenshots and the spec sheet.
- **Deep Aluminium** (#7d7d78): rivet heads and the quieter rules that divide steps and outline command bands on ink.
- **Burnt Ink** (#4a2a10): secondary text on flare (contents-strip descriptions).
- **Quiet Ink** (#55554f): secondary text on label white (section intros).
- **Soft Paper** (#bdbdb6): secondary text and resting nav links on ink.

### Named Rules
**The Flood Rule.** Color is applied by region, not by sprinkle. A section takes one ground ink edge to edge; accents are the other inks, never a lighter or translucent version of the ground.

**The Mixed-Secondary Rule.** Secondary text is mixed from the ground it sits on (Burnt Ink on flare, Quiet Ink on white, Soft Paper on ink). Never use one neutral grey across all grounds, and never use opacity to quiet text.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow), weights 600 / 700 / 800
**Body Font:** Barlow (with Helvetica Neue, Arial), weights 400 / 500 / 600
**Label/Mono Font:** JetBrains Mono (with ui-monospace, Consolas), weights 400 / 500, ligatures off

**Character:** Condensed industrial caps do the talking, like stencilled equipment markings; the humanist Barlow body keeps the instructions easy to read. Mono is reserved for literal commands, bindings, and values.

### Hierarchy
- **Display** (800, clamp(4.6rem, 20.4vw, 18.2rem), 0.78): the wordmark only, spanning the full frame width like the name printed on a case. The closing call to action uses the same voice slightly smaller (clamp(4rem, 13vw, 12rem), 0.82).
- **Headline** (800, clamp(3rem, 8vw, 6.5rem), 0.88, uppercase, balanced): section titles. On ink they turn flare.
- **Title** (700, clamp(1.6rem, 2.3vw, 2.15rem), 1.0, uppercase): manifest item names and step titles. The hero pitch line runs one step larger (700, clamp(2.2rem, 3.6vw, 3.4rem), 0.98).
- **Body** (400, 1.0625rem, 1.55): running copy, capped at a 62ch measure. Leads and intros step up to 1.1-1.2rem at weight 500.
- **Label** (600-700, 1.05-1.25rem, 0.02-0.04em, uppercase): nav links, buttons, plate captions, tags, spec row keys.
- **Mono** (400, 0.84-0.9em, 1.6): commands, file names, bindings, and value tags only.

### Named Rules
**The Stamped Caps Rule.** Anything that names, labels, or acts is Barlow Condensed uppercase. Sentences are Barlow in sentence case. Never set body copy in caps.

**The Typed-Only Mono Rule.** JetBrains Mono appears only for text a user would type or read back from a terminal (commands, bindings, sizes, secret names). It is never a decorative label face.

## Layout

A full-bleed stack of flooded sections, each a frame with a fluid side gutter (clamp(36px, 6vw, 96px); 28px under 720px) and content capped at 1360px. Sections open with a headline and a short intro on a 7fr / 5fr grid closed by a heavy 6px rule, then run as ruled rows: the contents manifest (name / description / tag, 3.2fr / 6fr / 2fr), the numbered instruction steps (number / title with pictogram / body, 1.1fr / 3.4fr / 7.5fr), and the two-column spec sheet. Vertical section padding is clamp(64px, 8vw, 120px).

Rows collapse rather than reflow into cards: at 960px multi-column rows stack their body under the name, two-column grids go to one, and the hero contents strip goes from four cells to two (1080px) to one (560px). The sticky ink nav is 56px tall; its section links hide under 900px and the GitHub button drops its text under 420px.

**The Label Field Rule.** Content is divided by full-width ink rules, the way fields on an equipment label are divided. Rows sit between rules; they are not boxed individually.

## Elevation & Depth

The system is flat. There are no shadows, glows, or translucent overlays at any state. Depth is conveyed only by ink contrast between flooded regions, by heavy borders, and by the physical metaphor of the aluminium plate: a grey panel framed in a 3px ink border, with four rivets at its corners, holding a screenshot window inset 18px.

**The Flat Ink Rule.** No box-shadow, text-shadow, filter glow, or blended gradient anywhere. Hover and focus change fill and text color, never elevation.

## Shapes

Every container, button, tag, band, and plate is square-cornered (0px). Borders are thick and ink: 3px for standard rules and button outlines, 6px for section-closing rules and the spec nameplate, 2px for inner windows and secondary dividers. The only round form is the rivet (9px on plates, 14px on the nameplate, deep aluminium with an ink ring).

Two hard-stop stripe patterns belong to the world and are the only permitted uses of a repeating gradient: the hazard band (22px tall, -45deg, 16px ink / 16px flare stripes, no blending) that closes the hero once, and the fuse's dashed cord (10px dash, 8px gap).

**The One Tape Rule.** The hazard stripe appears once per page, as the band that closes the case. It is not a divider to repeat between sections.

## Components

### Buttons
Square punched-label buttons in heavy condensed caps.
- **Shape:** square (0px), 3px ink border, 52px minimum height, 0 22px padding, 10px icon gap, Barlow Condensed 700 at 1.25rem, 0.02em tracking.
- **Solid:** ink fill, label-white text; hover inverts to label-white fill, ink text.
- **Line:** transparent fill, ink text and border; hover floods ink with flare text.
- **Flare (on ink grounds):** flare fill and border with ink text; hover floods ink with flare text.
- **Hover / Focus:** 160ms color and fill swap on the house ease (cubic-bezier(0.16, 1, 0.3, 1)). Focus is a 3px ink outline at 3px offset, flare on ink grounds.

### Command Band
The only home of a shell command.
- **Style:** ink band, label-white mono text at 0.84rem, a flare `$` prompt, long commands wrap inside the band.
- **Copy button:** attached on the right behind a 3px flare divider, flare condensed caps on ink; hover floods flare with ink text; copied state turns label white. On an ink ground the band takes a 2px deep-aluminium outline to stay separate. Under 520px the copy text is visually hidden and only the icon shows.

### Tags
- **Style:** ink chip with flare text, 3px 9px 4px padding, condensed caps at 0.85rem; a mono variant (no caps, no tracking) carries literal values such as `25 MB` or `.md`.

### Aluminium Plate (signature)
A riveted inspection plate framing a real screenshot. Aluminium panel, 3px ink border, 18px inset (12px under 520px), a 2px-ink window with the image cropped by `object-fit: cover`, four rivets at the corners, and a caption stamped into the bottom rail in condensed caps (600, 1.05rem, 0.03em). The spec sheet is the same plate at nameplate scale: 6px border, 14px rivets, generous inset.

### Pictograms
Solid ink glyphs punched into a flare square on a 48px grid, no strokes, rendered at 56px beside each instruction step title.

### Navigation
- **Style:** sticky ink bar, 56px, brand mark plus wordmark in condensed 800 caps.
- **Links:** condensed 600 caps at 1.05rem, 0.04em, Soft Paper at rest, flare on hover (140ms).
- **Language switch:** current language is a flare chip with ink text; others are plain links.
- **GitHub:** 36px outline button with a 2px label-white border; hover floods flare.
- **Mobile:** section links hide under 900px; the GitHub button collapses to its icon under 420px.

### The Fuse (signature)
A 4px cord down the left gutter of every section (3px under 720px), dashed (10px on, 8px off) where unburned, with a square knot (16px, 13px on mobile) at the section top. A solid overlay burns downward with a CSS `view()` timeline across the range entry 40% to exit 40%. The cord is ink on light grounds and flare on ink. Under reduced motion, or without scroll-timeline support, it renders fully burned and static.

## Do's and Don'ts

### Do:
- **Do** flood whole sections with a single spot ink (#f38020, #141414, #ffffff, or #b3b3ae) and alternate grounds between neighbours.
- **Do** divide content with full-width ink rules: 3px between rows, 6px to close a section head.
- **Do** set every name, label, and button in Barlow Condensed uppercase, and running text in Barlow sentence case at a 62ch measure.
- **Do** put real screenshots inside the riveted aluminium plate with a stamped caption rail.
- **Do** put every shell command in the ink command band with a flare prompt and an attached copy button.
- **Do** mix secondary text from its ground: Burnt Ink on flare, Quiet Ink on white, Soft Paper on ink.
- **Do** give every new section the fuse and its knot, ink on light grounds and flare on ink.

### Don't:
- **Don't** use shadows, glows, blurs, or translucent tints at any state.
- **Don't** use blended gradients. Hard-stop repeating stripes (the hazard band, the fuse dash) are the only gradient use.
- **Don't** round corners on containers, buttons, tags, or images. Rivets are the only circles.
- **Don't** build a dark SaaS hero with a glowing screenshot or a grid of rounded cards.
- **Don't** use JetBrains Mono for headings or decorative labels.
- **Don't** repeat the hazard band as a section divider; it closes the case once.
- **Don't** quiet text with opacity or a single shared grey.
