import { CATEGORIES, categoryOf } from './categories.js';
import {
  saveGraph,
  loadGraph,
  saveImage,
  loadImage,
  deleteImage,
  dataUrlToBlob,
  exportBundle,
  importBundle,
} from './storage.js';
import { createSeedGraph } from './seed.js';

const NODE_W = 168;
const NODE_H_FALLBACK = 160;

const els = {
  viewport: document.getElementById('viewport'),
  world: document.getElementById('world'),
  nodes: document.getElementById('nodes'),
  edges: document.getElementById('edges'),
  panel: document.getElementById('panel'),
  panelBody: document.getElementById('panel-body'),
  status: document.getElementById('status'),
  categoryPick: document.getElementById('category-pick'),
  btnAdd: document.getElementById('btn-add'),
  btnConnect: document.getElementById('btn-connect'),
  btnFit: document.getElementById('btn-fit'),
  btnExport: document.getElementById('btn-export'),
  btnImport: document.getElementById('btn-import'),
  btnClosePanel: document.getElementById('btn-close-panel'),
  importFile: document.getElementById('import-file'),
  imageFile: document.getElementById('image-file'),
  hint: document.getElementById('minimap-hint'),
};

const state = {
  graph: null,
  selectedId: null,
  selectedEdgeId: null,
  connectMode: false,
  connectFrom: null,
  tempEdge: null,
  imageUrls: new Map(), // imageId -> object URL
  drag: null,
  pan: null,
  spaceDown: false,
  imageTargetNodeId: null,
  saveTimer: null,
};

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;
}

function setStatus(msg) {
  els.status.textContent = msg;
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    persist();
    setStatus(`Saved · ${new Date().toLocaleTimeString()}`);
  }, 250);
}

function persist() {
  const graph = {
    version: 1,
    camera: state.graph.camera,
    nodes: state.graph.nodes.map(({ _seedCover, ...n }) => n),
    edges: state.graph.edges,
  };
  saveGraph(graph);
}

function applyCamera() {
  const { x, y, scale } = state.graph.camera;
  els.world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  // Keep dotted grid feeling stable-ish under pan
  els.viewport.style.backgroundPosition = `${x}px ${y}px`;
  els.viewport.style.backgroundSize = `${28 * scale}px ${28 * scale}px`;
}

function screenToWorld(clientX, clientY) {
  const rect = els.viewport.getBoundingClientRect();
  const { x, y, scale } = state.graph.camera;
  return {
    x: (clientX - rect.left - x) / scale,
    y: (clientY - rect.top - y) / scale,
  };
}

function nodeCenter(node) {
  const el = document.getElementById(`node-${node.id}`);
  const h = el ? el.offsetHeight : NODE_H_FALLBACK;
  return { x: node.x + NODE_W / 2, y: node.y + h / 2 };
}

function nodeById(id) {
  return state.graph.nodes.find((n) => n.id === id);
}

async function resolveCoverUrl(node) {
  if (node.imageId) {
    if (state.imageUrls.has(node.imageId)) {
      return state.imageUrls.get(node.imageId);
    }
    const blob = await loadImage(node.imageId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      state.imageUrls.set(node.imageId, url);
      return url;
    }
  }
  if (node._seedCover) return node._seedCover;
  return null;
}

