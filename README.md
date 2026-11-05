# Worldbook

A mobile-first, offline-first note-taking and universe-building tool. A **Library** holds **Worlds**; worlds are stacks of **blocks** that connect through **tags** and nest through **portals** into subspaces. All data stays in your browser (IndexedDB). No drag and drop anywhere — every move has a tap alternative.

Live: _(add URL once Pages is enabled — `https://askbingbong.github.io/worldbook/`)_

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
- [ ] Stage 2: world view, block picker/menu, Note/List/Frame/Portal, breadcrumbs, Move into…, select mode
- [ ] Stage 3: tags, highlight, Tag Manager, Inspector, Player/Playlist/Media, mini-player
- [ ] Stage 4: Button/Toggle/Picker actions
- [ ] Stage 5: Appearance system (editor, presets, My Customs, random, inheritance, advanced)
- [ ] Stage 6: polish (a11y, responsive sidebar/inspector, export/import)
