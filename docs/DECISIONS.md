# Decisions

Judgment calls made where the spec was silent.

- **TypeScript pinned to 5.9**: typescript-eslint doesn't yet support TS 7 (Vite's template default).
- **ESLint instead of oxlint**: the Vite template ships oxlint; replaced to match the "ESLint and Prettier" requirement.
- **Branch**: work is committed to `main` as requested (the session started on a scratch branch).
- **Persistence**: IndexedDB via `idb`, one object store per entity kind (worlds, spaces, blocks, customs, meta).
- **Routing**: hash routes (`#/`, `#/new`, `#/w/:id`) so GitHub Pages needs no server rewrites.
- **State**: a tiny in-memory store (`useSyncExternalStore`) that writes through to IndexedDB; no state library.
- **Long-press**: 500ms pointer press, plus a visible ⋯ button and right-click/keyboard access on each card.
- **Look options**: step 2 shows Random preset / Custom / Random custom disabled until Stage 5; Default is the only selectable look for now.
- **Seed**: Mango World is seeded once (flag in `meta`), so deleting it doesn't bring it back. Its Playlist uses placeholder links until Stage 3.