function renderEdges() {
  const parts = [];
  for (const edge of state.graph.edges) {
    const a = nodeById(edge.from);
    const b = nodeById(edge.to);
    if (!a || !b) continue;
    const ca = nodeCenter(a);
    const cb = nodeCenter(b);
    const midX = (ca.x + cb.x) / 2;
    const midY = (ca.y + cb.y) / 2 - 24;
    const d = `M ${ca.x} ${ca.y} Q ${midX} ${midY} ${cb.x} ${cb.y}`;
    const sel = edge.id === state.selectedEdgeId ? ' selected' : '';
    parts.push(
      `<path class="edge-path${sel}" data-edge-id="${edge.id}" d="${d}" />`
    );
  }
  if (state.tempEdge) {
    const { x1, y1, x2, y2 } = state.tempEdge;
    parts.push(
      `<path class="edge-temp" d="M ${x1} ${y1} L ${x2} ${y2}" />`
    );
  }
  els.edges.innerHTML = parts.join('');
  // Expand SVG hit area conceptually — paths use pointer-events stroke
  els.edges.style.width = '4000px';
  els.edges.style.height = '4000px';

  els.edges.querySelectorAll('.edge-path').forEach((path) => {
    path.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectEdge(path.dataset.edgeId);
    });
  });
}

async function renderNodes() {
  const existing = new Set();
  for (const node of state.graph.nodes) {
    existing.add(node.id);
    let el = document.getElementById(`node-${node.id}`);
    if (!el) {
      el = document.createElement('article');
      el.className = 'node';
      el.id = `node-${node.id}`;
      el.dataset.id = node.id;
      els.nodes.appendChild(el);
      bindNodeEvents(el);
    }
    const cat = categoryOf(node.category);
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.setProperty('--accent-color', cat.color);
    el.classList.toggle('selected', node.id === state.selectedId);

    const coverUrl = await resolveCoverUrl(node);
    const title = node.title?.trim() || '';
    el.innerHTML = `
      ${
        coverUrl
          ? `<img class="node-cover" draggable="false" alt="" src="${coverUrl}" />`
          : `<div class="node-cover placeholder">${cat.emoji}</div>`
      }
      <div class="node-meta">
        <div class="node-cat">${cat.label}</div>
        <div class="node-title${title ? '' : ' empty'}">${
          title || 'Untitled piece'
        }</div>
      </div>
    `;
  }

  // Remove stale DOM nodes
  [...els.nodes.children].forEach((child) => {
    if (!existing.has(child.dataset.id)) child.remove();
  });

  renderEdges();
}

function bindNodeEvents(el) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const id = el.dataset.id;
    const node = nodeById(id);
    if (!node) return;

    if (state.connectMode) {
      if (!state.connectFrom) {
        state.connectFrom = id;
        selectNode(id);
        const c = nodeCenter(node);
        state.tempEdge = { x1: c.x, y1: c.y, x2: c.x, y2: c.y };
        renderEdges();
        setStatus('Pick a target piece…');
      } else if (state.connectFrom !== id) {
        addEdge(state.connectFrom, id);
        state.connectFrom = null;
        state.tempEdge = null;
        setConnectMode(false);
        selectNode(id);
        renderAll();
        scheduleSave();
        setStatus('Connected');
      }
      return;
    }

    selectNode(id);
    const world = screenToWorld(e.clientX, e.clientY);
    state.drag = {
      id,
      offsetX: world.x - node.x,
      offsetY: world.y - node.y,
      pointerId: e.pointerId,
    };
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  });
}

function selectNode(id) {
  state.selectedId = id;
  state.selectedEdgeId = null;
  renderPanel();
  renderNodes();
  els.panel.classList.toggle('collapsed', !id);
}

function selectEdge(id) {
  state.selectedEdgeId = id;
  state.selectedId = null;
  els.panel.classList.add('collapsed');
  renderEdges();
  setStatus('Edge selected · Delete to remove');
}

function clearSelection() {
  state.selectedId = null;
  state.selectedEdgeId = null;
  els.panel.classList.add('collapsed');
  renderNodes();
}

