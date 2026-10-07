const SKIP = new Set([
  'PLAYERS',
  'BROTHERS',
  'DECISIONS',
  'RIPPLE',
  'PAIR 1',
  'PAIR 2',
  'CRITICAL',
  'TOGETHER',
  'SPLIT',
  'AHEAD',
  'INPUTS',
  'HOLLOW ORDERS',
  'FOUNDATION BRIEFING',
]);

const FOOTER = /HOLLOW ORDERS\s*\/\/\s*FOUNDATION BRIEFING\s*\d*/gi;

function cleanLine(line) {
  return String(line || '')
    .replace(FOOTER, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectLines(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const lines = [];
  let node;
  while ((node = walker.nextNode())) {
    const t = cleanLine(node.textContent);
    if (!t || t.length < 2) continue;
    if (SKIP.has(t.toUpperCase())) continue;
    if (/^[\W\d]+$/.test(t)) continue;
    lines.push(t);
  }
  const seen = new Set();
  const uniq = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(line);
  }
  return uniq;
}

function pickTitle(lines, index) {
  const heading = lines.find((l) => l.length <= 64 && !/[.!?]$/.test(l) && l.length >= 3);
  if (heading) return heading.slice(0, 80);
  if (lines[0]) return lines[0].slice(0, 80);
  return `Slide ${index + 1}`;
}

/** Parse an uploaded HTML deck into slides (`.slide` elements). */
export function parseHtmlDeck(htmlString, filename = 'Deck') {
  const doc = new DOMParser().parseFromString(htmlString, 'text/html');
  const nodes = [...doc.querySelectorAll('.slide')].filter(
    (el) => !el.classList.contains('deck-slide') || el.matches('.slide:not(.deck-slide)')
  );
  const slides = (nodes.length ? nodes : []).map((el, index) => {
    const lines = collectLines(el);
    const title = pickTitle(lines, index);
    const body = lines.filter((l) => l.toLowerCase() !== title.toLowerCase()).join('\n');
    return { index, title, body: body.slice(0, 1400) };
  });

  const title =
    cleanLine(doc.querySelector('title')?.textContent) ||
    filename.replace(/\.[^.]+$/, '') ||
    'Untitled deck';

  return {
    title,
    source: filename,
    slides,
  };
}

export function isHtmlFile(file) {
  const name = (file.name || '').toLowerCase();
  return (
    file.type === 'text/html' ||
    name.endsWith('.html') ||
    name.endsWith('.htm')
  );
}

export function galleryPose(index, startZ = 0) {
  const side = index % 2 === 0 ? -1 : 1;
  return {
    x: side * 4.7,
    y: 1.64 + Math.sin(index * 0.55) * 0.1,
    z: startZ + index * 6.8,
    yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2,
  };
}

export function nextGalleryStartZ(artifacts) {
  const zs = (artifacts || [])
    .filter((a) => a.kind === 'slide' || a.kind === 'image')
    .map((a) => a.z);
  return zs.length ? Math.max(...zs) + 8.5 : 0;
}
