---
name: G-TEC Activity Reporting
description: The institute's front office, a navy token board of live LED counts over a white work counter.
colors:
  primary: "#004282"
  primary-foreground: "#ffffff"
  accent: "#e3ecf7"
  accent-foreground: "#003366"
  brand-red: "#ff0000"
  destructive: "#b4123a"
  board: "#002b55"
  board-well: "#001f40"
  board-line: "#13406e"
  board-foreground: "#ffffff"
  board-muted: "#a9bfd9"
  led-red: "#ff3b2e"
  led-amber: "#ffb62e"
  led-white: "#f3f7fc"
  led-off: "rgb(255 255 255 / 0.07)"
  background: "#f1f4f8"
  foreground: "#0c1a2c"
  card: "#ffffff"
  secondary: "#e9eef5"
  secondary-foreground: "#1b3150"
  muted-foreground: "#52627a"
  border: "#dbe3ec"
  input: "#c9d4e1"
  ring: "#2b6cb0"
typography:
  board-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  led:
    fontFamily: "Doto, monospace"
    fontSize: "2.5rem"
    fontWeight: 900
    lineHeight: 1
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  ticket-number:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.43
rounded:
  sm: "4.8px"
  md: "6.4px"
  lg: "8px"
  xl: "11.2px"
  full: "9999px"
spacing:
  page-x-mobile: "16px"
  page-x: "24px"
  section-gap: "24px"
  panel-pad-mobile: "16px"
  panel-pad: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  button-destructive-confirm:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  button-board:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  button-board-ghost:
    textColor: "{colors.board-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "36px"
  counter-panel:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "{spacing.panel-pad}"
  counter-well:
    backgroundColor: "{colors.board-well}"
    rounded: "{rounded.lg}"
    padding: "12px 20px 14px"
  lamp-chip:
    rounded: "{rounded.md}"
    typography: "{typography.label}"
    padding: "2px 8px"
---

# Design System: G-TEC Activity Reporting

## Overview

**Creative North Star: "The Front Office Token Board"**

Every signed-in page opens under a full-width deep-navy board, the kind that hangs above a front-office counter: the real G-TEC logo, the navigation, the page title with its one primary action, and a row of LED dot-matrix counters showing the numbers that matter right now (hours logged today, what is pending, the open queue). Below it, a white counter on a cool pale ground is where the work gets done: filters, tables, logs, forms.

The two halves never trade places. The board announces; the counter works. Numbers earn LED only when they are live counts or ticket T-numbers at display size, and a changing count flares once like a board stepping to the next digit. State is spoken in one lamp vocabulary across activities and tickets, priority is read as ink brightness, and red is reserved for the brand and for urgency, with destructive actions carried by a separate deep rose.

The system is dense and operational, built for staff on office desktops and phones alike. It refuses the default white admin panel with a grid of same-size stat cards.

**Key Characteristics:**
- Navy token board header on every authenticated page, white counter below.
- LED dot-matrix numerals (Doto 900) with visible unlit 8s behind fixed digit positions.
- One sans (Geist) in regular, medium, and semibold; Geist Mono bold only for T-numbers and technical strings.
- A single lamp-plus-word state vocabulary.
- Flat counter surfaces with hairline borders; depth only where something floats.

## Colors

Institutional navy and white, lit by three LED colours on the board and a small lamp palette on the counter.

### Primary
- **Counter Navy** (primary): every primary action on the counter, active focus accents, the in-hand lamp, bold T-numbers, text selection and caret.
- **Board Navy** (board): the token board panel itself; also the browser theme colour. Deeper than Counter Navy so the board reads as a separate object.
- **Board Well** (board-well): the recessed counter strip and avatar disc inside the board.
- **Board Line** (board-line): hairline dividers and inset rings on the board.

### Secondary
- **LED Red** (led-red): lit numerals that demand attention (the sign-in clock, the 404 readout, urgent counts). Always with its own glow.
- **LED Amber** (led-amber): lit numerals for waiting or short-of-target values (pending counts, hours below the 8h day).
- **LED White** (led-white): lit numerals for neutral or met values.
- **Unlit Segment** (led-off): the ghost 8s behind every LED readout.

### Tertiary
- **Brand Red** (brand-red): the G-TEC red, spent only on the active-nav underline on the board.
- **Deep Rose** (destructive): destructive confirm buttons and invalid-field borders. Never used for urgency or brand.

### Neutral
- **Cool Ground** (background): the page ground under the counter.
- **Counter White** (card): panels, dialogs, inputs, popovers.
- **Ink** (foreground): body text; its 80% tint is the medium-priority ink.
- **Slate Ink** (muted-foreground): secondary text, low-priority ink, table metadata.
- **Pale Steel** (secondary / accent): neutral chips (source, category) and the in-hand lamp chip.
- **Hairline** (border) and **Field Edge** (input): panel borders and form-field strokes.
- **Board Mist** (board-muted): secondary text and inactive nav on the board.

