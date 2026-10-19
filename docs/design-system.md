# Glass Design System

**Source of truth:** Figma file _Glass Design By AQ_ — `figma.com/design/OzgMHnZ528nzYyElv5LZDd`
**Extracted:** 2026-10-07 via Figma REST API (`GET /v1/files/OzgMHnZ528nzYyElv5LZDd`)
**Re-audited:** 2026-10-09 — full-file pass; typography, icons and the component sheet inventoried (§7–§9)
**Applies to:** `glass-waitlist` (app → app.glasspay.app) and `glass-waitlist-v1` (marketing → glasspay.app)

> This document is normative. When code disagrees with this file, the code is wrong — unless
> §0 says otherwise. Do not "clean up" a value to match a Tailwind default; match this spec.

---

## 0. Read this first — three things that will trip you up

1. **The Figma file has no variables or styles layer.** `GET /files/:key/styles` returns
   `styles: []`, and `POST /files/:key/variables/local` returns 403 (needs the
   `file_variables:read` scope). Everything below was extracted from **node fills, strokes,
   radii and text styles**. Treat single-use values as provisional; treat high-frequency
   values (`#002fa7` at 2,812 nodes) as authoritative.

2. **The Figma MCP connection does not work and cannot be made to work.** Figma's OAuth
   server only accepts clients in a fixed catalog (VS Code, Cursor, Claude Code, Codex,
   Windsurf, Xcode, Zed). `POST https://api.figma.com/v1/oauth/mcp/register` returns **403**.
   Don't retry `opencode mcp auth figma` — it fails with _"OAuth app with client id … doesn't
   exist"_. Use a Figma personal access token (File content → Read-only) and the REST API.

3. **The Figma file is internally inconsistent.** Only `Primary Button + States` (id
   `1:11545`) has real, trustworthy variant props. Several other component sets were never
   cleaned up — their variants are literally named `Variant21`, `Variant8`, `Variant12`.
   Where a set contradicts itself, this document follows `Primary Button + States`.

---

## 1. Colour

### 1.1 Core palette

| Role                  | Hex       | Notes                                                                   |
| --------------------- | --------- | ----------------------------------------------------------------------- |
| **Brand**             | `#002fa7` | The only brand blue. 2,812 nodes. Highest-confidence value in the file. |
| **Danger / Critical** | `#db0000` | 276 nodes. Destructive button + outline-caution label.                  |
| **Focus ring**        | `#0f53ff` | Focus stroke colour. Currently **0 occurrences** in either repo.        |
| **Deep navy text**    | `#001f6e` | 248 nodes. Figma's dark heading/text navy.                              |
| **Purple**            | `#6b2fb5` | 242 nodes. The file's only purple.                                      |

### 1.2 Blue tint ramp

`#ccdaff` (425) · `#6a8ff0` (212) · `#bdd0fe` (131) · `#dbe6ff` (29) · `#ccdbff` (19) · `#94b1fb` (60)

Ordered lightest → darkest: `#ccdaff` · `#bdd0fe` · `#dbe6ff` · `#94b1fb` · `#6a8ff0`.

### 1.3 Neutrals & surfaces

| Hex       | Nodes | Use                                       |
| --------- | ----- | ----------------------------------------- |
| `#ffffff` | 3,810 | Page/cards; also tonal button fill at 60% |
| `#f9f9fb` | 300   | Page background                           |
| `#f3f4f6` | 338   | Subtle surface / stacked                  |
| `#f2f2f2` | 20    | Hairline surface                          |
| `#d7d8db` | 54    | Divider                                   |
| `#e0e0eb` | 8     | Hairline border                           |
| `#ccd1dc` | 5     | Border                                    |

### 1.4 Text ramp

`#000000` · `#000000 @60%` · `#000000 @32%` · `#000000 @20%` · `#808080` · `#848484` ·
`#a1a1aa` · `#797d86` · `#6a6e86` · `#5c5f7d`

### 1.5 Radius scale

**4 · 8 · 12 · 16.** Observed node counts: 4 → 1,792 · 12 → 441 · 8 → 357 · 16 → 56.
Four values. Anything else (`rounded-md` 6, `rounded-2xl` 16, arbitrary `[10px]`/`[20px]`/`[46px]`) is off-system.

> **Pill exception (confirmed 2026-10-09, extended 2026-10-10):** `rounded-full` is legal on
> **toggle tracks** (Figma r=100), **frequency badges** (r=24/999), **status chips**,
> **landing CTAs** (r=60, see §2.2b), and the **mobile back button** (Figma node `1:14109`,
> r=999 — a true 48×48 circle; see §2.2c) — the file uses pills there deliberately. It stays
> banned on product buttons, cards, inputs and modals.

> Note: an earlier version of `design-audit.md` claimed a `6` in the scale. There is no 6.
> One `Dialog` node carries r=24, outside the scale — provisional, see §9.3.

### 1.6 Banned values

These appear in the code and are **not** in Figma. Do not introduce them; retire them.

| Value                                                                       | Where it leaked from                                                                                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `#2547d0`                                                                   | 19 occurrences across both repos. Not a Figma colour. Competes with `#002fa7`.                                                                                                 |
| `#2535c3`                                                                   | 4 occurrences. `ui/Button.jsx:7` has a comment naming this as the exact bug the component was written to prevent — and it still exists in `auth/SignUp/EmailPhoneStep.jsx:93`. |
| `#dc2626`                                                                   | Tailwind `red-600`. Figma danger is `#db0000`.                                                                                                                                 |
| `#e11d48`                                                                   | Tailwind `rose-500`.                                                                                                                                                           |
| `#0f1d6e`, `#1c2b8a`, `#0b0f2e`, `#0d1a6e`, `#0c1020`, `#0d1022`, `#0f1640` | Six near-identical "brand navy" hexes. Figma has one: `#001f6e`.                                                                                                               |
| `#4f46e5`, `#7c3aed`                                                        | Tailwind indigo/violet. Figma purple is `#6b2fb5`.                                                                                                                             |
| `#17a1e5`                                                                   | `--color-primary` in v1. Dead token, wrong blue.                                                                                                                               |
| `#16a34a`, `#059669`                                                        | Success greens. Not in Figma.                                                                                                                                                  |
| `#B0B8D8`, `#E0E0E0`, `#C5C5C5`, `#D4D4D4`                                  | Invented disabled fills.                                                                                                                                                       |
| `#111111`, `#111827`                                                        | Off-palette text. Figma text dark is `#000000`.                                                                                                                                |

### 1.7 Responsive breakpoints

Tailwind's default scale, no overrides: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.
The app is desktop-first for the admin shell and phone-first for the member app; the
community-admin dashboard follows Figma section `1:13185` ("Admin Responsiveness Design"),
which ships three frames — a phone (365×833), a drawer, and a MacBook — under one set of
rules:

