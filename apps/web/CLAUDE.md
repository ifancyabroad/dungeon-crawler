# Design System

UI in `apps/web` must use the shared theme and components.

---

## Theme

Theme tokens live in [apps/web/src/index.css](src/index.css) (`@theme` block).

Use Tailwind utilities that reference these tokens instead of raw palette classes (e.g. `neutral-900`, `sky-500`). When a token exists for the intent — background, text, border, semantic state — use it. Do not hardcode palette colours.

---

## Components

Reusable components live in [apps/web/src/components](src/components). Before writing UI markup, check there for an existing component. Do not add one-off styled `<button>`, `<input>`, or modal markup when the design system provides an equivalent.

Use `asChild` with `Link` for navigation elements that should render as a button.

---

## Adding to the design system

New tokens go in `index.css` (`@theme`). New primitives go in `apps/web/src/components`. Keep variants and props minimal; extend when needed.
