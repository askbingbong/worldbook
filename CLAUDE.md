# Worldbook — project memory

Mobile-first, offline-first note/"universe-building" app. Full spec: `docs/SPEC.md` (source of truth). Judgment calls: `docs/DECISIONS.md`.

## Stack

Vite + React + TypeScript, plain CSS with CSS variables (no UI framework), IndexedDB via `idb`. ESLint + Prettier. Deployed to GitHub Pages (`base: '/worldbook/'`).

## Layout

- `src/model/` types, defaults, tag/appearance resolution (pure logic)
- `src/store/` IndexedDB persistence + app state
- `src/ui/` components (library, world, blocks, sheets, appearance)
- `src/styles/` global CSS + tokens
- `docs/` SPEC.md, DECISIONS.md

## Commands

- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm run lint` — ESLint (`npm run format` for Prettier)

## Rules

- **No drag and drop, ever.** Every move/reorder needs a tap-based alternative (↑↓, Move into…).
- **Worlds store their own copy of look values.** Editing a custom never changes worlds; editing a world never changes a custom unless the user explicitly saves.
- Data model is flat and ID-based; appearance stores only overrides, the rest inherits.
- All theme values are CSS variables. Touch targets ≥ 44px; inputs ≥ 16px.
- **Update the status checklist in README.md after each stage.** Each stage: build + lint pass, commit, push to main.