function renderPanel() {
  const node = nodeById(state.selectedId);
  if (!node) {
    els.panelBody.innerHTML = `<p class="muted">Select a piece on the tapestry.</p>${legendHtml()}`;
    return;
  }
  const cat = categoryOf(node.category);
  const options = Object.values(CATEGORIES)
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === node.category ? 'selected' : ''}>${c.label}</option>`
    )
    .join('');

  els.panelBody.innerHTML = `
    <div class="field">
      <label for="f-title">Title</label>
      <input id="f-title" type="text" maxlength="80" value="${escapeAttr(node.title || '')}" placeholder="Short label" />
    </div>
    <div class="field">
      <label for="f-cat">Category</label>
      <select id="f-cat">${options}</select>
    </div>
    <div class="field">
      <label for="f-notes">Notes</label>
      <textarea id="f-notes" placeholder="Details stay in the panel — keep the canvas visual.">${escapeHtml(node.notes || '')}</textarea>
    </div>
    <div class="field">
      <label>Cover</label>
      <div id="panel-cover-slot"></div>
      <div class="panel-actions">
        <button type="button" class="btn" id="f-upload">Upload image</button>
        <button type="button" class="btn ghost" id="f-clear-img">Clear image</button>
      </div>
    </div>
    <div class="panel-actions">
      <button type="button" class="btn danger" id="f-delete">Delete piece</button>
    </div>
    <p class="muted" style="font-size:0.75rem">Accent: <span style="color:${cat.color}">${cat.label}</span></p>
  `;

  resolveCoverUrl(node).then((url) => {
    const slot = document.getElementById('panel-cover-slot');
    if (!slot) return;
    if (url) {
      slot.innerHTML = `<img class="panel-cover" alt="" src="${url}" />`;
    } else {
      slot.innerHTML = `<div class="panel-cover" style="display:flex;align-items:center;justify-content:center;color:var(--text-mute)">${cat.emoji}</div>`;
    }
  });

  document.getElementById('f-title').addEventListener('input', (e) => {
    node.title = e.target.value;
    renderNodes();
    scheduleSave();
  });
  document.getElementById('f-cat').addEventListener('change', (e) => {
    node.category = e.target.value;
    renderPanel();
    renderNodes();
    scheduleSave();
  });
  document.getElementById('f-notes').addEventListener('input', (e) => {
    node.notes = e.target.value;
    scheduleSave();
  });
  document.getElementById('f-upload').addEventListener('click', () => {
    state.imageTargetNodeId = node.id;
    els.imageFile.click();
  });
  document.getElementById('f-clear-img').addEventListener('click', async () => {
    await clearNodeImage(node);
    renderPanel();
    renderNodes();
    scheduleSave();
  });
  document.getElementById('f-delete').addEventListener('click', () => {
    deleteNode(node.id);
  });
}

function legendHtml() {
  const items = Object.values(CATEGORIES)
    .map(
      (c) =>
        `<div class="legend-item"><span class="swatch" style="--c:${c.color}"></span>${c.label}</div>`
    )
    .join('');
  return `<div class="legend">${items}</div>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', '&quot;');
}

async function renderAll() {
  applyCamera();
  await renderNodes();
  if (state.selectedId) renderPanel();
}

function addNode(partial = {}) {
  const cat = els.categoryPick.value || 'tapestry';
  const cam = state.graph.camera;
  const rect = els.viewport.getBoundingClientRect();
  const cx = (rect.width / 2 - cam.x) / cam.scale - NODE_W / 2;
  const cy = (rect.height / 2 - cam.y) / cam.scale - 60;
  const node = {
    id: uid('n'),
    x: partial.x ?? cx + (Math.random() * 40 - 20),
    y: partial.y ?? cy + (Math.random() * 40 - 20),
    category: partial.category || cat,
    title: partial.title || '',
    notes: partial.notes || '',
    imageId: partial.imageId || null,
  };
  state.graph.nodes.push(node);
  selectNode(node.id);
  renderAll();
  scheduleSave();
  setStatus('Piece added');
  return node;
}

