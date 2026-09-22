# Design reference

[Design specification](../design-system.md) ·
[React/TypeScript component architecture](../component-architecture.md) ·
[Page wireframes](../wireframes/README.md)

Open [index.html](index.html) directly in a browser, or serve the repository root
so the reference can load the shared tokens and bundled fonts:

```sh
python3 -m http.server 4175 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4175/docs/design-system/`.

The gallery demonstrates typography, semantic colors, button states, forms,
sortable/selectable data tables, feedback, dialogs and an applied workspace.
Use Light/Dark and Comfortable/Compact to inspect the same components with
different token values. Data and actions are synthetic and kept in memory.
There is no API integration, analytics, external font request or build step.

[Shared tokens](../../src/ui/tokens.css) are the actual foundation for future UI
components. Gallery styling demonstrates their application; it is not yet a React
component library and is not imported by the production console. Four self-hosted
font files have [source provenance](../../src/ui/fonts/provenance.json) and their
[original license](../../src/ui/fonts/LICENSE.txt).

Review the real content and controls at normal size, in both themes, with keyboard
focus and at 200% zoom. The design uses cool brand colors, with warm semantic
warning/danger where needed. Review exact typography, row density, focus and
information hierarchy before implementing the component contracts.

## Preview and validation

[Light preview](previews/light.png) · [Dark preview](previews/dark.png)

Checked in Chromium on 2026-09-22: 72 token contrast pairs across both themes;
16 theme/density/viewport combinations (1440, 900, 640 and 390px); table sorting,
filtering and retained selection; form validation; modal keyboard containment,
Escape and focus return; busy state width; reduced-motion behavior; and direct
file loading with all four local font faces. No JavaScript errors or external
requests were observed. A forced-colors smoke check is not a full visual audit.
Screen-reader review and manual 200% browser zoom review remain adoption checks.
