import { CATEGORIES } from './categories.js';

function id() {
  return `n_${Math.random().toString(36).slice(2, 10)}`;
}

function eid() {
  return `e_${Math.random().toString(36).slice(2, 10)}`;
}

/** Procedural SVG "mood" covers so the first open feels visual without external assets. */
function moodSvg(label, color, motif) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#0b0a10" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0"/>
    </filter>
  </defs>
  <rect width="420" height="260" fill="#12101a"/>
  <rect width="420" height="260" fill="url(#g)"/>
  <circle cx="320" cy="70" r="90" fill="${color}" opacity="0.18"/>
  <circle cx="80" cy="200" r="70" fill="${color}" opacity="0.12"/>
  <g fill="none" stroke="${color}" stroke-opacity="0.45" stroke-width="1.4">
    ${motif}
  </g>
  <rect width="420" height="260" filter="url(#noise)"/>
  <text x="24" y="230" fill="#f2eef8" font-family="Georgia, serif" font-size="22" opacity="0.85">${label}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const motifs = {
  characters: `<path d="M210 70c20 0 36 16 36 36s-16 36-36 36-36-16-36-36 16-36 36-36z"/><path d="M150 190c20-34 50-50 60-50s40 16 60 50"/>`,
  systems: `<rect x="150" y="80" width="50" height="50" rx="6"/><rect x="220" y="80" width="50" height="50" rx="6"/><path d="M200 105h20M175 130v30M245 130v30M175 160h70"/>`,
  places: `<path d="M90 180 L160 90 L230 180 Z"/><path d="M200 180 L280 100 L360 180"/><path d="M70 180h290"/>`,
  story: `<path d="M80 140c40-50 80-50 120 0s80 50 120 0"/><path d="M80 170c40-50 80-50 120 0s80 50 120 0"/>`,
  decisions: `<path d="M210 60 L270 130 L210 200 L150 130 Z"/><circle cx="210" cy="130" r="10"/>`,
  questions: `<circle cx="210" cy="110" r="40"/><path d="M210 150v20"/><circle cx="210" cy="185" r="4" fill="${CATEGORIES.questions.color}" stroke="none"/>`,
  tapestry: `<path d="M60 80c80 20 80 80 160 80s80-60 160-40"/><path d="M40 150c90-10 110 60 190 40s110-70 160-20"/>`,
};

export function createSeedGraph() {
  const nodes = [
    {
      id: id(),
      x: 120,
      y: 80,
      category: 'characters',
      title: 'The Knotted One',
      notes: 'Protagonist who remembers in loops. Soft silhouette, unfinished edges.',
      imageId: null,
      _seedCover: moodSvg('The Knotted One', CATEGORIES.characters.color, motifs.characters),
    },
    {
      id: id(),
      x: 420,
      y: 60,
      category: 'systems',
      title: 'Thread Economy',
      notes: 'Resources are literal threads. Spending them rewrites nearby spaces.',
      imageId: null,
      _seedCover: moodSvg('Thread Economy', CATEGORIES.systems.color, motifs.systems),
    },
    {
      id: id(),
      x: 700,
      y: 140,
      category: 'places',
      title: 'Loom District',
      notes: 'Vertical city of hanging walkways. Night markets glow amber.',
      imageId: null,
      _seedCover: moodSvg('Loom District', CATEGORIES.places.color, motifs.places),
    },
    {
      id: id(),
      x: 280,
      y: 320,
      category: 'story',
      title: 'First Unravel',
      notes: 'Tutorial beat: player cuts a wrong thread and the map sighs.',
      imageId: null,
      _seedCover: moodSvg('First Unravel', CATEGORIES.story.color, motifs.story),
    },
    {
      id: id(),
      x: 560,
      y: 360,
      category: 'decisions',
      title: 'Keep the Scar?',
      notes: 'Branch: cosmetic scar vs. mechanical buff. Tone choice more than balance.',
      imageId: null,
      _seedCover: moodSvg('Keep the Scar?', CATEGORIES.decisions.color, motifs.decisions),
    },
    {
      id: id(),
      x: 120,
      y: 480,
      category: 'questions',
      title: 'How long is a run?',
      notes: 'Aim for 25–40 minutes? Or shorter loops with deeper meta?',
      imageId: null,
      _seedCover: moodSvg('How long is a run?', CATEGORIES.questions.color, motifs.questions),
    },
    {
      id: id(),
      x: 820,
      y: 420,
      category: 'tapestry',
      title: 'Mood: Violet Dust',
      notes: 'AI / mood board slot. Drop concept art here.',
      imageId: null,
      _seedCover: moodSvg('Violet Dust', CATEGORIES.tapestry.color, motifs.tapestry),
    },
  ];

  const edges = [
    { id: eid(), from: nodes[0].id, to: nodes[3].id },
    { id: eid(), from: nodes[1].id, to: nodes[2].id },
    { id: eid(), from: nodes[3].id, to: nodes[4].id },
    { id: eid(), from: nodes[0].id, to: nodes[1].id },
    { id: eid(), from: nodes[2].id, to: nodes[6].id },
    { id: eid(), from: nodes[4].id, to: nodes[5].id },
  ];

  return {
    version: 1,
    camera: { x: 40, y: 20, scale: 0.95 },
    nodes,
    edges,
  };
}
