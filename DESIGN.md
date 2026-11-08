# DESIGN: Laut (v1)

Tenang dan meyakinkan untuk layanan yang menyentuh kesehatan, uang, atau belajar.

Dial: ENERGY 1 / RHYTHM 2 / MOTION 2

## Identity

A calm, trustworthy interface for services that touch health, money, or learning, used by people who may be anxious or unfamiliar with the topic. Cool pale teal backgrounds, deep teal as the main color, and one warm terracotta accent for the thing that needs attention.

## Personality

Reassuring, clear, unhurried. It explains terms in plain words and never pressures the user. Numbers always come with their meaning.

## Mood

Quiet confidence. Soft edges, ample space, nothing flashy.

## Identity motif

One typeface family in two weights, generous line height, and rounded containers with a single clear next step per screen. Progress is shown as simple steps with text labels, never as decoration.

## Layout

- Mobile first; single column with 20px gutters. On web, a centered column up to 720px for tasks and up to 1040px for overviews.
- One focal point per screen: the key number or the single next step, set large; supporting detail follows in a smaller size.
- Vary composition: a summary block, then a step list, then a plain explanatory paragraph with a margin note, then a table. Do not repeat identical cards.
- Space is generous: 24 to 40px between sections, 12 to 16px within groups. Line height 1.6 for body text.

## Components

- Buttons: height 48px, control radius, primary filled deep teal with pale text; secondary is a 1.5px border; one primary action per screen.
- Inputs: control radius, 1.5px border, visible label above, helper text under the field explaining why the information is needed, errors in the danger color with a text description.
- Cards: card radius, 1px border, surface background, one soft overlay shadow only on floating elements.
- Status and alerts: text first, with an icon and color as support. The terracotta accent marks attention, never error; errors use the danger color.
- Forms: one question group per screen on mobile, a progress label such as "Step 2 of 4", a back action that never loses entered data.
- Required states: empty (what this area will show and how to start), loading (text plus gentle progress), error (plain cause, whether data is safe, how to retry), success (what happened and what comes next).
- Radio buttons and checkboxes: the whole option row is the label and the 48px tap target, not the small native control. Selecting an option may reveal a short hint under it.
- Tap targets at least 48px. Every enabled control shows a pointer cursor and has distinct hover, active, and disabled states.
- Touch layouts: every interactive element, including the logo link, navigation links, and icon buttons, has a tap target of at least 44px in height and width, even when its visible text is smaller.

## Data visualization

- One accent per chart: terracotta marks the point or series that needs attention; other series use tints of deep teal between 100% and 40%.
- Chart colors come from the CSS variables so they follow the active theme; no hardcoded hex values. Separate adjacent segments with a 2px stroke in the background color.
- Highlight only when a real difference exists: if the top values tie, no series gets the accent and the accompanying text says so.
- Color never carries meaning alone: label values directly and add a one-sentence plain-language summary under each chart.
- No gradients, 3D, or shadows. Prefer line and bar charts with few series.

## Motion

Gentle. 180ms fades and slides for step changes and sheets; progress indicators move smoothly. No looping or attention-grabbing animation. All non-essential motion stops under prefers-reduced-motion.

## Theme behavior

Light is the default. A dark theme is complete, deep teal-black, and verified. Follow the system setting unless the user chooses.

## Palette

| Role | Light | Dark |
|---|---|---|
| Background | #EDF4F5 | #0E1A1E |
| Surface | #FFFFFF | #15262B |
| Text | #12262B | #E6F0F2 |
| Text muted | #48606A | #9FB6BD |
| Primary | #0E4D5C | #7CC6D6 |
| On primary | #EDF4F5 | #0E1A1E |
| Accent (one deliberate accent) | #A84A14 | #F0A070 |
| Border | #C5D6DA | #2A4249 |
| Success | #1F6B45 | #7FCB9C |
| Danger | #A32A24 | #F08B84 |

Core colors: background, text, primary, plus one accent. Success and danger appear only for real states.

## Typography

- Headings and numerals: Plus Jakarta Sans (system-ui, sans-serif), weights 600, 700. Reason: Dirancang di Jakarta dengan keterbacaan tinggi untuk pembaca Indonesia; bobot tebalnya tegas tanpa terasa dingin.
- Body and interface: Plus Jakarta Sans (system-ui, sans-serif), weights 400, 500, 600. Reason: Satu keluarga untuk judul dan isi menjaga suasana tenang dan konsisten, dengan angka yang jelas untuk tagihan dan metrik.
- Code only: IBM Plex Mono (ui-monospace, monospace), weights 400, 500. Reason: Hanya untuk kode referensi dan nomor transaksi.

## Shape and elevation

- Tag radius 6px, control radius 10px, card radius 14px, overlay radius 18px. Pill shapes are not used except round avatars.
- Shadow only on overlays: `0 10px 28px rgba(14, 77, 92, 0.16)`. Cards and bars use a 1px border instead.

## Icons

- Phosphor Icons, weight regular. Reason: Garis bersih dengan ujung lembut cocok dengan nuansa tenang; ikon dipakai hanya bila membantu mengenali tindakan atau status.

## CSS variables

```css
:root {
  --bg: #EDF4F5;
  --surface: #FFFFFF;
  --text: #12262B;
  --text-muted: #48606A;
  --primary: #0E4D5C;
  --on-primary: #EDF4F5;
  --accent: #A84A14;
  --border: #C5D6DA;
  --success: #1F6B45;
  --danger: #A32A24;
  --font-heading: "Plus Jakarta Sans", system-ui, sans-serif;
  --font-body: "Plus Jakarta Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --radius-tag: 6px;
  --radius-control: 10px;
  --radius-card: 14px;
  --radius-overlay: 18px;
  --shadow-overlay: 0 10px 28px rgba(14, 77, 92, 0.16);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0E1A1E;
    --surface: #15262B;
    --text: #E6F0F2;
    --text-muted: #9FB6BD;
    --primary: #7CC6D6;
    --on-primary: #0E1A1E;
    --accent: #F0A070;
    --border: #2A4249;
    --success: #7FCB9C;
    --danger: #F08B84;
  }
}

:root[data-theme="dark"] {
  --bg: #0E1A1E;
  --surface: #15262B;
  --text: #E6F0F2;
  --text-muted: #9FB6BD;
  --primary: #7CC6D6;
  --on-primary: #0E1A1E;
  --accent: #F0A070;
  --border: #2A4249;
  --success: #7FCB9C;
  --danger: #F08B84;
}
```


## Avoid

- gradients, glow, frosted surfaces, mesh or orb backgrounds
- urgency tricks: countdowns, "limited" labels, red alarm styling for non-errors
- invented testimonials, patient or customer photos, compliance badges, or medical, security, or return claims without evidence
- stock or blob illustrations; emoji used as icons
- pill-shaped controls; uppercase labels with wide letter-spacing
- generic call-to-action labels such as "Learn More"; marketing buzzwords; em dashes in interface text

## Platform notes

- Mobile: bottom navigation with at most four items, step forms full screen, safe-area insets respected.
- Web: top navigation with real destinations only, task column up to 720px, overview up to 1040px.