### Named Rules
**The Red Is Brand Rule.** Red means brand or urgent only: the active-nav underline, urgent priority, urgent lamps, and LED red. Destructive actions use Deep Rose, never red.

**The Lamp Rule.** State is always a lamp plus a word, from one fixed vocabulary: amber = waiting (Pending, Open), navy = in hand (In progress, Taken up), green = done (Completed, Solved), slate = parked (On hold, Duplicate, Locked), violet = with someone else (Forwarded), red = urgent. Violet is an approved named lamp for Forwarded only. Don't invent new state colours.

**The Board Owns LED Rule.** LED colours light only Doto numerals. Counter UI never borrows led-red, led-amber, or led-white.

## Typography

**Display Font:** Geist (with system sans fallback)
**Body Font:** Geist
**Label/Mono Font:** Doto 900 for LED numerals; Geist Mono for T-numbers and technical strings

**Character:** One quiet, legible sans carries every word; the dot-matrix face carries only numbers, so the board reads like hardware and the counter reads like paperwork.

### Hierarchy
- **Board Title** (600, 1.5rem mobile to 1.75rem desktop, tight tracking): the page title on the board, left of the primary action.
- **LED** (Doto 900, line-height 1): board counters at 1.9rem to 2.5rem, the page's primary counter at 2.4rem to 3.5rem in a wider cell; display readouts (sign-in clock 3rem, 404 at 4.5rem).
- **Title** (600, 1rem, tight tracking): panel headings on the counter; dialog and sign-in headings go to 1.25rem.
- **Body** (400, 0.875rem): table cells, logs, descriptions. Tables use tabular figures.
- **Label** (500, 0.75rem): counter labels on the board, lamp chips, fact labels. Sentence case, no tracking.
- **Ticket Number** (Geist Mono 700, 0.875rem, Counter Navy): T-numbers in table rows.

### Named Rules
**The Numbers-Only LED Rule.** Doto is for counts, the clock, and T-numbers at display size. It never sets words, labels, or table-size T-numbers, where it reads thin; rows use bold navy mono instead.

**The Fixed Digit Rule.** An LED readout reserves every digit position with an unlit 8, so a changing count never shifts the layout.

## Layout

A single centred column, max width 72rem (1152px), with 16px side padding on phones and 24px from the small breakpoint (640px). The board spans the full viewport width with its content inside the same column; the counter begins directly under it with 24px vertical rhythm between panels.

The board stacks: a 64px brand row (logo, nav, user, sign out), then title and action (wrapping on narrow screens), then the counter strip. Counters sit in one row divided by hairlines; the page's primary counter takes 1.6 times the width of the others. On phones, the nav moves to its own row under the brand row, and the counter strip scrolls horizontally with snap points and fixed cell widths (primary 176px, others 144px). Tables become stacked rows on phones.

Hours are right-aligned with tabular figures and read against an 8-hour day ("of 8" beside the hours counter; amber until met).

## Elevation & Depth

The counter is flat. Panels separate from the ground by tone and a hairline border with the faintest navy-tinted lift. Real shadows appear only on things that float above the page: dialogs, popovers, the sign-in card over the board, and the white board button. On the board, depth comes from wells and inset rings, and LED numerals carry a soft coloured glow of their own light.

