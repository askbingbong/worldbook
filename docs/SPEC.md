# Worldbook — Product Spec (source of truth)

Build a mobile-first web app called "Worldbook": a note-taking and "universe-building" tool. Deliver it as a working app, not a mockup. Do NOT use drag and drop anywhere; every move or reorder must have a tap-based alternative.

# CORE CONCEPT

- A **Library** (home screen) holds **Worlds**.
- A World is a page made of **blocks**, stacked vertically.
- Blocks connect to each other through **tags**.
- A **Portal** block leads into a **subspace** (a nested page with its own blocks and portals).
- Everything nests with no limits: frames inside frames, portals inside frames, subspaces inside subspaces.

# LIBRARY

- Grid of world cards (emoji, title, last-visited, themed with that world's look). Pinned section, folders, search across world names, note text, tags and block names, and a "Recent portals" row.
- "+ New World" button. Long-press a card for Pin, Rename, Duplicate, Move to folder, Delete.
- Library menu includes "My Customs" (manage saved looks).

# NEW WORLD FLOW (3 steps)

1. Basics: name, emoji/icon, optional folder.
2. Choose a look, four options:
   - **Default**: standard calm dark look.
   - **Random preset**: picks one built-in (read-only) preset such as cozy, neon, paper, space. Has a Reroll button.
   - **Custom**: opens the user's saved customs, with "+ Create new" pinned at the top. Each entry shows a mini-world preview (note, button, tag chip, portal). "Create new" opens the Custom Editor and, when saved, returns to the picker with it selected.
   - **Random custom**: picks a random one from the user's saved customs, with Reroll, avoiding repeating the last pick. Empty state: dimmed card saying "Make a custom look first, then I can roll one for you" that jumps to Create new.
3. Preview, then "Create world".

Built-in presets and My Customs are two separate libraries. Worlds always store their own COPY of look values: editing a custom never changes existing worlds, and editing a world never changes a custom unless the user explicitly saves.

# INSIDE A WORLD

- Top bar: emoji + title (tap to rename), a horizontally scrolling breadcrumb (Library › World › Subspace › ...), and a ⋯ menu (Appearance, theme, export, select mode).
- Phone bottom bar (5 slots): Library, Back (long-press shows full breadcrumb list), + (add block), Tags, Search.
- Tablet/desktop (≥768px): left sidebar with the world tree; main column ~720px; at ≥1100px an optional right inspector panel.
- A mini-player docks above the bottom bar whenever audio is playing, and keeps playing across portal transitions.
- Empty world: ghost block saying "Tap + to add your first block".

# BLOCK PICKER (bottom sheet from +)

Search field, grouped icon tiles (Content, Audio, Interactive, Structural), and a "Recently used" row. New blocks are inserted under the selected block, otherwise at the end of the current space/frame. Show an Undo toast.

# BLOCK ANATOMY (shared by all blocks)

Header (type icon, editable title, up to 2 tag chips then "+N", ⋯ button), body (type-specific), optional footer. States: default, collapsed, selected, playing, error. Tapping the header collapses/expands. Nothing destructive happens on a single tap.

# BLOCK MENU (⋯ bottom sheet)

Edit, Tags, Connections, Move up/down, Move into…, Duplicate, Collapse/Expand, Style, Delete (red, undo toast, no confirm dialog).

"Move into…" = full-height tree picker (world root, frames, subspaces); tap a destination, then "Move here". Works for multiple blocks.

Select mode (long-press a block): checkboxes appear and a bar offers Move into, Tag, Wrap in frame, Duplicate, Delete.

# BLOCK TYPES

Content:

- **Note**: inline text editing, small toolbar (bold, list, checklist, link), optional markdown.
- **Media**: image/GIF/video by upload or link (embed YouTube and direct URLs). Full-screen with pinch zoom for images.
- **List**: items, optionally checkable, reorder mode with ↑↓ arrows, swipe-left delete, swipe-right check.
- **Link card**: URL with preview.
- **Counter / Timer / Clock**.
  Audio:
- **Player**: file upload or link; play/pause, scrub, ±10s, speed. Shows its source ("From: own file" or "From: #tag playlist"). If tagged, it plays the connected playlist; if untagged, its own source.
- **Playlist**: ordered list of audio/video files and links, with a now-playing marker and ↑↓ reorder mode.
  Interactive:
- **Button**: configurable "When tapped → Action → Target" (open link, toggle a block, play/pause a player, go to a portal, show/hide a tag group). Target can be a block or a tag.
- **Toggle/Switch**: on/off state other blocks can react to.
- **Random picker**: picks a random item from a tagged list.
  Structural:
- **Frame**: container for any blocks including frames; layout switch (stack, row, grid, tabs); collapsible; children indented with a left accent line.
- **Portal**: styles Card, Button, Icon, Banner. Setup: New subspace / Link existing space / Two-way toggle (auto-creates a return portal). Transition is a ~400ms zoom, tinted from the current space's accent into the destination's. Depth cue: thin accent line per level at the top of the screen (up to 5, then a "+" badge). Reduced-motion users get a cross-fade.
- **Divider / Label / Spacer**: decorative, no function.

# TAGS (the glue)

- Any block can have multiple tags (e.g. #mango). Same tag = connected (a Player tagged #mango plays the Playlist tagged #mango). No tag = standalone.
- Direction on each chip, tap to cycle: ⇄ both (default), → sends only, ← receives only.
- Scope: local to the current world by default; prefix @ (e.g. @mango) for global tags that connect across worlds and subspaces.
- Chips are colored with an auto-assigned palette separate from the accent, and a tag keeps its color everywhere. Tap a chip to enter highlight mode (dims everything except blocks sharing that tag); long-press to edit.
- Tag adding sheet: text field plus suggestions of existing tags.
- Blocks that are actively linked show a small link glyph.
- **Tag Manager** (bottom bar): list of tags with color, count, and scope badge; tap to see blocks grouped by world and jump to them; rename, merge, recolor, delete (from blocks only).
- **Block Inspector**: plain-language connection lines ("Plays from Playlist: Summer because both use #mango") and warnings for dead ends ("Nobody else is tagged #mango yet").

# APPEARANCE SYSTEM

Custom Editor: live preview at the top (a mini world with a note, player, button, tag chip, frame with a nested block, list and portal; a toggle switches between Library-card view and inside-a-world view), controls in a bottom sheet with tabs: Colors, Font, Shape, Background, Motion, Adv.

- **Colors**: accent, background, surface, nested surface, text, dim text; swatch palettes or hue wheel/hex; light/dark base. Contrast guard warns when text is unreadable, with an "Auto-fix" button.
- **Font**: separate title and body fonts from a curated list (sans, rounded, serif, mono, handwritten, display); size scale; title weight.
- **Shape**: roundness slider with named stops (Sharp, Soft, Round, Pill) affecting blocks, buttons, chips, inputs and sheets together; border none/thin/thick; shadow none/soft/hard-offset; density compact/comfortable/airy; icon style outline/filled/duotone.
- **Background**: none, solid, gradient, or image (upload or link; fit cover/contain/tile, position, dim and blur sliders, fixed or scrolling). Auto scrim for readability. GIF/video backgrounds allowed with a battery note and a pause-when-idle option.
- **Motion**: animation level full/calm/none.
- **Advanced**: style by family (Content: Note/Media/List/Link; Audio: Player/Playlist; Interactive: Button/Toggle/Counter/Picker; Structural: Frame/Portal/Divider), by block type, or by single block (⋯ → Style). Overrides include background (color, gradient, image), colors, roundness, border, shadow, font, header style.
- Priority, most specific wins: Block → Family → Frame → Space → Parent space → World → Default.
- Randomize: global dice plus a per-setting dice and 🔒 lock.
- **Inheritance**: subspaces inherit the parent's appearance by default. Each setting shows an "Inherited" (↑) or "Custom" (dot) badge. "Customize for this space" overrides everything or a single setting; "Reset to inherited" per setting and per space; optional "Apply to all subspaces" with Undo.
- **Editing later**: World ⋯ → Appearance always opens the editor on the current look. Actions: Done (this world only), Save to Custom, Update "[custom name]" or Save as new, Reset, and "Load custom…". Saving is always an explicit tap. For a subspace, Save to Custom saves its effective look (parent values plus overrides).
- My Customs management (Library ⋯): rename, duplicate, delete, reorder, "include in random" checkbox per custom, sort by recent/name/most used.
- Appearance data stores only what each level overrides; anything missing inherits from the level above.

# DESIGN FOUNDATIONS (defaults before any look is applied)

- Dark default. Tokens: bg #0F1115, surface #171A21, surface-2 #1F232C, line #2A2F3A, text #E8EAF0, text-dim #8B93A5, accent per world.
- Font: clean geometric sans (Inter or similar); scale 12/14/16/20/28; inputs never below 16px (avoids iOS zoom); line-height 1.5.
- 4px grid, gaps 8/12/16/24, block radius 16, nested radius 12, sheet top corners 24, minimum touch target 44x44.
- Motion: 150ms taps, 250ms sheets, 400ms portals.
- Components: primary/secondary/ghost/danger buttons (height 44), bottom sheets (max 90% height, close by tap outside or ✕), toasts above the nav (4s, Undo where relevant), inputs with surface-2 fill and accent focus border.
- Optional gestures, never required: swipe from left edge = Back, pinch = collapse/expand all frames.
- Microcopy: short and warm ("Your universe is empty. Make a world.", "Portal opened. Step through?", "Block deleted. Undo").

# ACCESSIBILITY AND RESPONSIVE

- Contrast ≥ 4.5:1; tag color is never the only signal; full screen-reader labels; keyboard navigation on desktop with visible focus rings; text scaling to 200%; reduced-motion support.
- Breakpoints: <480 single column with bottom nav; 480–767 wider padding with centered sheets (max 560); 768–1099 sidebar tree with 2-col frames possible; ≥1100 sidebar + main + inspector.

# GUARDRAILS

Readability always wins (contrast warnings and auto scrim). Compress uploaded images and cap their size with a clear message. Broken image links fall back to a solid color with a ⚠ indicator. Pause off-screen animated backgrounds. Undo for everything. "Reset to Default" always available in Appearance.

# TECHNICAL REQUIREMENTS

- Offline-first, with all data saved locally in the browser (IndexedDB preferred; localStorage acceptable for a first version). Export and import everything (and single worlds, and customs) as a JSON file.
- No backend required for v1. Keep the data model flat and ID-based: blocks have id, type, parentId, order, content, tags (with direction), and style overrides; spaces and worlds reference blocks; tags resolved at runtime.
- Plain HTML/CSS/JS or a lightweight framework (React or Svelte) is fine; no heavy dependencies. Use CSS variables for all theme tokens so appearance changes apply instantly.
- Include 3–4 built-in presets (cozy, neon, paper, space) and a sample "Mango World" with a Playlist + Player sharing #mango, a Frame containing a Note and image, and a Portal to a "Beach" subspace, so the app is demonstrable on first launch.

# BUILD ORDER

1. Data model and local storage, Library, and world creation with Default look.
2. World view, block picker, block menu, Note/List/Frame/Portal, breadcrumbs, Move into…, select mode.
3. Tags, tag highlight, Tag Manager and Inspector, then Player/Playlist/Media with tag-driven linking and the persistent mini-player.
4. Button/Toggle/Picker actions.
5. Appearance system: editor, presets, My Customs, random options, inheritance, advanced overrides.
6. Polish: accessibility, responsive sidebar and inspector, export/import.

Start by confirming the plan in a few lines, then build step by step, showing the working app after each stage.