| Part                  | Below `md` (phones)                                                        | `md` and up (desktop)                             |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| Nav rail              | `hidden`; drawer is a full-width panel (no rail behind it)                 | `hidden md:flex` rail + 220px panel               |
| Drawer header         | 32×32 community logo + chevron switcher + ✕ close                          | Community name + Owner/role chip                  |
| Topbar                | `h-12`, burger · Glass mark · 48×48 round bell                             | `h-14`, community switcher + search + help        |
| Page header           | `hidden md:flex` — the shell already carries community context             | h1 + subtitle + quick actions                     |
| Stats grid            | `grid-cols-2`, 108px min-height, `rounded-g-2`, label 12 / value 16 medium | `auto-fit minmax(190px,1fr)`, original 14/20 bold |
| Section cards         | `rounded-g-2` (8px), `p-3`                                                 | `rounded-xl` (12px), original padding             |
| Payment Plans card    | `bg-brand-100`                                                             | `bg-brand-mist`                                   |
| Member Payments table | Member · Plan · Amount · Email · Status; Date and Actions hidden           | All seven columns                                 |
| Your Payments table   | Due Date column hidden (`hidden md:table-cell`)                            | Due Date visible                                  |
| Search inputs         | `text-base` (stops iOS zoom-on-focus)                                      | `text-xs`                                         |
| Unpaid alert          | Stacks below `sm`; icon 16px                                               | Row layout; icon 26px                             |
| Filter chips + pager  | Visible at every width (client-side list)                                  | Same                                              |

**Why radius differs by breakpoint:** Figma draws the phone frame's cards at r=8 and the
MacBook frame's at r=12 — both on the §1.5 scale. Use `rounded-g-2 md:rounded-xl` rather
than picking one; do not invent an intermediate. The caution banner's node carries r=2,
which is off-system; the phone layout uses the nearest on-system value, `rounded-g-1` (4).

**Type is never scaled below the floors in §7.1.** The phone frames shrink labels to 12
and values to 16 medium because Figma does, not as a general rule — product chrome on
desktop keeps its 14/20 scale. Recent Activity body copy is `text-sm` (14) at every
breakpoint; the mobile frame's 18/400 was rejected as too heavy for a dense list.

**Never hide a feature solely because Figma's phone frame omits it.** Groups and
Notifications stay in the mobile drawer (Figma draws four nav rows; the app has six).
Pagination and the Filter dropdown render at all widths because the table is client-side
paginated either way — the chips are the phone's affordance, not a replacement for the
desktop Filter button.

---

## 2. Buttons

Six roles. All **Inter**, label weight **500**, border radius **4px at rest**.

### 2.1 Role matrix

| Role         | Fill           | Label                                      | Stroke              | Radius              |
| ------------ | -------------- | ------------------------------------------ | ------------------- | ------------------- |
| **Primary**  | `#002fa7`      | `#ffffff`                                  | —                   | **4px, all states** |
| **Outline**  | **none**       | `#002fa7` · `#000000` · `#db0000`          | `#000000 @10%`, 1px | 4px                 |
| **Tertiary** | none           | **`#000000 @60%`** · `#002fa7` · `#db0000` | none                | 4px, height 24      |
| **Critical** | `#db0000`      | `#ffffff`                                  | —                   | 4px                 |
| **Tonal**    | `#ffffff @60%` | `#002fa7`                                  | `#000000 @10%`, 1px | 4px                 |

> ### ⚠️ Extension: Success and Warning are NOT in Figma
>
> The Figma file defines **no** success or warning button role. These two were added on the
> design owner's instruction, and are marked here as an **extension rather than spec** — if the
> file later grows a real status role, prefer that.
>
> To avoid inventing a palette, both use fills the file **already reaches for elsewhere**:
> `#008000` (its dominant green, 435 nodes) and `#9a6500` (its dominant amber, 91 nodes).
> Washes are `#ccffcc` (183) and `#ffffdb` (56); the danger wash is `#ffcccc` (27). These
> replaced Tailwind's green-600 / amber-700 / emerald-50 / amber-50 / red-50, none of which
> appear anywhere in the file.
>
> `_SUCCESS_` · `_WARNING_` — fill as above, label `#ffffff`, 4px, full state set.
> **Blast radius:** `--color-success` had 192 references and `--color-warning` 74, so adopting
> these values is a visible change across status chips, banners and buttons. Review it.
> | _(focus)_ | — | — | `#0f53ff` | — |

> ### Radius decision: 4px, everywhere
>
> Figma's `Primary Button + States` is internally inconsistent — several _Hover_/_Pressed_
> variants are 8px while their _Default_ is 4px, and the X-large row mixes both. **Per the
> design owner: when the spec is ambiguous, take the smaller value. 4 < 8, so 4px wins.**
>
> This means **4px at every state, on every role** — including hover, pressed, disabled and
> focus. Do not ship an 8px hover radius. `rounded-lg` (8px) is wrong everywhere; use
> `rounded-g-1` (4px).
>
> The four values are available as `--radius-g-1` (4px) · `--radius-g-2` (8px) ·
> `--radius-g-3` (12px) · `--radius-g-4` (16px), added to `src/index.css` `@theme`. The `g-`
> prefix is deliberate: reusing Tailwind's built-in `--radius-sm/md/lg` names would remap
> every existing card and input to larger radii, which is the opposite of this decision.

> **The outline family is one component in three colours.** `Secondary/Outline` (1:11673),
> `Outline Secondary Button` (1:11983) and `Outline Caution Button` (1:11800) are
> _geometrically identical_ — same no-fill, same `#000000 @10%` 1px stroke, same radii and
> heights. They differ **only** in label colour: blue / black / red. They are not broken
> duplicates.

> **Tertiary renders the "Subtle" variant.** `Tertiary Button` (1:11927) is a component set of
> two label colours: brand blue `#002fa7` and a **Subtle** variant at `#000000 @60%`. The blue
> default exists in the library but is **never placed on a page** — every tertiary the file
> actually uses ("Back", "See All", breadcrumbs) is Subtle. `ui/Button` therefore renders
> tertiary as muted ink, not brand blue. Rendering it blue leaked blue into every back link,
> See-All link and breadcrumb in the app, which is what the "why is this blue" reports were
> all about. Use `outline` when a blue text link is actually wanted.
>
> The brand-blue rail is the one place tertiary sits on a coloured surface; its icon buttons
> pin `className="text-white"` rather than inheriting the role.

### 2.2 Sizes

| Size    | Padding T/R/B/L | Height | Label |
| ------- | --------------- | ------ | ----- |
| X-small | 8/12/8/12       | 32     | 12px  |
| Small   | 8/16/8/16       | 40     | 14px  |
| Medium  | 12/24/12/24     | 48     | 14px  |
| Large   | 16/32/16/32     | 56     | 16px  |
| X-large | 20/40/20/40     | 64     | 16px  |