### Shadow Vocabulary
- **Panel Hairline Lift** (`box-shadow: 0 1px 2px rgb(0 31 64 / 0.04)`): counter panels and the recent-activity panel.
- **Dialog Float** (`box-shadow: 0 24px 48px -12px rgb(0 31 64 / 0.35)`): modal dialogs.
- **Board Card Float** (`box-shadow: 0 24px 60px -20px rgb(0 0 0 / 0.6)`): the sign-in card sitting on the navy board.
- **Board Button Lift** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.4) inset, 0 6px 16px -6px rgb(0 0 0 / 0.5)`): the white primary action on the board.
- **LED Glow** (`text-shadow: 0 0 12px rgb(255 59 46 / 0.55)`, amber at 0.5, white at 10px / 0.35): lit LED numerals only.

### Named Rules
**The Flat Counter Rule.** Counter surfaces are flat at rest. Shadows belong to floating layers and the board's own light, never to cards in a grid.

## Shapes

Gently rounded throughout from an 8px base radius: panels and dialogs at 11.2px, buttons, inputs, selects and the counter well at 8px, chips at 6.4px. Pills appear only where the object is a pill or dot: avatar discs, lamp dots, the nav underline, lifecycle track bars, and the four priority bars (1px corners). Borders are single 1px hairlines; panels clip their contents so tables run edge to edge.

## Components

### Buttons
Quiet, compact, and unmistakably navy.
- **Shape:** gently rounded (8px), 36px tall, 12px horizontal padding; small (32px) and large (40px) sizes exist.
- **Primary:** Counter Navy fill, white text; hover drops to 80% opacity. Presses nudge down 1px.
- **Focus:** Ring Blue border with a 3px ring at 50%.
- **Outline / Ghost:** ground-tone fill with hairline border, or transparent; hover to muted.
- **Board:** on the navy board the primary action inverts to a white button with navy text and the Board Button Lift; hover to #e8f0fa. The secondary board action is a ghost with a Board Line inset ring and white text; hover to 10% white. Board focus rings are 50% white.
- **Destructive confirm:** Deep Rose fill with white text, only inside a confirm dialog.

### Chips (Lamps)
- **Style:** 6.4px radius, 2px by 8px padding, 12px medium text, a 6px lamp dot before the word, tinted background from the lamp's family (amber-50, accent, emerald-50, slate-100, violet-50, red-50).
- **Neutral chips:** source and category use Pale Steel with no dot.
- **Locked:** slate chip with a small lock icon instead of the dot.

### Priority Mark
Four filled bars rising left to right (3px wide, 5px to 11px tall), lit from the left by level, followed by the word. Ink brightens with priority: Low in Slate Ink, Medium in 80% Ink, High in full Ink semibold, Urgent in red semibold. Only Urgent spends red.

### Cards / Containers
- **Corner Style:** 11.2px.
- **Background:** Counter White on Cool Ground.
- **Shadow Strategy:** Panel Hairline Lift (see Elevation).
- **Border:** 1px Hairline; the heading row is split from the body by another hairline.
- **Internal Padding:** 16px on phones, 20px from 640px; flush mode lets tables run edge to edge.
- **Empty states:** centred, with a muted icon, a semibold line, and a sentence saying what to do next.

### Inputs / Fields
- **Style:** Counter White fill, 1px Field Edge stroke, 8px radius, 36px tall, 10px horizontal padding. Select triggers match exactly; native selects on the Tickets filter are styled to the same trigger.
- **Focus:** border shifts to Ring Blue with a 3px 50% ring.
- **Error / Disabled:** Deep Rose border with a 20% rose ring; disabled at 50% opacity.

### Navigation
Sits on the board. Links are 14px medium, 44px minimum height, Board Mist at rest and white on hover. The active link is white with a 2px Brand Red underline inset 12px from each side. On phones the links move to a full-width row beneath the brand bar.

### Token Board (signature)
The navy header described in Layout: logo, nav, initials disc and sign out; page title with subtitle and actions; then the counter strip, a Board Well bar with an inset Board Line ring and hairline dividers. Each counter is a 12px Board Mist label over an LED readout with an optional hint ("of 8"). Tone carries meaning: amber while something is waiting or short, white when neutral or met.

### LED Readout (signature)
Doto 900 digits over their own unlit 8s, lit in red, amber, or white with a matching glow. When the value changes after first paint it flares once (brightness 2.2, 1px blur, 2px lift, easing out over 420ms on cubic-bezier(0.16, 1, 0.3, 1)); the flare is removed under reduced motion. Exposed to assistive tech as the plain value.

### Lifecycle Track
Four equal bars (Open, Taken up, Forwarded, Solved) with labels under each. The current stage is lit in its lamp colour, passed stages in 35% navy, future stages in Hairline. Duplicate sits off the track as a slate note.

### Confirm Dialog
Every destructive action passes through a small dialog: title, description, an outline Cancel, and a Deep Rose confirm that reads "Working…" while pending.

## Do's and Don'ts

### Do:
- **Do** open every signed-in page with the token board: title left, one primary action right, live counters beneath.
- **Do** make one counter per page the primary (wider cell, larger readout) and tone it amber until its target is met.
- **Do** show state as a lamp plus a word from the fixed vocabulary; Forwarded is violet.
- **Do** read priority as ink brightness with the four-bar mark.
- **Do** set T-numbers in bold navy Geist Mono in tables, and in Doto only at display size.
- **Do** right-align hours with tabular figures against the 8-hour day.
- **Do** wrap destructive actions in the confirm dialog with a Deep Rose button.

### Don't:
- **Don't** build rows of same-size white stat cards; counts live on the board as LED readouts.
- **Don't** use red for destructive actions or decoration; red is brand and urgency only.
- **Don't** set words, labels, or small numbers in Doto.
- **Don't** use LED colours on the white counter.
- **Don't** add shadows to counter panels beyond the hairline lift.
- **Don't** add new lamp colours for new states; map them to the existing six.
