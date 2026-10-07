# Knotted Studios — Mind Tapestry

A **self-owned**, visual-first game-design map for Knotted Studios (Giovanni + Stefan).

This is **not Notion**. Pieces live in **your browser**: graph structure in `localStorage`, cover images in **IndexedDB**. Nothing is stored on a server. Use **Export** whenever you want a portable backup — that JSON file is also how you share the tapestry with someone else.

## Live site

Open the tapestry (no install):

**https://voeximus.github.io/knotted-studios-tapestry/**

The live site is GitHub Pages. Pushes to `main` rebuild and deploy it via GitHub Actions. Data still lives only in each person’s browser; Export remains the backup and the way to share.

## Run locally

From the repo root:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/knotted-studios-tapestry/`).

Production build:

```bash
npm run build
npm run preview
```

## World mode

Switch **Map / World** in the toolbar.

- **Map** is the original 2D tapestry.
- **World** is a walkable 3D studio. First visit seeds **Hollow Orders Foundation** as a gallery of 24 panels.
- **Click** the dark space to look around (Esc releases). **WASD** walk, **Q/E** or Space/Ctrl move up and down, **Shift** to move faster.
- **Click a panel** (or click while looking) to read the slide. Tapestry pieces from Map appear as colored nodes in the same space.
- **Upload** or drop an HTML deck (`.slide` panels) or images — they become more objects in the world and stay in this browser (Export still backs everything up).

## How to use

| Action | How |
|--------|-----|
| **Pan** | Drag empty canvas (or hold Space + drag) |
| **Zoom** | Mouse wheel (zooms toward cursor) |
| **Add piece** | **+ Piece** or press `A`, or double-click empty space |
| **Move piece** | Drag the piece |
| **Select** | Click a piece → side panel for title, notes, category, image |
| **Delete piece** | Select + `Delete` / `Backspace`, or panel button |
| **Connect** | **Connect** (or `C`), click two pieces |
| **Delete connection** | Click an edge, then `Delete` |
| **Images** | Drop / paste / upload onto canvas or a selected piece |
| **Fit view** | **Fit** or `F` |
| **Export / Import** | Toolbar buttons — JSON includes images |

Categories (color-coded): **Characters**, **Game Systems**, **Places & Levels**, **Story Beats**, **Decisions**, **Open Questions**, **Tapestry** (mood / AI art).

Keep writing in the **side panel**. The canvas stays visual.

## Data ownership

- Auto-saves to this browser profile on this machine. A different browser, computer, or person starts empty.
- **Export** is the backup and the way to share: download the JSON, then **Import** it elsewhere to restore or hand off the tapestry.
- Clearing site data wipes the tapestry — export first.
- No login, no backend, no multiplayer, no Notion sync.

## Stack

Vite + vanilla HTML / CSS / JS. No framework required.
