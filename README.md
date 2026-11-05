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

## Install & offline

Worldbook is a progressive web app. Open the live site once, then install it (browser menu → Install app / Add to Home Screen; on iPhone use Share → Add to Home Screen). After that it works with no connection. Your worlds live only in this browser's storage, so use **Library ⋯ → Export everything** for backups.

## Status

- [x] Setup: scaffold, spec, CI deploy workflow
- [x] Stage 1: data model, IndexedDB storage, Library (pinned, folders, search, long-press actions), 3-step new-world flow (Default look), seeded Mango World
- [x] Stage 2: world view, block picker/menu, Note/List/Frame/Portal (+ Divider/Label/Spacer), breadcrumbs, Move into…, select mode, undo toasts, sidebar tree on desktop
- [x] Stage 3: tags (direction, local/@global, colors, highlight), Tag Manager, Inspector, Player/Playlist/Media with tag-driven linking, persistent mini-player, offline uploads (compressed + size-capped)
- [x] Stage 4: Button (link / toggle / play-pause / portal / tag-group, block or tag targets), Toggle (reacts via tags), Random picker, plus Counter, Timer, Clock, Link card
- [x] Stage 5: Appearance — live editor (Colors, Font, Shape, Background, Motion, Adv), 4 built-in presets, My Customs (rename, duplicate, delete, reorder, include-in-random, sort), random preset/custom with reroll, inheritance for subspaces, per-family/type/block overrides, contrast guard + auto-fix, randomize with locks
- [x] Stage 6: polish — export/import (everything, single world, customs), right inspector panel (≥1100px), rem-based text (scales to 200%), keyboard focus + focus trap, skip link, optional gestures (edge swipe = Back, pinch frames), reduced-motion
- [x] Follow-up: loop (off / whole list / current item) on Player, playlists and the mini-player; Playlists hold audio, video, images and YouTube links, and a Media block with the same tag becomes the playlist's screen (slideshow for images)
- [x] Follow-up 2: pictures/videos/YouTube in playlists play as autoplaying slideshows (separate from the audio mini-player), fixed frame shape/fit/width so mixed resolutions never shift the page, thumbnails, captions, full screen; audio shuffle; installable + fully offline (service worker), persistent-storage request + storage meter, library sorting