function deleteNode(id) {
  const node = nodeById(id);
  if (!node) return;
  state.graph.edges = state.graph.edges.filter((e) => e.from !== id && e.to !== id);
  state.graph.nodes = state.graph.nodes.filter((n) => n.id !== id);
  if (node.imageId) {
    deleteImage(node.imageId).catch(() => {});
    const url = state.imageUrls.get(node.imageId);
    if (url) URL.revokeObjectURL(url);
    state.imageUrls.delete(node.imageId);
  }
  clearSelection();
  renderAll();
  scheduleSave();
  setStatus('Piece deleted');
}

function addEdge(from, to) {
  if (from === to) return;
  const exists = state.graph.edges.some(
    (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)
  );
  if (exists) {
    setStatus('Already connected');
    return;
  }
  state.graph.edges.push({ id: uid('e'), from, to });
}

function deleteSelectedEdge() {
  if (!state.selectedEdgeId) return;
  state.graph.edges = state.graph.edges.filter((e) => e.id !== state.selectedEdgeId);
  state.selectedEdgeId = null;
  renderEdges();
  scheduleSave();
  setStatus('Connection removed');
}

function setConnectMode(on) {
  state.connectMode = on;
  els.btnConnect.classList.toggle('active', on);
  els.viewport.classList.toggle('connecting', on);
  if (!on) {
    state.connectFrom = null;
    state.tempEdge = null;
    renderEdges();
  }
}

function fitView() {
  const nodes = state.graph.nodes;
  if (!nodes.length) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const el = document.getElementById(`node-${n.id}`);
    const h = el ? el.offsetHeight : NODE_H_FALLBACK;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W);
    maxY = Math.max(maxY, n.y + h);
  }
  const rect = els.viewport.getBoundingClientRect();
  const pad = 80;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.min(1.4, Math.max(0.35, Math.min((rect.width - pad * 2) / w, (rect.height - pad * 2) / h)));
  state.graph.camera.scale = scale;
  state.graph.camera.x = (rect.width - w * scale) / 2 - minX * scale;
  state.graph.camera.y = (rect.height - h * scale) / 2 - minY * scale;
  applyCamera();
  scheduleSave();
}

async function attachImageToNode(node, fileOrBlob) {
  const blob = fileOrBlob;
  const imageId = uid('img');
  await saveImage(imageId, blob);
  if (node.imageId) {
    await deleteImage(node.imageId).catch(() => {});
    const old = state.imageUrls.get(node.imageId);
    if (old) URL.revokeObjectURL(old);
    state.imageUrls.delete(node.imageId);
  }
  node.imageId = imageId;
  delete node._seedCover;
  const url = URL.createObjectURL(blob);
  state.imageUrls.set(imageId, url);
}

async function clearNodeImage(node) {
  if (node.imageId) {
    await deleteImage(node.imageId).catch(() => {});
    const url = state.imageUrls.get(node.imageId);
    if (url) URL.revokeObjectURL(url);
    state.imageUrls.delete(node.imageId);
    node.imageId = null;
  }
  delete node._seedCover;
}

async function handleImageFiles(files, worldPos, targetNodeId) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  if (!images.length) return;

  if (targetNodeId) {
    const node = nodeById(targetNodeId);
    if (node) {
      await attachImageToNode(node, images[0]);
      selectNode(node.id);
      await renderAll();
      scheduleSave();
      setStatus('Image updated');
      return;
    }
  }

  // Drop on canvas: create a tapestry piece per image
  let offset = 0;
  for (const file of images) {
    const node = addNode({
      x: (worldPos?.x ?? 200) + offset,
      y: (worldPos?.y ?? 200) + offset,
      category: 'tapestry',
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 40),
    });
    await attachImageToNode(node, file);
    offset += 28;
  }
  await renderAll();
  scheduleSave();
  setStatus(images.length > 1 ? 'Images placed' : 'Image piece created');
}