Heights are the quick check: **32 · 40 · 48 · 56 · 64.** Tertiary is 24.
Critical's X-large uses `20/24/20/24` (h=64) — narrower horizontally than Primary's
`20/40/20/40`.

Figma pairs each box with one label size. **§2.2d** defines the deliberate
exception where the label drops to 12px.

### 2.2a Icon-only sizes (extension)

> ### ⚠️ Extension: Figma defines no icon-button role
>
> Every role in §2.1 assumes a text label, so the app's icon-only buttons — hamburger, bell,
> close, chevron, overflow, trash — had nothing to route through. Added on the design owner's
> instruction as **three sizes**, not a new role: they reuse the existing role fills and states
> and differ only in geometry.
>
> | Size      | Box   | Padding | Label |
> | --------- | ----- | ------- | ----- |
> | `icon-sm` | 32×32 | none    | none  |
> | `icon-md` | 40×40 | none    | none  |
> | `icon-lg` | 48×48 | none    | none  |
>
> 24/32/40 squares were all present in the file; 48 is carried over from the button scale
> because 40 is below the 44px touch-target guidance on phones. **No horizontal padding** —
> there is no label to clear — and no text size, since the child is an icon.
>
> `ui/Button` does **not** add an `aria-label` for you. An icon-only button with no accessible
> name is unusable by screen reader and voice control, so pass one explicitly:
>
> ```jsx
> <Button size="icon-md" aria-label="Notifications">
>   <Bell />
> </Button>
> ```

### 2.2b Landing CTA (extension — the white pill)

> ### ⚠️ Extension: the marketing CTAs are a role of their own
>
> The six roles in §2.1 are **product** buttons. The Figma landing frames (MacBook Air 3–8,
> Home Page section) draw their CTAs differently, confirmed node-by-node 2026-10-10:
>
> | Property | Value                      | Evidence                                      |
> | -------- | -------------------------- | --------------------------------------------- |
> | Fill     | `#fafbfc` (near-white)     | every "Get Started" / "Create Your Community" |
> | Radius   | 60 → pill (`rounded-full`) | r=60 on all instances                         |
> | Height   | 50 — **42 in the navbar**  | 50 on all instances; navbar is the exception  |
> | Label    | Inter 500, 15px, `#000000` | text nodes                                    |
>
> These are **not** an inversion of Primary and must not be styled via `variant="primary"`.
> They are their own treatment: near-white pill on the brand-navy sections (and on light
> sections too — the fill is the same). Hover/pressed states are not measurable via REST;
> the shared component ships a conservative lift (`-translate-y-0.5` + shadow) until the
> owner rules.
>
> **Scope — exactly these sites** (v1 marketing + the app repo's marketing twins):
> nav "Get Started Free" (desktop + mobile), CTA-section "Create Your Community" /
> "Join Your Community", hero "Create Your Community" / "Join A Community", footer
> "Get Started Free". Implementation is the shared `ui/LandingCta` component — do not
> hand-roll the styles at a call site. **Product surfaces (dashboard, auth, member app)
> never use it.** The **members-view** navbar "Sign In" also uses it (owner decision,
> 2026-10-12): it was a blue `Button` (`bg-brand` + `rounded-g-1`), which read as a second
> brand-blue CTA sitting directly beside the white pill. The **organizations-view** navbar
> "Sign In" is deliberately unchanged and stays on the outline/text treatment.
>
> **Navbar height — the `compact` prop** (owner decision, 2026-10-12). At h=50 the
> nav "Get Started Free" and the members "Sign In" read as oversized next to the
> organizations nav's Sign In pill, which measures **42px** (`px-5 py-2.5` + a
> 13.5px label). Both navbar instances therefore pass `compact`, which swaps
> `h-[50px]` for `h-[42px]`. It is a **prop, not a `className` override** — Tailwind
> does not guarantee cascade order between two arbitrary utilities such as
> `h-[50px]` and `h-[42px]`, so the component emits exactly one height class.
> Non-navbar instances (hero, CTA band, footer) keep h=50.

### 2.2c Mobile Back Button (Figma component `1:14109`)

Not an extension — this one **is** a Figma component, and the member app had been faking it
with a 40×40 `rounded-g-1` `tertiary` icon button. Geometry straight from the file:

| Property | Value                                                      |
| -------- | ---------------------------------------------------------- |
| Box      | 48×48                                                      |
| Radius   | 999 (true circle) — the §1.5 pill exception                |
| Fill     | `#ffffff @ 0.6` → `bg-surface-container`                   |
| Stroke   | `#000000 @ 0.1`, 1px → `border border-black/10`            |
| Glyph    | `Icon/Back` (node `82:14693`), 24×24, stroke-width **1.5** |

