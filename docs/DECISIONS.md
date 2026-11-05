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
- **Generic undo**: every structural edit goes through `change(mutator, message)`, which diffs the before/after snapshot, persists only the diff, and offers an Undo toast that reverts exactly those records (so later unrelated edits aren't lost).
- **Back button** goes to the space's parent (or the Library from the root); long-press shows the full path. Linked (non-parent) portals don't change the breadcrumb, which follows the parent chain.
- **Deleting a portal** leaves its subspace in place (it stays reachable from the sidebar tree); nothing is destroyed by a single tap.
- **Selection vs. select mode**: tapping a block selects it (new blocks insert after it); long-pressing a block header (or World ⋯ → Select mode) enters multi-select. Long-press is allowed on the title input so the header has a usable target; plain taps on the title only edit it.
- **Not-yet-built block types** (Media upload, Player, Button…) appear in the picker as dimmed "Soon" tiles. Seeded Player/Playlist/Media blocks render read-only placeholders until Stage 3.
- **Tags/Connections/Style/Appearance/Theme/Export** menu entries show a "arrives in Stage N" toast so the final menu shape is visible now.
- **Portal transition**: ~400ms accent-tinted radial zoom over a zoom-in of the new space; reduced-motion users get a cross-fade only. Depth cue = one thin accent line per level (root counts as one), max 5 plus "+".
- **Inputs** commit on blur/Enter (titles, list items) or after a 500ms pause (note text) rather than per keystroke, to keep IndexedDB writes light.
- **Tag chip gestures**: the spec has both "tap cycles direction" and "tap highlights". Tap on a block's chip = highlight mode, long-press (or the "+N" chip) = tag sheet, where each tag's direction cycles on tap (⇄ → ←) and can be removed. Chips always show a direction glyph and the name, so color is never the only signal.
- **Tag scope**: local tags are keyed `worldId|name`, global tags by `@name`. Color overrides are keyed by display name so a tag keeps one color everywhere.
- **Direction semantics**: a block _sends_ through tags marked ⇄ or →, and _receives_ through ⇄ or ←. A Player plays a Playlist when the playlist sends and the player receives.
- **Uploads** are stored as Blobs in IndexedDB and referenced as `file:<id>`. Images are re-encoded to ≤1600px (JPEG/PNG) with a 3 MB cap, GIFs 4 MB, audio/video 30 MB, each with a clear message. Orphaned files are not garbage-collected (duplicates share them).
- **Audio** uses one module-level `<audio>` element so playback survives navigation. YouTube links can't be played inline (embed only in Media blocks); in a Playlist they open in a new tab. Video links play audio-only.
- **Sample tunes**: the seeded Playlist uses two tiny generated WAVs so playback works offline; an existing Mango World with the old placeholder links is migrated once.
- **Hidden blocks**: Button toggle/tag-group actions set `block.hidden` (or a switch's "hide" effect). Hidden blocks disappear; a "N hidden · Show" pill reveals them as dashed stubs, and the block menu has Hide/Show, so nothing is ever unrecoverable.
- **Toggle default**: new switches start _on_; when off they dim (default), hide, or ignore blocks that share a tag with them (per-switch setting).
- **Random picker** draws from connected List/Playlist blocks (same tag); it also has an "own items" fallback so it works untagged. It never repeats the previous result when it has a choice.
- **Link card** shows the domain and your own description: real previews need a server (CORS), which v1 doesn't have.
- **Timer** run state is local (not saved); only the duration persists.