// —— Pointer / camera ——
els.viewport.addEventListener('pointerdown', (e) => {
  if (e.button === 1 || e.button === 2 || (e.button === 0 && (state.spaceDown || e.target === els.viewport || e.target === els.world || e.target === els.edges || e.target.classList?.contains('edges')))) {
    // Pan on empty space / middle mouse / space+drag
    if (e.button === 0 && state.connectMode && e.target === els.viewport) {
      // cancel connect
      setConnectMode(false);
      clearSelection();
      return;
    }
    if (e.button === 0 && !state.spaceDown && e.target !== els.viewport && e.target !== els.world && !e.target.classList?.contains('edges') && e.target !== els.edges) {
      return;
    }
    e.preventDefault();
    state.pan = {
      startX: e.clientX,
      startY: e.clientY,
      camX: state.graph.camera.x,
      camY: state.graph.camera.y,
      pointerId: e.pointerId,
    };
    els.viewport.setPointerCapture(e.pointerId);
    els.viewport.classList.add('panning');
    if (e.button === 0 && !state.spaceDown) clearSelection();
  }
});

els.viewport.addEventListener('pointermove', (e) => {
  if (state.drag) {
    const world = screenToWorld(e.clientX, e.clientY);
    const node = nodeById(state.drag.id);
    if (!node) return;
    node.x = world.x - state.drag.offsetX;
    node.y = world.y - state.drag.offsetY;
    const el = document.getElementById(`node-${node.id}`);
    if (el) {
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
    }
    renderEdges();
    return;
  }
  if (state.pan) {
    const dx = e.clientX - state.pan.startX;
    const dy = e.clientY - state.pan.startY;
    state.graph.camera.x = state.pan.camX + dx;
    state.graph.camera.y = state.pan.camY + dy;
    applyCamera();
    return;
  }
  if (state.connectMode && state.connectFrom && state.tempEdge) {
    const w = screenToWorld(e.clientX, e.clientY);
    state.tempEdge.x2 = w.x;
    state.tempEdge.y2 = w.y;
    renderEdges();
  }
});

els.viewport.addEventListener('pointerup', (e) => {
  if (state.drag) {
    const el = document.getElementById(`node-${state.drag.id}`);
    if (el) {
      el.classList.remove('dragging');
      try {
        el.releasePointerCapture(state.drag.pointerId);
      } catch {
        /* ignore */
      }
    }
    state.drag = null;
    scheduleSave();
  }
  if (state.pan) {
    els.viewport.classList.remove('panning');
    try {
      els.viewport.releasePointerCapture(state.pan.pointerId);
    } catch {
      /* ignore */
    }
    state.pan = null;
    scheduleSave();
  }
});

els.viewport.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const rect = els.viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x, y, scale } = state.graph.camera;
    const worldX = (mx - x) / scale;
    const worldY = (my - y) / scale;
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const next = Math.min(2.5, Math.max(0.25, scale * factor));
    state.graph.camera.scale = next;
    state.graph.camera.x = mx - worldX * next;
    state.graph.camera.y = my - worldY * next;
    applyCamera();
    scheduleSave();
  },
  { passive: false }
);

els.viewport.addEventListener('dblclick', (e) => {
  if (e.target.closest('.node')) return;
  const w = screenToWorld(e.clientX, e.clientY);
  addNode({ x: w.x - NODE_W / 2, y: w.y - 40 });
});

// Drop overlay
const dropOverlay = document.createElement('div');
dropOverlay.className = 'drop-overlay';
dropOverlay.textContent = 'Drop image to place';
els.viewport.appendChild(dropOverlay);

els.viewport.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropOverlay.classList.add('visible');
});
els.viewport.addEventListener('dragleave', () => {
  dropOverlay.classList.remove('visible');
});
els.viewport.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropOverlay.classList.remove('visible');
  const world = screenToWorld(e.clientX, e.clientY);
  const nodeEl = e.target.closest?.('.node');
  await handleImageFiles(e.dataTransfer.files, world, nodeEl?.dataset?.id);
});

