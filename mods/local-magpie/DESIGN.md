# Magpie in kansō

Native usage and library side panel for the existing Herdr App. The user explicitly requests consistency with kansō. Direction: restrained, compact, quiet, legible. Essence: native quiet utility.

Use kansō's existing `ui.js` kit and runtime semantic colors; inherit its font. No independent palette or font installation. The existing kansō panel is the visual reference. GPUI accepts concrete theme colors, so semantic tokens replace CSS/OKLCH authoring here.

| Role | Token |
|---|---|
| Background / text | `canvas` / `text` |
| Secondary / tertiary | `muted` / `dim` |
| Edges / selection | `border` / `selected` |
| States | `green`, `yellow`, `red` plus text labels |
| Spacing | 4, 8, 12, 16, 24 px |
| Radius | controls 6, panel 8 px |
| Type | inherited font; 11.5 body, 12.5 values, 13.5 section, 20 title, 22 metric |

Use the same quiet tabs, icon buttons, input framing and section headings as Spend. One cost total anchors usage; supporting numbers use aligned rows, with no nested card grid. Bars use muted theme colors. Library uses a searchable list with a back-navigation detail view. Preserve selected period, category and query across refresh. No decorative motion or custom brand artwork. Keyboard controls use native Buttons and Input.

Read live gateway usage; read the existing Magpie library directly and never forward MCP secrets to the UI. Library errors stay independent from gateway status. Do not sync or modify agent configuration.

Audit: check native render for clipping at 440 px, consistent gutters, real loading/error/empty states, keyboard input, selectable preview, and matching kansō controls. Final render validation recorded after installation.
