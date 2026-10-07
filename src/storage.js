const DB_NAME = 'knotted-tapestry';
const DB_VERSION = 1;
const STORE = 'images';
const GRAPH_KEY = 'knotted-tapestry-graph-v1';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveImage(id, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadImage(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteImage(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export function saveGraph(graph) {
  localStorage.setItem(GRAPH_KEY, JSON.stringify(graph));
}

export function loadGraph() {
  try {
    const raw = localStorage.getItem(GRAPH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearGraph() {
  localStorage.removeItem(GRAPH_KEY);
}

/** Export graph + embedded image data URLs for portable JSON. */
export async function exportBundle(graph) {
  const images = {};
  for (const node of graph.nodes) {
    if (!node.imageId) continue;
    const blob = await loadImage(node.imageId);
    if (blob) {
      images[node.imageId] = await blobToDataUrl(blob);
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    studio: 'Knotted Studios',
    graph,
    images,
  };
}

export async function importBundle(bundle) {
  if (!bundle || !bundle.graph) {
    throw new Error('Invalid tapestry JSON');
  }
  const images = bundle.images || {};
  for (const [id, dataUrl] of Object.entries(images)) {
    const blob = await dataUrlToBlob(dataUrl);
    await saveImage(id, blob);
  }
  saveGraph(bundle.graph);
  return bundle.graph;
}
