# Decisions

Judgment calls made where the spec was silent.

- **TypeScript pinned to 5.9**: typescript-eslint doesn't yet support TS 7 (Vite's template default).
- **ESLint instead of oxlint**: the Vite template ships oxlint; replaced to match the "ESLint and Prettier" requirement.
- **Branch**: work is committed to `main` as requested (the session started on a scratch branch).
- **Persistence**: IndexedDB via `idb`, one object store per entity kind (worlds, spaces, blocks, customs, meta).