The glyph is a single chevron at stroke-width 1.5 (not lucide's default 2) and is coloured by
the parent, so it inherits the button's text colour. Implemented as
`ui/MobileBackButton` — use it for **every member-app back affordance** (all 22 screens).
It is a _mobile_ component; the dashboard's breadcrumb back links are text buttons and do
not use it.

```jsx
<MobileBackButton aria-label="Back" onClick={() => navigate(-1)} />
```

`aria-label` defaults to `"Back"`; override it when the destination is not simply "back"
(e.g. `"Go back"` on Invites, which returns to Home).

### 2.2d Tight label decoupling (owner-directed)

One size keeps a **Figma box** but drops the **label to 12px**:

| Size         | Padding T/R/B/L | Height | Label   | Used for                                                              |
| ------------ | --------------- | ------ | ------- | --------------------------------------------------------------------- |
| `sm-tight`   | 8/16/8/16       | 40     | 12px    | Dashboard / page-header CTAs, page-level empty-state CTAs, Groups CTA |
| `sm-tighter` | 8/16/8/16       | 40     | **8px** | The two settings save rows only — see below                           |

Padding and height are byte-for-byte `Small` in both — only the label differs.
Figma pairs h40 with a 14px label; this breaks that pairing on purpose: at
14px and above the label read too large in dashboard headers and crowded the
button edge, so it was dropped to 12px while keeping the box (chosen
2026-10-12, dashboard button-sizing sweep).

`sm-tighter` (2026-10-13) drops the label again to **8px, which is below the
12px floor** §2.2 sets for every other button label in the scale. It is a
deliberate owner-ruled exception scoped to exactly two call sites —
Account › Profile and Community › Profile — and is **not** a new rung on the
ladder. Nothing else should adopt it without the same conversation.

Both entries are **decouplings, not new Figma sizes** — no Figma node draws
either. Do not add a third without the same conversation, and never invent
one to fix a single call site when `className` would do.

### 2.3 States

| State    | Primary                                             |
| -------- | --------------------------------------------------- |
| Default  | fill `#002fa7`, radius 4px                          |
| Hover    | fill `#002fa7` + `#000000 @6%` overlay, radius 4px  |
| Pressed  | fill `#002fa7` + `#000000 @12%` overlay, radius 4px |
| Focused  | stroke `#0f53ff`, radius 4px                        |
| Disabled | fill **stays `#002fa7`**, radius 4px                |

Black-over-brand overlays resolve to: hover `#002f9b`, pressed `#002b8f`.

Outline/tertiary/tonal all need the same five states. The pressed treatment is a **colour
overlay on the fill**, not a scale transform.

> The hover/pressed overlays are _stacked black fills_, not `opacity` on the element.
> `hover:opacity-90` is **not** the same thing and is not equivalent.

---

## 3. Current compliance

**Sweep complete (C1–C8, 2026-10-08 → 2026-10-10).** Re-measured 2026-10-10, both repos.
Batch history: batch 1 shared components (ModalShell/ConfirmDialog/ConfirmSheet), then
C2 toast/chips, C3 destructive, C4 icon-onlys, C5 memberApp, C6 dashboard, C7 auth +
onboarding (app PRs #146–#151), C8 v1 leftovers (v1 PR #26). Evidence trail: `design-audit.md`.

Every role-mappable button is now on `ui/Button`. What remains as raw `<button>` is the
**deliberate leave-list**: composite rows/list-items, dropdown-option menus, tab groups,
segmented controls, radio cards, promo/empty-state cards, KycStatusBadge wrappers, the
dark-navy Sidebar rail, numeric pagination, muted See-All links, destructive text links
(no danger-tertiary role exists), decorative `dashboard-overlay/` mocks (`aria-hidden`,
`tabIndex={-1}`), accordion triggers, and the component definitions themselves.

### 3.1 App — `glass-waitlist` (2026-10-10)

| Metric                          | 10-07 baseline | 2026-10-10                           |
| ------------------------------- | -------------- | ------------------------------------ |
| Raw `<button>` (excl. tests)    | 450            | **122** (leave-list)                 |
| `<Button>` call sites           | 76             | **406**                              |
| `<LandingCta>` call sites       | —              | **8**                                |
| `!important` escapes on buttons | 11             | **0**                                |
| Hex literals                    | 484 / 229      | **415 / 219**                        |
| `#db0000`                       | 0              | **0**                                |
| `#0f53ff`                       | 0              | 1 (token definition, `index.css:45`) |
| `bg-danger`/`text-danger` sites | —              | **101**                              |

Radius breakdown of the 122 remaining raw buttons (±4-line window):
`rounded-full` 23 · `rounded-xl` 23 · `rounded-lg` 21 · `rounded-2xl` 12 ·
`rounded-md` 8 · `rounded-[10px]` 7 · `rounded-sm` 2. These are the leave-list
composites and mocks — not un-migrated CTAs. `focus-visible` present in 6
windows; `active:` 0 (owed by raws that stay raw); `font-semibold` 49 /
`font-bold` 9 / no-weight 30 across remaining raw windows.

Fixed since baseline and no longer offenders: global focus ring is
`--color-focus: #0f53ff` (token, not brand), `SideDrawer` red ring →
`outline-focus`, all danger reds → `bg-danger`, `#2535c3` → comment-only
(`SignUpTextInput.jsx:8`), `bg-red-600`/`bg-[#7f1d1d]` gone, JoinApprovedModal
green → `success` extension role, `!important` count 11 → 0.

Counting method: classes within a ±4-line window around each `<button` tag.
JSX attributes are multi-line, so a per-line scan misses most of them — the
same trap that produced the wrong numbers in the original audit.

### 3.2 Marketing — `glass-waitlist-v1` (2026-10-10)

| Metric                       | 10-07 baseline | 2026-10-10                                                          |
| ---------------------------- | -------------- | ------------------------------------------------------------------- |
| Raw `<button>` (excl. tests) | 30             | **20** (leave-list)                                                 |
| `<Button>` call sites        | 0              | **5**                                                               |
| `<LandingCta>` call sites    | 0              | **8**                                                               |
| `tailwing.config.js` (dead)  | present        | **deleted**                                                         |
| Hex literals                 | 676 / 225      | **559 / 143**                                                       |
| `#2547d0`                    | 19             | **0**                                                               |
| `#db0000`                    | 0              | 9 (all in exempt `dashboard-overlay/` mocks + the Button spec test) |

Remaining 20 raw buttons: Navbar nav links/hamburger (dark-navy context),
mobile menu rows, mobile Sign In outline pill (per §6.11 ruling), Security /
WhyGlass accordion triggers, UseCases card-teaser, dashboard-overlay
decorative mocks, LandingCta/Button definitions. C8 (PR #26) converted the
ErrorBoundary refresh pill and ProblemSection ↻ Replay; the UseCases white-fill
outline and Security JS-invert outline from §4.3 were fixed in the landing
batch (PR #25).

---

## 4. Offenders

Status 2026-10-10, after the C1–C8 sweep. Most of the original §4 inventory is
**resolved**; the tables below keep the historical rows so the trail survives,
struck through where fixed. What remains open is listed at the end.

### 4.1 Critical — wrong colour — **RESOLVED**

- ~~Primary CTAs inverted to `bg-white` + off-palette navy label (9 v1 sites)~~ → `ui/LandingCta` (§2.2b, user decision 2026-10-10).
- ~~Danger rendered with 5 different reds, none `#db0000`~~ → `bg-danger` token; 101 app sites; `#db0000` count 0 outside tests.
- ~~`#2547d0` as brand blue (19 sites)~~ → 0 in both repos.
- ~~`#2535c3` (`EmailPhoneStep`)~~ → removed; only a comment remains (`SignUpTextInput.jsx:8`).
- ~~Scroll-progress gradient across banned colours (v1 `Navbar.jsx:101`)~~ → removed.
- ~~Red focus ring (`SideDrawer`)~~ → `focus-visible:outline-focus`.
- ~~Global focus ring `#002fa7`~~ → `--color-focus: #0f53ff` token.
- ~~Off-palette green button (`JoinApprovedModal`)~~ → `success` extension role (§2.1).

### 4.2 Critical — wrong radius — **mostly resolved**

`rounded-full` on filled CTAs is down from 61 + 26 to **23 app + 9 v1**, and the
remainder are leave-list items (badges, dark-nav pills, decorative mocks, the
LandingCta shell which legitimately carries the Figma r=60 pill per §2.2b).
`rounded-xl` destructives: all migrated (23 remaining `rounded-xl` windows are
composite rows/cards, not buttons carrying the fill). Spec radius remains
`rounded-g-1` everywhere else.

### 4.3 Critical — role collapse — **RESOLVED**

The grey-pill Cancel collapse (27 app sites, `ConfirmDialog` the canonical
instance) is gone: every cancel/secondary action is `outline`/`outline-neutral`
via `ui/Button`. Tertiary went from 0 uses to the default for text links across
the sweep. v1's `UseCases` white-fill outline and `Security` JS-invert outline
were fixed in the landing batch (PR #25). Remaining raws that still read as
"role-ish" composites (option menus, tab groups, radio cards) are deliberate
leaves — they are containers styled to look like buttons, not buttons.

### 4.4 Critical — a11y — **open, exempt pending owner**

| Issue                                                                               | Status                                                                                                      |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 5 timeline steps clickable by mouse only — no `role`, no `tabIndex`, no `onKeyDown` | still open — v1 `organizations/ProblemSection.jsx` (`data-role` hooks; keyboard wiring is a feature change) |
| 6 dead focusable buttons in a decorative product mock                               | still `aria-hidden`/`tabIndex={-1}` — v1 `dashboard-overlay/*`; exemption pending §6 owner confirm          |
| 31 legal-prose links with no hover and no focus                                     | still open — v1 `src/index.css` `.legal-prose` (CSS-only fix, not part of the button sweep)                 |

### 4.5 Moderate — sizes and states — **mostly resolved**

- Figma sizes 32/40/48/56/64 now exist in code as `ui/Button` `xs/sm/md/lg/xl`; all 406 call sites carry them. The 10-07 "0 of 56 match" row is void.
- Pressed/focus/disabled states: carried by `ui/Button` for every migrated button; raw leave-list buttons still owe their own (noted in §5).
- Weight 600/700: `ui/Button` renders 500; remaining semibold/bold hits (49/9) are leave-list raws.
- `!important` escapes: **0** (was 11).
- v1 `tailwing.config.js`: **deleted**.

---

## 5. Doing it right

Prefer the shared component over hand-rolled classes:

```jsx
import { Button } from "~/components/ui/Button";

<Button variant="primary" size="md">Pay now</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="critical" size="md" disabled>Delete</Button>
```

Hand-rolled equivalent — the shape to match when a `<button>` genuinely can't go through the
component:

```jsx
<button
  className="h-12 rounded-g-1 bg-brand px-6 text-sm font-medium text-white
             hover:bg-[#002f9b] active:bg-[#002b8f]
             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f53ff]
             disabled:bg-brand disabled:opacity-60"
>
```

- Radius: `rounded-g-1` (4px). **Always.** Never `rounded-lg`, `rounded-xl`, `rounded-full`.
- Height: `h-8` / `h-10` / `h-12` / `h-14` / `h-16` for 32/40/48/56/64.
- Colour: `bg-brand` / `text-white` / `bg-danger`. Never a raw hex.
- Weight: `font-medium` (500). Never `font-semibold` or `font-bold`.
- Label: 12/14/16px only.
- Every button needs hover, pressed, focus and disabled.
- Focus ring is `#0f53ff`, on the element, with an offset.
- `fullWidth` defaults to **true**. Only pass `fullWidth={false}` when the button is sized
  by its parent — e.g. a `flex-1` sibling in a shared row. Getting this backwards silently
  narrows a stacked action. `ConfirmDialog` and `ConfirmSheet` are the reference pair for
  the two cases: side-by-side in a `flex gap-3` row (`fullWidth={false}` + `flex-1`), and
  stacked in a `flex-col` (default).
- A migrated button's **disabled** state cannot be asserted by looking for a `disabled:`
  class — `ui/Button` swaps the whole variant class at render time. Test it functionally
  (`.disabled === true`). See the note in §3.1.

**Do not** add `active:scale-*` as the pressed state. Do not use `opacity` to fake a hover
overlay. Do not add a new hex without checking §1.5 and §1.6 first.

### Icon-only buttons

A raw `<button>` with an `aria-label` and no text child is acceptable when Figma defines no
matching role (§6.7) — but it still owes everything else in §2: `rounded-g-1`, hover, an
`active:` state, and the `#0f53ff` focus ring. `ModalShell`'s close button is the reference
example: one shared `CLOSE_BTN` class string so both of its variants cannot drift, and both
are given an `aria-label` so neither is an unnamed button.

---

## 6. Open questions for the design owner

Refreshed 2026-10-10 after the button sweep. Struck-through items are resolved
and need nothing from the owner; the shortlist at the bottom is what still does.

1. ~~**Radius 4 vs 8.**~~ **Resolved:** take the smaller value → **4px everywhere**, no 8px
   hover radius. Recorded in §2.1.
2. **`#0f53ff` focus colour.** Applied as the global focus ring per §2.1 (token
   `--color-focus`). **Still needs confirmation** that it is the intended focus
   colour, not a one-off.
3. ~~**No success/warning role.**~~ **Resolved as an extension:** `success` and `warning` roles
   added in §2.1 using the file's own dominant green `#008000` and amber `#9a6500`, replacing
   the off-palette `#16a34a`/`#b45309`. Flagged as an extension, not spec.
4. **Success/status palette.** Figma has `#008000`, `#1d6b40`, `#9a6500`, `#ffffdb` in use but
   no coherent scale. **Open:** is there a status ramp somewhere else?
5. **Decorative `dashboard-overlay/` mocks** (inline styles, radius 7, `aria-hidden`).
   **Open:** confirm they never need to conform. Until then they are exempt and
   explain most remaining v1 hex literals.
6. **Six near-identical navies.** `#0f1d6e`, `#1c2b8a`, `#0b0f2e`, `#0d1a6e`, `#0c1020`,
   `#0d1022`, `#0f1640` all collapse to `#001f6e`. **Open:** confirm, since
   `--color-brand-deep` and `--color-brand-night` currently carry extra meaning in dark
   sections.
7. ~~**No icon-button role exists.**~~ **Resolved as an extension:** three icon-only sizes
   (`icon-sm` 32, `icon-md` 40, `icon-lg` 48) added in §2.2a and used across C4–C7.
8. **Icon glyph scale is provisional (§8.4).** Figma's icon components don't serialize width/
   height via the REST API, so the 16/20/24/32/40 glyph scale is derived from the icon-button
   boxes, not measured. **Open:** confirm — especially the normalisation of the app's `w-9`
   (36px, 60 sites) and `w-7` (28px, 35 sites).
9. **Dialog radius.** The Figma `Dialog` node carries r=24 — outside the 4/8/12/16 scale and on
   a single node. Code uses 16 (`rounded-2xl`) + 20px sheets. **Open:** keeping the code
   values until the owner rules; if 24 is real, §1.5 grows a fifth step.
10. **Marketing display type has no spec.** The Figma file contains app screens only; its
    largest text is 24px. Marketing heroes run `clamp(26px…62px)` and `font-extrabold` (800,
    which §7 bans as above the file's max weight of 700). **Open:** sizes stay unruled until
    the owner exports marketing frames; weights should come down to ≤700 now.
11. ~~**CTA on navy sections.**~~ **Re-resolved (user decision, 2026-10-10): white pill.**
    The Figma landing frames draw every landing CTA as a `#fafbfc` near-white pill
    (r=60, h=50) — see §2.2b. `ui/LandingCta` implements that at the nine marketing
    call sites; the blue-on-navy shortcut is retired.

### Still needs owner sign-off (shortlist)

1. **Focus colour `#0f53ff`** — confirm (item 2).
2. **Six-navy collapse to `#001f6e`** — confirm, incl. what `brand-deep`/`brand-night`
   should mean (item 6).
3. **Dialog r=24 vs code's 16/20** — rule (item 9).
4. **Marketing display sizes/weights** — export marketing frames or accept the
   ≤700 interim (item 10).
5. **Success/status ramp** — point at the real scale or adopt the extension (item 4).
6. **dashboard-overlay mocks** — confirm permanent exemption (item 5).
7. **Icon glyph scale** — confirm derived 16/20/24/32/40 (item 8).

No further code work is planned on these until the owner rules; the page audit
(every app page except the landing vs this spec) proceeds independently.

---

## 7. Typography

Full-file pass 2026-10-09 — 587 text nodes.

**The file is single-font: Inter.** Every product text node is Inter. The only exception is
one stray `Urbanist` label on the "Color Tonals" annotation — design-sheet chrome, not
product UI.

### 7.1 Scale (product UI)

| Size | Weight | Line-height | Where                               | Freq |
| ---- | ------ | ----------- | ----------------------------------- | ---- |
| 12   | 500    | 14.5–24     | small buttons, chips                | 59   |
| 14   | 400    | 20          | table cells, meta text              | 31   |
| 14   | 500    | 20 / 24     | buttons (small/medium), labels      | 33   |
| 16   | 400    | 24          | body, table cell text               | 77   |
| 16   | 500    | 24          | buttons (large), inputs, prefixes   | 190  |
| 18   | 500    | 21.8–24     | card titles, settings rows          | 16   |
| 22   | 500    | 28          | table titles, dialog titles, values | 11   |
| 24   | 500    | 29          | rare                                | 2    |

§7.1 measures the **Figma file**, not the app — Freq counts Figma nodes. Where the two
disagree the code verdict wins. The one that matters: settings rows, which Figma draws at
18/500 + 16/400 and the app ships at **14/500 + 12/400** (owner-directed, §9.8). Do not
"correct" the app back to the table above.

Weights present: **400, 500, 600** (2 nodes), **700** (names/emails in mock data + one C2
chip). **500 is the default.** 400 for body/table text. 600/700 appear only in mock data and
annotations — do not promote them to product headings without the owner saying so.

Letter-spacing: body is 0; the 12/14px button labels carry ~1% (Figma stores 0.012–0.014 px
at those sizes). `ui/Button` applies none today — provisional, do not invent tracking
elsewhere.

### 7.2 Code verdicts

| Item                                                           | Verdict                                                                                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inter via `--font-sans`                                        | **Fine.** Both repos, loaded via `@fontsource` in `main.jsx` (never CSS `@import`).                                                                                          |
| `--font-dm` (DM Sans) + `.font-dm`                             | **Change: delete.** Zero Figma use. Declared in both `index.css`; used by nothing.                                                                                           |
| `--font-playfair` + `.font-playfair`                           | **Change: delete.** Same.                                                                                                                                                    |
| `--font-urbanist` + `.font-urbanist`                           | **Change (1 site).** `WhyGlass.jsx:81` in both repos wraps a landing section in `font-urbanist`. Figma has no Urbanist product text. Switch to Inter — visible but small.    |
| Marketing display sizes `clamp(26px…62px)`                     | **Not banned — out of file.** See open question §6.10.                                                                                                                       |
| `font-extrabold` (800), 3 v1 + 4 app sites                     | **Change: use 700.** 800 exceeds the file's max weight — and neither repo even loads Inter 800.                                                                              |
| Buttons 12/14/16px @ weight 500                                | **Fine** — §2.2 already enforces this.                                                                                                                                       |
| JetBrains Mono accent chips (`MembersProblem.jsx`, both repos) | **Accepted deviation.** The file has no mono text; these uppercase-tracked label chips are a deliberate landing-page accent. Do not extend mono elsewhere without the owner. |

---

## 8. Icons

### 8.1 Library: lucide-react — keep it

The code's icon library is **`lucide-react`** (122 files in the app, 7 in v1). Keep it. The
Figma Icons section (`1:4232`, ~58 components) is a grab bag of iconify sets —
`material-symbols-light`, `lets-icons`, `iconamoon`, `vuesax`, `fluent`, `tdesign`, `weui` —
plus hand-drawn vectors. Rebuilding on those sets would mean adding seven icon dependencies
and restyling every surface. The spec is the **shape**, not the source: match the mapping
below.

### 8.2 Mapping — Figma name → lucide

| Figma                                   | lucide          | Notes                      |
| --------------------------------------- | --------------- | -------------------------- |
| `Icon/Add`                              | `Plus`          |                            |
| `Icon/Remove`                           | `Minus`         |                            |
| `Icon/Dropdown`, `formField/Dropdown`   | `ChevronDown`   |                            |
| `Icon/Back`, `Mobile Back Button`       | `ChevronLeft`   |                            |
| `Icon/Arrow`                            | `ArrowRight`    |                            |
| `Icon/Cancel`                           | `X`             |                            |
| `Icon/Menu`                             | `Menu`          |                            |
| `Icon/Copy`                             | `Copy`          |                            |
| `Icon/Download`, `Icon/Download2`       | `Download`      |                            |
| `Icon/Email`                            | `Mail`          |                            |
| `Icon/Call`                             | `Phone`         |                            |
| `Icon/Notification`                     | `Bell`          |                            |
| `Icon/Filter`                           | `Filter`        |                            |
| `Icon/SendReminder`                     | `Send`          |                            |
| `InputField/Search`                     | `Search`        |                            |
| `formField/Calender`                    | `Calendar`      |                            |
| `formField/showPassword`                | `Eye`           |                            |
| `formField/hidePassword`                | `EyeOff`        |                            |
| `formField/Verified`, `SmallVerified`   | `BadgeCheck`    |                            |
| `dropdownMenuIcon/Delete`               | `Trash2`        |                            |
| `dropdownMenuIcon/Edit`                 | `Pencil`        |                            |
| `dropdownMenuIcon/Pause`                | `Pause`         |                            |
| `dropdownMenuIcon/time`                 | `Clock`         |                            |
| `dropdownMenuIcon/memberList`           | `Users`         |                            |
| `navMenuIcons/Category`                 | `LayoutGrid`    |                            |
| `navMenuIcons/Members`, `Users`         | `Users`         |                            |
| `navMenuIcons/User`                     | `User`          |                            |
| `navMenuIcons/Payments`                 | `CreditCard`    |                            |
| `navMenuIcons/Autopay`                  | `RefreshCw`     |                            |
| `navMenuIcons/PayoutAccount`            | `Wallet`        |                            |
| `navMenuIcons/Role`                     | `UserCog`       |                            |
| `navMenuIcons/Security`                 | `Shield`        |                            |
| `navMenuIcons/Community`                | `Building2`     | confirm per surface        |
| `navMenuIcons/Settings`                 | `Settings`      |                            |
| `PopUpIcon/Caution`                     | `AlertTriangle` |                            |
| `PopUpIcon/Info`, material-symbols info | `Info`          |                            |
| `StatusIcon/Checkmark`                  | `CheckCircle2`  | see §8.3 for illustrations |

### 8.3 Status & selection icons are illustrations, not glyphs

`StatusIcon/*` (Checkmark, AddUser, Plans, Amount, failedPayments, Time, InactiveUser,
Users), `SelectionCard/*` (Recurring, Persons, Memberadd, NonPaying, PayingMember, Flash),
`FeedbackIcon/Success` and `PopUpIcon/*` are **multicolour filled illustrations**, not line
glyphs. `common/SuccessBadge.jsx` is already the reference implementation of
`FeedbackIcon/Success` — it was measured off the design asset (seal bbox, check polyline,
accent positions); keep it in sync if that asset ever changes. For the rest, use a coloured
lucide glyph inside a status-wash circle (`bg-<wash>` + `text-<status>`, palette §2.1
extension note and §9.1) until the owner exports real assets. **Do not hand-trace vectors.**

### 8.4 Sizes

Glyph boxes do not serialize in the REST payload (width/height null on all 58 icon
components), so this scale is **provisional** (open question §6.8), derived from the
icon-button boxes (§2.2a) and the button label scale:

| Step      | Glyph | Tailwind |
| --------- | ----- | -------- |
| `icon-xs` | 16    | `w-4`    |
| `icon-sm` | 20    | `w-5`    |
| `icon-md` | 24    | `w-6`    |
| `icon-lg` | 32    | `w-8`    |
| `icon-xl` | 40    | `w-10`   |

Glyph inside a §2.2a icon-only button: box − 16px padding budget → 16 / 24 / 32 for
`icon-sm`/`icon-md`/`icon-lg` buttons.

Observed in the app: `w-9` (36px) ×60 and `w-7` (28px) ×35 — both off-scale. **Reclassified
2026-10-09:** these are icon-button _boxes_, avatar chips and logo assets (`w-9 h-9` /
`w-7 h-7` containers), not bare glyph sites — zero bare-glyph hits. They are queued with the
icon-button migration (§2.2a boxes are 32/40/48) rather than this scale; do not bulk-rewrite
them. `w-4`/`w-5`/`w-6`/`w-8`/`w-10` remain fine. Icons on touch targets keep the 44px
minimum (§2.2a rationale).

---

## 9. Components

Full inventory of the Components section (`1:12168`), 2026-10-09. Verdicts: **fine** (exists,
conforms) · **change** (exists but diverges — action named) · **missing** (no shared
counterpart; values below are the spec when it gets built) · **n/a** (asset or exempt).

### 9.1 Badges — the palette is the spec

| Badge                         | Fill                | Label     | Radius | Code verdict                                     |
| ----------------------------- | ------------------- | --------- | ------ | ------------------------------------------------ |
| Status = Paid                 | `#ccffcc`           | `#008000` | 4      | **missing** — ad-hoc spans, no shared chip       |
| Status = Unpaid               | `#ffcccc`           | `#db0000` | 4      | **missing**                                      |
| Status = Pending              | `#ffffdb`           | `#9a6500` | 4      | **missing**                                      |
| Role = Member                 | `#ffffdb`           | `#9a6500` | 4      | **missing** — yes, Member is amber, like Pending |
| Role = Admin                  | `#e4d7f4`           | `#6b2fb5` | 4      | **missing**                                      |
| Freq = Weekly                 | `#ccdaff`           | `#002fa7` | pill   | **missing**                                      |
| Freq = Monthly                | `#ffffdb`           | `#9a6500` | pill   | **missing**                                      |
| Freq = One-time               | `#e4d7f4`           | `#6b2fb5` | pill   | **missing**                                      |
| Mobile payment Success/Failed | same as Paid/Unpaid | —         | 4      | **missing**                                      |

Pills are legal here (§1.5 carve-out). Frequency-badge text is 14/500; status chips 16/500.

### 9.2 Inputs & controls

| Component                 | Figma                                                                          | Code                                            | Verdict                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Input fields              | r=4; fill white@60% **or** outline `#000000@20%`; placeholder 16/500 black@60% | `ui/TextInput` — `rounded-lg` (8px)             | **change**: radius → `rounded-g-1` (4px). Keep the border-colour focus rule (AGENTS.md) — do not add a ring. |
| Input + Label             | 5 types × L/S; active stroke `#002fa7`                                         | TextInput + inline labels                       | **fine** — `focus:border-brand` already matches                                                              |
| DIgital input Field (OTP) | digit cells                                                                    | `common/OtpBoxes` + `otpBoxesRenderer`          | **fine**                                                                                                     |
| Toggle + State / + Size   | track pill r=100; on `#002fa7`, off `#000000@10%`; knob white                  | `common/Toggle` — on brand ✓, off `bg-gray-300` | **change**: off track → `bg-black/10`                                                                        |
| Segmented Control         | r=4; active white@60%, inactive transparent; text black@60% / black            | dashboard tabs ad-hoc                           | **missing** — build on first dashboard-tab touch                                                             |
| Checkbox                  | box + checked/unchecked/cancel states                                          | none shared                                     | **missing**                                                                                                  |
| Selection Card            | selected/default                                                               | member-add flows hand-roll                      | **missing**                                                                                                  |
| Checkmark set             | checked / unchecked / cancel                                                   | lucide `Check` / `Minus`                        | **fine** via §8 mapping                                                                                      |

### 9.3 Overlays & menus

| Component              | Figma                                                         | Code                                                                    | Verdict                                                                                           |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Dialog                 | r=**24**, fill white@60% + `#000000@10%` stroke; title 22/500 | `ModalShell`/`GlassModal`: `rounded-2xl` (16), sheet `rounded-t-[20px]` | **keep code for now** — 24 is outside the §1.5 scale and appears on one node (open question §6.9) |
| Input Modal            | form dialog                                                   | `GlassModal`                                                            | **fine**                                                                                          |
| Dropdown Menu + Labels | default / critical rows                                       | dashboard overflow menus ad-hoc                                         | **missing**; critical row = `text-danger`                                                         |
| Mobile Back Button     | chevron-in-circle                                             | member app back (`goBackInApp`)                                         | **fine**                                                                                          |

### 9.4 Feedback & status

| Component              | Figma                                                | Code                           | Verdict                                        |
| ---------------------- | ---------------------------------------------------- | ------------------------------ | ---------------------------------------------- |
| Banner/Feedback        | fill `#ccdaff`, stroke `#002fa7@20%`, r=4            | app banners ad-hoc             | **missing**                                    |
| Banner/Action          | same family, action variant                          | ad-hoc                         | **missing**                                    |
| Notifications row      | unread `#f3f4f6` r=8; read outline `#000000@10%` r=8 | `dashboard/NotificationsPanel` | **change**: align unread/read states per Figma |
| status Icons (L/S)     | coloured illustrations                               | lucide + wash (§8.3)           | **fine** per §8.3                              |
| Helper Texts with Icon | check icon + helper line                             | TextInput error state only     | **change**: add optional helper line           |

### 9.5 Structure

| Component                     | Figma                                                                         | Code                          | Verdict                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| Navigation Menu/Header        | sidebar nav + topbar                                                          | `dashboard/Sidebar`, `Topbar` | **fine** — adopt §8 mapping for `navMenuIcons/*`                        |
| Table Header / Cells          | payment status / period / text cells                                          | dashboard tables ad-hoc       | **missing** — build on first table touch                                |
| Settings Card                 | r=4, white@60% + `#000000@10%`, chevron                                       | settings rows ad-hoc          | **change**: shared card on next settings pass                           |
| Drop-In Box / Upload Link Bar | states: dropping/on-drop/default/dropped; default/disabled/uploading/uploaded | KYC upload flows hand-roll    | **missing**                                                             |
| Community Logos               | asset set                                                                     | `src/assets`                  | **n/a** (assets)                                                        |
| Social Button (Google)        | r=8, white@60% + `#000000@10%`, label 16/500                                  | SignUp Google button          | **change**: verify radius/fill (r=8 is legal — Social is not a §2 role) |

### 9.6 Loading — which indicator for which shape

There are two loading systems, and the split is deliberate. Pick by the shape of what is loading, not by preference.

| Surface                                                         | Use                                         | Why                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Card grid, list of rows, anything that **is** the page          | `Skeleton` (`components/common/SkeletonUI`) | A spinner collapses the page to a centred ring and the content then snaps in; a skeleton holds the layout |
| Small inline region — a table cell, a button body, a search box | `LoadingState`                              | There is no shape to hold, and a skeleton would be larger than the thing it stands in for                 |
| Whole-route transition                                          | `PageLoadingState` / `LoadingScreen`        | Brand mark at page scale; `LoadingState`'s 14px ring is illegible at that size                            |

Rules that are not judgement calls:

- **Skeleton is decorative.** It sets `aria-hidden` on itself; the _container_ must carry `aria-busy`. A screen-reader user gets "this region is loading", not a list of grey bars.
- **Do not hand-roll a placeholder.** `Skeleton` and `SkeletonRow` exist; a local `animate-pulse` div is a duplicate. Pass `tone` for a non-grey surface (e.g. the dark sidebar rail uses `bg-white/10`) rather than reaching for a second `bg-*` class — both utilities have equal specificity, so which wins depends on Tailwind's emit order.
- **SkeletonRow is for settings-list rows** (label + description + trailing toggle), not tables. `SkeletonRow` renders a `<div>`, so it cannot stand in for a `<tr>`. Dashboard tables (`Members`, `MemberDetail`, `SettlementsList`) have **no** skeleton primitive yet and still use a `colSpan` spinner — building a column-shaped one is open work, not something to fake with `SkeletonRow`.

Adopting skeletons in the places listed above brought the `Skeleton` call sites from 9 to 12; the rest of the `LoadingState` call sites are inline regions and are correct as they are.

### 9.7 Exempt

The `dashboard-overlay/` product mocks (inline styles, radius 7) stay **exempt** — decorative
reference renders, not conformance targets (§6.5).

### 9.8 Settings rows (owner-directed)

`dashboard/settings/Settings.jsx` renders the sidebar's menu rows. Figma and the app
disagree here on purpose — the app was scaled down in successive owner passes, and the
result is **not** an oversight to be reverted:

| Part          | Figma    | Code                                           |
| ------------- | -------- | ---------------------------------------------- |
| Row title     | 18 / 500 | `text-sm` + `leading-5` → **14 / 500**         |
| Row detail    | 16 / 400 | `text-xs` + `leading-4 mt-0.5` → **12 / 400**  |
| Row glyph     | 32px     | `size={24}` + `w-6 h-6` → **24px**             |
| Glyph → title | 24px     | `gap-4` → **16px**                             |
| Row padding   | —        | `pl-9 pr-6 py-[23px]` (deliberately untouched) |

Title went 18 → 16 → 14 and detail 16 → 13 → 12; the intermediate 16/13 pass still read
heavy against the card. Scaling stops here — 14/12 is the floor, so don't run another pass.

Row glyphs come from `ui/icons/AdminMenuIcons.jsx`: a **32-unit viewBox**, `strokeWidth`
1.5, `currentColor`. The viewBox is what serialises, so rendering at 24px scales the stroke
with it — no redraw needed. Two glyphs are hand-drawn to the house spec because the Figma
export has no equivalent: `IconNavNotifications` (bell) and `IconNavIdentity` (ID card).

The trailing `ChevronRight size={16}` and the card's padding/gap are independent of the
type scale — leave them out of any future row pass unless the row itself changes.

### 9.9 Landing footer watermark (extension)

The landing footer carries a giant Glass mark behind the CTA and link columns. **Figma does
not draw it** — the footer node `1:1374` ("Frame 1000003394", 1280×883) is flat `#001F6E`
with no watermark at all. It came in from a `Glass _ Landing Footer` HTML mock and was kept
on instruction (2026-10-12) as an owner-approved extension, like §2.2b.

| Property       | Value                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Geometry       | `viewBox="26 18 204 182"`, stepped-line `mask` cut                                                                                             |
| Gradient stops | `#002fa7` → `#001f6e` (**both sanctioned** — §1.1)                                                                                             |
| Placement      | `absolute` on `<footer>`, `h-[104%]`, centred, `z-0`                                                                                           |
| Clipping       | `overflow-hidden` on `<footer>` (the 4% overhang)                                                                                              |
| Strength       | `opacity-[0.55]`                                                                                                                               |
| Visibility     | `hidden md:block` — off below 768px (owner, 2026-10-17); on phones the mark outgrows the footer and its cut line collides with the nav columns |

The mock's own stops were `#06185f` → `#020b3a` — off-palette, the same class of invented
near-black navy as the six in §1.6 — and its background was a three-stop radial
(`#1a46c9` → `#0a2a8f` → `#001a6e`), all off-palette; `#001a6e` was 5/255 off the
sanctioned `#001f6e`, i.e. a typo of it. **Both were corrected rather than ported**: the
background stays flat `#001f6e`, and the footer's old `rgba(30,50,160,0.35)` radial glow
was deleted as the same violation.

Content wrappers carry `relative z-10` so the nav columns and copyright paint above the
mark; the mark is `aria-hidden` and `pointer-events-none`. Content, copy and type scale are
untouched and still match `1:1374`.

> `glass-waitlist-v1`'s `Footer.jsx` still has the off-palette radial glow (line 52) and no
> watermark. Landing components do not auto-sync — re-port or flag the drift.
