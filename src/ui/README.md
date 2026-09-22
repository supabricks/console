# Console UI foundations

This is the future home of the shared React/TypeScript component library.
This first design pass supplies [semantic tokens](tokens.css) and locally hosted
font inputs, not production React components. The current console does not import
these styles, so its appearance and release asset set are unchanged.

See the [design specification](../../docs/design-system.md),
[component architecture](../../docs/component-architecture.md) and
[visual reference](../../docs/design-system/README.md).

Wrap consumers in `.sb-theme`, set `data-sb-theme="light|dark"` and optionally
`data-sb-density="compact"`. Tokens inherit into descendants; portals must inherit
or explicitly carry the same theme scope. The token file owns semantic values.
Reference pages read it directly; do not create a separate copy for each screen.

Font files are unmodified upstream WOFF2 inputs. [Provenance](fonts/provenance.json)
records the exact IBM/Plex commit, source URLs, sizes and hashes; the
[OFL license](fonts/LICENSE.txt) is retained alongside them. Production adoption
must include the license in shipped notices and all used font assets in the
release inventory. These fonts currently serve only the design reference.