window.addEventListener('paste', async (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  const files = [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  if (!files.length) return;
  e.preventDefault();
  const rect = els.viewport.getBoundingClientRect();
  const world = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  await handleImageFiles(files, world, state.selectedId);
});

// Toolbar
els.btnAdd.addEventListener('click', () => addNode());
els.btnConnect.addEventListener('click', () => {
  setConnectMode(!state.connectMode);
  setStatus(state.connectMode ? 'Connect mode · click two pieces' : 'Ready');
});
els.btnFit.addEventListener('click', () => fitView());
els.btnClosePanel.addEventListener('click', () => clearSelection());

els.btnExport.addEventListener('click', async () => {
  try {
    const bundle = await exportBundle({
      version: 1,
      camera: state.graph.camera,
      nodes: state.graph.nodes.map(({ _seedCover, ...n }) => n),
      edges: state.graph.edges,
    });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `knotted-tapestry-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('Exported JSON');
  } catch (err) {
    console.error(err);
    setStatus('Export failed');
  }
});

els.btnImport.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', async () => {
  const file = els.importFile.files?.[0];
  els.importFile.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const bundle = JSON.parse(text);
    const graph = await importBundle(bundle);
    // Reset object URLs
    for (const url of state.imageUrls.values()) URL.revokeObjectURL(url);
    state.imageUrls.clear();
    state.graph = graph;
    clearSelection();
    await renderAll();
    setStatus('Imported tapestry');
  } catch (err) {
    console.error(err);
    setStatus('Import failed');
  }
});

els.imageFile.addEventListener('change', async () => {
  const file = els.imageFile.files?.[0];
  els.imageFile.value = '';
  if (!file || !state.imageTargetNodeId) return;
  const node = nodeById(state.imageTargetNodeId);
  state.imageTargetNodeId = null;
  if (!node) return;
  await attachImageToNode(node, file);
  renderPanel();
  await renderNodes();
  scheduleSave();
  setStatus('Image updated');
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !isTyping(e)) {
    state.spaceDown = true;
    e.preventDefault();
  }
  if (isTyping(e)) return;

  if (e.key === 'a' || e.key === 'A') {
    addNode();
  } else if (e.key === 'c' || e.key === 'C') {
    setConnectMode(!state.connectMode);
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedEdgeId) deleteSelectedEdge();
    else if (state.selectedId) deleteNode(state.selectedId);
  } else if (e.key === 'Escape') {
    setConnectMode(false);
    clearSelection();
  } else if (e.key === 'f' || e.key === 'F') {
    fitView();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') state.spaceDown = false;
});

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

els.viewport.addEventListener('contextmenu', (e) => e.preventDefault());

// Seed covers into IndexedDB once so export works and cache is warm
async function materializeSeedCovers(graph) {
  for (const node of graph.nodes) {
    if (node._seedCover && !node.imageId) {
      try {
        const blob = await dataUrlToBlob(node._seedCover);
        const imageId = uid('img');
        await saveImage(imageId, blob);
        node.imageId = imageId;
        delete node._seedCover;
      } catch (err) {
        console.warn('Seed cover keep-as-data-url', err);
      }
    }
  }
}

async function boot() {
  let graph = loadGraph();
  if (!graph || !Array.isArray(graph.nodes) || !graph.nodes.length) {
    graph = createSeedGraph();
    await materializeSeedCovers(graph);
    saveGraph({
      version: 1,
      camera: graph.camera,
      nodes: graph.nodes.map(({ _seedCover, ...n }) => n),
      edges: graph.edges,
    });
  }
  state.graph = {
    version: 1,
    camera: graph.camera || { x: 0, y: 0, scale: 1 },
    nodes: graph.nodes || [],
    edges: graph.edges || [],
  };
  await renderAll();
  setTimeout(() => els.hint.classList.add('fade'), 5000);
  setStatus('Ready · your tapestry, local-only');
  els.viewport.focus();
}

boot().catch((err) => {
  console.error(err);
  setStatus('Failed to boot');
});
