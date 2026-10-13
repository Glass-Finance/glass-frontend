---
name: React Design System
description: Enforce the Glass design system, the ui/Button contract, Tailwind v4 CSS-first theming, and the repository's focus-treatment rules. Use when choosing a colour, radius, spacing value, button, focus style, or any other visual token.
---

# React Design System

## The one source of truth

`docs/design-system.md` is normative and was extracted from the Figma file
_Glass Design By AQ_ via the REST API. **When code disagrees with that file,
the code is wrong** — unless its section 0 says otherwise. Do not "tidy" a
value to match a Tailwind default; match the document.

It is mirrored at `../DESIGN-SYSTEM.md` at the workspace root. Keep the two in
sync when either changes.

> **That mirror does not currently exist.** `AGENTS.md` claims it does, but
> there is no `DESIGN-SYSTEM.md` at the repo root or the workspace root, and
> `docs/design-system.md` does not reference one. Treat `docs/design-system.md`
> as the only real copy, and do not create the mirror in order to satisfy the
> documentation. Raising this with the architecture lead is worthwhile — the
> claim is in `AGENTS.md`, so the fix belongs there first.

## Figma access is unavailable

`docs/design-system.md` section 0.2 records that the Figma MCP connection
cannot work: Figma's OAuth server only accepts clients in a fixed catalogue,
and registering OpenCode returns **403**.

Do not retry `opencode mcp auth figma` — it fails with an "OAuth app with
client id … doesn't exist" error and wastes time. If the design file is
genuinely needed, ask the human for a Figma read-only personal access token
and use the REST API directly.

Two further cautions from that file: the Figma file has no variables or styles
layer, so values come from raw node fills, strokes, radii and text styles; and
the file is internally inconsistent, so only `Primary Button + States` has
trustworthy variant props. Where a set contradicts itself, that component wins.

## Colour

Use only hexes listed in `docs/design-system.md`. The core palette includes
`#002fa7` brand, `#db0000` danger, `#001f6e` deep navy text and `#6b2fb5`
purple.

**Banned outright:** `#2547d0`, `#2535c3`, `#7c3aed`, `#4f46e5`, `#dc2626`,
and the six invented navies. The document lists all of them; read it rather
than relying on this summary.

The theme is CSS-first in `src/index.css` under Tailwind v4. There is **no
`tailwind.config.js`** and creating one is wrong.

## Radius

Radius is **4px** (`rounded-g-1`) at every state. The entire scale is 4, 8, 12
and 16. Do not introduce a value outside it.

## Buttons

Buttons go through `src/components/ui/Button` using its `variant` and `size`
props. A raw `<button>` with bespoke classes needs a stated reason — give it
in the summary rather than shipping one silently.

## Focus: a border colour change, never a ring

The canonical example is `src/components/ui/TextInput.jsx`, which uses
`focus:border-brand`.

- Do **not** add `focus:ring-*`, `focus-within:ring-*`, or a focus background
  fill. A brand-coloured ring reads as a second edge outside the border.
- For a borderless composite control such as a search box or a chip container,
  use `focus-within:border-brand`, and add a resting `border
border-transparent` first if the element has no border, so focus does not
  shift layout.
- Preserve semantic error and success focus colours where they are explicitly
  required.

Form controls are the documented exception to the global `:focus-visible`
outline defined in `src/index.css`. That rule is unlayered, so it outranks
both utility classes and the `@layer base` safety net for `border-color`.
Buttons and links keep the outline.

## Typography and assets

Typography, icons and the component sheet are documented in sections 7 to 9 of
`docs/design-system.md`. Fonts are imported with `@fontsource` in
`src/main.jsx` — never with a CSS `@import`.

## Two repos, two deploys

This repository deploys to `app.glasspay.app`. `glass-waitlist-v1` deploys to
`glasspay.app` and owns the public marketing surface.

Landing components here were the source of truth, but **changes do not
auto-sync**. Re-port them or flag the drift in the PR; never assume the other
repo picked up a change.

`npm run check:landing-sync` compares the shared landing and legal components
between the two repos and fails on drift — but **CI does not run it.** The
sibling repository is not checked out in `.github/workflows/ci.yml`, so the
script exits 0 with a SKIP notice unless `../glass-waitlist-v1` is present
alongside this clone. It is a local check only, and `docs/` records that this
pairing has already drifted once. Run it yourself before claiming a landing
change is consistent; do not assume CI caught it.

Cross-domain navigation goes through `goToApp()` in
`src/utils/deviceRedirect.js`, never a raw `navigate()`.

## Common rationalizations

- _"This hex is close enough to the brand colour."_ The document lists the
  banned values precisely because near-misses crept in before. Use `#002fa7`.
- _"I'll add a focus ring so it's clearly visible."_ The ring is the specific
  thing being avoided; it reads as a second edge. Change the border colour.
- _"Tailwind doesn't have that radius, so I'll round it."_ Use the 4/8/12/16
  scale. Unlisted radii are a design decision, not an implementation detail.
- _"This is a one-off button, so a raw button is fine."_ `ui/Button` exists to
  keep variants and sizes consistent. If a raw button is genuinely required,
  say so in the summary.
- _"The design isn't final yet, so I'll pick something sensible."_ Use the
  documented values as the provisional choice; they came from the source of
  truth.
- _"It's a landing component, so I'll just sync it across."_ There is no
  auto-sync. Re-port deliberately or flag the drift.

## Red flags

- A hex not present in `docs/design-system.md`, or any value on the banned list.
- A radius outside 4, 8, 12 and 16.
- A new `tailwind.config.js`.
- `focus:ring-*`, `focus-within:ring-*`, or a focus background fill.
- A focus border colour change on an element that has no resting border, which
  causes layout shift on focus.
- A raw `<button>` with hand-written colour or radius classes.
- A CSS `@import` for a font.
- A landing change made here and assumed to reach `glasspay.app`, or assumed
  to be covered by CI's landing-sync step (it is not).
- A `navigate()` call crossing between the app and marketing domains.

## Verification

Before delivering UI work, confirm that:

- Every colour and radius used is traceable to `docs/design-system.md`.
- No banned hex was introduced, including transitively through a new component.
- Interactive elements use the border-colour focus treatment, and any element
  lacking a resting border gained a transparent one first.
- Buttons route through `ui/Button`, or the exception is stated explicitly.
- The change was checked against the global `:focus-visible` rule for whether
  it is a form control or a button/link.
- Landing changes name how they reach the marketing repo, if at all.
- `npm run format:check` passes — Prettier checks Markdown and JSONC, so
  documentation added alongside UI must be formatted too.
