# Console design system

[Product documentation](README.md) · [Visual reference](design-system/README.md) ·
[Component architecture](component-architecture.md) · [Page structure](page-structure.md)

Proposed visual direction, 2026-09-22. The design reference is executable and the
tokens are real, but the current product has not been restyled. Review the system
in realistic data and editor layouts before rolling it through the console.

## Direction

Use cool, quiet surfaces with strong text hierarchy: ice-blue canvas, white
working surfaces, navy text, cobalt actions and restrained cyan emphasis. The
interface should feel precise and calm during long SQL/notebook sessions.
Color differentiates actions, selection and meaning rather than decorating every
card. Keep the product dense enough for real work and spacious enough to scan.

Default to a light theme; offer a deliberately designed dark theme. Dark mode
changes semantic tokens, not the component markup. This is a product choice,
not a requirement to invert every light color. Red/amber remain available for
danger/warning even though the brand palette is cool.

## Color roles

[tokens.css](../src/ui/tokens.css) is the canonical source. Consumers use semantic
roles; a feature must not choose an arbitrary blue or gray. The full dark palette
is in that file and visible in the reference.

| Role | Light value | Use |
| --- | --- | --- |
| Canvas | `#F4F7FB` | Application background |
| Surface | `#FFFFFF` | Editors, panels, dialogs and tables |
| Subtle surface | `#EEF3F8` | Rail, toolbars, table header |
| Primary text | `#14243A` | Headings and meaningful values |
| Secondary text | `#50647E` | Supporting context and labels |
| Tertiary text | `#586D86` | Metadata; never lower-contrast text just to look subtle |
| Decorative border | `#D5DFEA` | Nonessential separators and surface boundaries |
| Control border | `#75879F` | Boundaries needed to identify inputs and controls |
| Primary action | `#2455D6` | Main action, selected control and focus ring |
| Primary hover / active | `#1E46B7` / `#193A96` | Pointer and pressed feedback |
| Selection | `#EAF0FF` + `#214CB8` | Selected row, navigation item or option |
| Cyan accent | `#087F9B` | Small technical/context emphasis, not a second primary CTA |
| Accent surface / text | `#E5F6FB` / `#07637A` | Context banner and restrained highlights |
| Success | `#16745C` on `#E8F5EF` | Confirmed successful outcomes |
| Warning | `#8B5700` on `#FFF4DD` | Attention needed; action remains possible |
| Danger | `#B4233B` on `#FFF0F2` | Failure or destructive consequence |
| Information | `#1F55B5` on `#EBF2FF` | Neutral operational information |

Dark mode uses `#0B1220` canvas, `#121E30` working surfaces and `#E8F0FA` text.
Primary actions use `#91B2FF` with dark text `#0A1938`, rather than low-contrast
white text on a pale button. Raised surfaces become lighter than the canvas.

Status always has a word and, where helpful, a distinct icon. A green dot alone
does not communicate Ready. Focus uses a 2px ring with 3px separation; selection
has its own fill/border and is not communicated through the focus ring.

Data visualization starts with cobalt, cyan, violet and teal categorical roles.
Add labels, line styles or markers: the palette is not proof that chart series are
distinguishable for every viewer. Do not reuse success/danger semantics for
unrelated categorical values or rely on color alone.

## Typography

