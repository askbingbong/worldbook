# Worldbook

A mobile-first, offline-first note-taking and universe-building tool. A **Library** holds **Worlds**; worlds are stacks of **blocks** that connect through **tags** and nest through **portals** into subspaces. All data stays in your browser (IndexedDB). No drag and drop anywhere — every move has a tap alternative.

Live: https://askbingbong.github.io/worldbook/

Full spec: [docs/SPEC.md](docs/SPEC.md)

## Run

```bash
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
npm run lint     # ESLint
```

Deployed automatically to GitHub Pages on every push to `main`.

## Status

- [x] Setup: scaffold, spec, CI deploy workflow
- [x] Stage 1: data model, IndexedDB storage, Library (pinned, folders, search, long-press actions), 3-step new-world flow (Default look), seeded Mango World
- [x] Stage 2: world view, block picker/menu, Note/List/Frame/Portal (+ Divider/Label/Spacer), breadcrumbs, Move into…, select mode, undo toasts, sidebar tree on desktop
- [x] Stage 3: tags (direction, local/@global, colors, highlight), Tag Manager, Inspector, Player/Playlist/Media with tag-driven linking, persistent mini-player, offline uploads (compressed + size-capped)
- [x] Stage 4: Button (link / toggle / play-pause / portal / tag-group, block or tag targets), Toggle (reacts via tags), Random picker, plus Counter, Timer, Clock, Link card
- [x] Stage 5: Appearance — live editor (Colors, Font, Shape, Background, Motion, Adv), 4 built-in presets, My Customs (rename, duplicate, delete, reorder, include-in-random, sort), random preset/custom with reroll, inheritance for subspaces, per-family/type/block overrides, contrast guard + auto-fix, randomize with locks
- [ ] Stage 6: polish (a11y, responsive sidebar/inspector, export/import)