**Choose IBM Plex Sans for the interface and IBM Plex Mono for SQL, code and
identifiers.** Sans has a technical character without making ordinary UI read
like a terminal; Mono distinguishes source from controls. These are our design
judgments. IBM distributes Plex as an open-source family under the OFL; its
[typeface overview](https://www.ibm.com/design/language/typography/typeface/) and
[source repository](https://github.com/IBM/plex) document the family.

Use locally hosted WOFF2 files; no runtime font CDN. This first set includes Sans
400/500/600 and Mono 400. Avoid synthetic weights and italics. Add an actual face
with provenance if a later editor needs italic or bold code. Keep system fallbacks
for glyphs outside the included font coverage and test required locales before
claiming full international typography support.

The reference assumes the browser's default 16px root and uses rem-based sizes.
Do not reset the global root to 14px: 14px is the UI body role, not the rem base.

| Role | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Display | 36 / 44px | 600 | Rare onboarding or documentation title |
| Page title | 28 / 36px | 600 | One title per product page |
| Section title | 18 / 24px | 600 | Panels and working sections |
| Emphasized body | 16 / 24px | 400 or 500 | Introductions and prominent explanations |
| UI body | 14 / 20px | 400 | Controls, forms, navigation and comfortable tables |
| Label / button | 14 / 20px | 500 | Input labels and actions |
| Dense data | 13 / 20px | 400 | Compact tables and code default |
| Metadata | 12 / 16px | 400 or 500 | Timestamps, supporting captions and badges |

Do not use 10px text for operational context. Avoid all-uppercase body labels;
short group labels can use restrained tracking. Use sentence case. Most emphasis
comes from weight and spacing, not capitalization or saturated color.

Use tabular numerals for aligned metrics/results. Use Mono for SQL, object paths,
UUIDs and machine-readable values; ordinary table text stays Sans. Preserve full
identifiers through an accessible detail or copy action. Dates need a timezone
where ambiguity matters; relative time should have an exact equivalent.

## Spacing, density and shape

- Use a 4px base: 4, 8, 12, 16, 20, 24, 32, 40 and 48px. Component gaps usually
  use 8/12px; panel padding 20/24px; page gutters 24/32px.
- Controls: small 32px, default 36px, prominent/touch 44px. Icon controls have
  the same hit area as their peers; the icon itself is 16 or 20px.
- Comfortable table rows: 44px minimum, 14px text. Compact rows: 32px minimum,
  13px text. Keep 20px line height and at least 24px row-control targets.
- Density changes table spacing, not the entire page's font size. Touch/coarse
  pointer contexts should prefer 44px controls and comfortable rows.
- Radius: 4px for small markers, 6px for controls, 8px for panels, 12px for
  dialogs. Rounded pills are reserved for status, not every interactive element.
- Use 1px dividers. Flat panels are the default; shadows explain elevation for
  overlays, not a stack of decorative cards.
- Motion: 100ms for hover and 160ms for small transitions. Respect reduced motion;
  no entrance animation on every table refresh or continuous decorative animation.

## Buttons and links

| Variant | Treatment | Typical use |
| --- | --- | --- |
| Primary | Cobalt fill, contrasting label | Run, Create, Import, Confirm reviewed apply |
| Secondary | Surface with visible control border | Save, Cancel, secondary navigation action |
| Ghost | Text on transparent surface; hover reveals surface | Low-priority toolbar actions |
| Danger | Semantic danger fill with contrasting label | Destructive actions and final confirmation |
| Icon button | Named control, consistent square hit area | Copy, close or a familiar repeated action |
| Link | Underline in body text; clear hover/focus | Navigation to a resource or explanation |

One primary action per task region. Run and Save have different semantics even
when adjacent; saving must not execute. Place Cancel before the confirming action
in dialogs. State the action in the label: "Delete branch", not "Yes".

Required states: default, hover, pressed, focus-visible, disabled and busy.
Busy buttons retain width and show a verb plus progress indication. Disable
duplicate submission while busy, announce progress in a nearby status region,
and keep the operation's authoritative state outside the button. Disabled controls
need a visible explanation when the reason matters; a tooltip on an unfocusable
button is insufficient. Use pointer cursor for enabled actions, not a wait cursor
for every unavailable action.

Use a native button for actions and an anchor for navigation. An icon-only action
must have an accessible name. Icons supplement readable labels on consequential
actions. Keep icon geometry consistent: 16/20px viewbox, roughly 1.75px stroke,
no mixed filled/outline families within a toolbar. An icon package has not been
selected in this pass; wrappers must allow replacement without changing features.

## Forms and selection

Labels sit above controls and remain visible after entry. Helper text precedes
errors conceptually; errors attach to the relevant field using `aria-describedby`
and `aria-invalid`. Mark required fields in text and native validation semantics.
Do not use placeholders as the only labels. Read-only, disabled and invalid are
different states with different explanations.

Inputs are 36px by default, with a 6px radius and control-strength border. Textareas
grow or scroll without displacing the primary action unexpectedly. Use native
selects for simple short choices; searchable comboboxes need a tested accessible
primitive. Groups of checkboxes/radios need a legend. A switch changes an immediate
setting; it is not a submit button disguised as a toggle.

Tabs change a related panel; navigation links change location. Use the appropriate
keyboard model. A selected tab has an underline and text emphasis, not only a
color difference. Breadcrumbs reveal hierarchy and never replace the page title.

## Tables and results

**One table foundation, distinct data contracts.** An asset list supports names,
status and actions. SQL results preserve column order/types, NULL values and
truncation metadata. An audit table has its own authorization and retention rules.
Do not force all three into an unbounded universal grid.

- Left-align names/text; right-align quantitative values with tabular numerals.
  Column labels follow their data alignment. Use Mono only for technical values.
- Prefer horizontal row dividers and a subtle header; no spreadsheet cage of
  strong vertical lines. Hover and selection have distinct fills. Selected rows
  also retain a checked control or another non-color indicator.
- Row height is a minimum: wrap meaningful labels when required. Do not force
  fixed heights that clip text at zoom. Horizontal scrolling stays inside the
  table region; sticky headers must not obscure focused content.
- Put sorting in header buttons with `aria-sort`. Filters apply to a stated
  scope. Distinguish "no data" from "no matches" and offer Clear filters.
- Use stable row IDs, never visible indexes, for selection. After filtering or
  pagination, disclose whether selection covers visible rows or retained IDs.
  This reference retains selection and explicitly reports when it includes hidden rows.
- Pagination is explicit: range, total when known, and page-size policy. Do not
  invent a total for streamed/truncated results. Large datasets require server
  pagination or an explicitly evaluated virtualization strategy.
- Render SQL NULL as a labelled neutral token; an empty string as `""`; a loading
  value as a placeholder. They must not all become an em dash.
- Results show running/complete/failed/cancelled state, input context and bounded
  output. Partial results never look like successful complete results.
- Row actions remain keyboard reachable. Use an explicit link to open a row
  rather than making a whole row an ambiguous interactive container.

## Feedback, overlays and operational states

Use inline validation for local input errors, an inline banner for a recoverable
task problem and a page state for an unavailable resource/service. Toasts are
brief acknowledgments; the result of a durable operation stays discoverable.
Success, info, warning and danger share typography/spacing and use their semantic
colors with text. Toasts and live announcements must not announce the same message twice.

Empty states explain scope and offer one useful next action. Skeletons preserve
layout while unknown content loads; they do not invent progress. Permission-denied
states reveal no cached protected content. Busy, unknown outcome and failed must
remain distinct states in the component API.

Dialogs have a title, concise consequence, affected target and explicit action.
Trap focus, support Escape where safe, restore focus and use the browser top layer
or an evaluated accessible primitive. Closing a progress inspector does not cancel
a job. Drawers are for supporting context; multi-stage imports/apply stay resumable
pages. Portal content must receive the active theme, density and accessible context.

## Accessibility and validation

Aim for WCAG 2.2 AA. Normal text needs at least 4.5:1 contrast; essential
control/state boundaries need at least 3:1 against adjacent colors. Decorative
separators are deliberately weaker and must not be the sole control boundary.
See W3C's [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
guidance. These are design targets, not a conformance certification.

Our internal control target is 32/36px on desktop and 44px for touch, with 24px
minimum row controls. W3C's [target-size criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
defines the AA minimum and exceptions; spacing exceptions are not a reason to
make primary actions tiny.

Validate supported foreground/background pairs, both themes, keyboard and screen
reader behavior, 200% zoom, narrow layouts, reduced motion and forced colors.
Test real long names, empty/NULL cells, pending states and destructive confirmations.
Contrast arithmetic alone cannot prove focus management, reading order or usability.

## Adoption

The [reference gallery](design-system/README.md) demonstrates these decisions with
synthetic data and reads [shared tokens](../src/ui/tokens.css) directly. The
[component plan](component-architecture.md) defines the future React/TypeScript
surface. Adopt the foundation in slices, starting with shell/forms and one table,
then SQL/notebooks and governed pages. Keep existing workflows and authorization
tests intact. Do not globally restyle embedded Jupyter internals without adapter
work and editor regression coverage.
