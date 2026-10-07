import * as THREE from 'three';
import { categoryOf } from '../categories.js';

const PANEL_W = 4.8;
const PANEL_H = 2.7;
const MOVE_SPEED = 7.2;
const FAST_MULT = 2.1;

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || '').replace(/\n/g, ' \n ').split(/\s+/);
  let line = '';
  let used = 0;
  for (const word of words) {
    if (word === '\n') {
      ctx.fillText(line, x, y);
      line = '';
      y += lineHeight;
      used += 1;
      if (used >= maxLines) return;
      continue;
    }
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
      used += 1;
      if (used >= maxLines) {
        ctx.fillText(line.slice(0, Math.max(1, line.length - 1)) + '…', x, y);
        return;
      }
    } else {
      line = test;
    }
  }
  if (line && used < maxLines) ctx.fillText(line, x, y);
}

function makeSlideTexture(artifact) {
  const w = 1024;
  const h = 576;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const accent = artifact.accent || '#d9a24b';

  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#16140f');
  g.addColorStop(0.45, '#1e1d16');
  g.addColorStop(1, '#0c0c09');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 14, h);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, 0, w, 8);
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(40, 36, 120, 28);
  ctx.fillStyle = accent;
  ctx.font = '600 18px "JetBrains Mono", ui-monospace, monospace';
  const label = artifact.deckTitle
    ? `${String(artifact.slideIndex + 1).padStart(2, '0')}  /  ${String(artifact.totalSlides || 0).padStart(2, '0')}`
    : 'IMAGE';
  ctx.fillText(label, 52, 56);

  ctx.fillStyle = '#f4efe2';
  ctx.font = '700 44px "Instrument Sans", system-ui, sans-serif';
  wrapText(ctx, artifact.title || 'Untitled', 48, 130, w - 96, 52, 2);

  ctx.fillStyle = 'rgba(232, 224, 204, 0.82)';
  ctx.font = '400 26px "Instrument Sans", system-ui, sans-serif';
  wrapText(ctx, artifact.body || '', 48, 230, w - 96, 36, 8);

  ctx.fillStyle = 'rgba(217, 162, 75, 0.55)';
  ctx.font = '500 16px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText((artifact.deckTitle || 'World object').toUpperCase(), 48, h - 36);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function tapestryPose(node, index) {
  const gx = (Number(node.x) || 0) / 140;
  const gz = (Number(node.y) || 0) / 140;
  return {
    x: -16 + (gx % 10) * 1.15,
    y: 0.85 + (index % 5) * 0.35,
    z: 4 + (gz % 12) * 1.1,
  };
}

export function createWorldController({ mount, hud, onInspect, onStatus }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(mount.clientWidth || 800, mount.clientHeight || 600);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'world-canvas';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07070a);
  scene.fog = new THREE.FogExp2(0x07070a, 0.032);

  const camera = new THREE.PerspectiveCamera(
    70,
    (mount.clientWidth || 800) / (mount.clientHeight || 600),
    0.12,
    220
  );
  camera.rotation.order = 'YXZ';

  const hemi = new THREE.HemisphereLight(0xb8c4ff, 0x1a140c, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe6b0, 0.65);
  key.position.set(-8, 14, 4);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x3a3348, 0.35));

  const floorGeo = new THREE.PlaneGeometry(220, 220);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x101018,
    roughness: 0.95,
    metalness: 0.05,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const grid = new THREE.GridHelper(180, 90, 0x3a2f22, 0x1a1712);
  grid.position.y = 0.01;
  scene.add(grid);

  const starsGeo = new THREE.BufferGeometry();
  const starCount = 700;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    starPos[i * 3] = (Math.random() - 0.5) * 160;
    starPos[i * 3 + 1] = 4 + Math.random() * 40;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 180;
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(
    new THREE.Points(
      starsGeo,
      new THREE.PointsMaterial({ color: 0xc4a1ff, size: 0.08, transparent: true, opacity: 0.55 })
    )
  );

  const pathMat = new THREE.LineBasicMaterial({ color: 0xd9a24b, transparent: true, opacity: 0.28 });
  let pathLine = null;

  const artifactGroup = new THREE.Group();
  const tapestryGroup = new THREE.Group();
  scene.add(artifactGroup);
  scene.add(tapestryGroup);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = new Set();
  const clock = new THREE.Clock();

  const state = {
    running: false,
    looking: false,
    raf: 0,
    yaw: 0,
    pitch: 0,
    hover: null,
    objectUrls: [],
  };

  function setCamera(pos) {
    camera.position.set(pos?.x ?? 0, pos?.y ?? 1.65, pos?.z ?? -6.2);
    state.yaw = pos?.yaw ?? Math.PI;
    state.pitch = pos?.pitch ?? 0;
    camera.rotation.set(state.pitch, state.yaw, 0);
  }

  function getCamera() {
    return {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      yaw: state.yaw,
      pitch: state.pitch,
    };
  }

  function clearGroup(group) {
    const dispose = (obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    };
    [...group.children].forEach((child) => {
      child.traverse(dispose);
      group.remove(child);
    });
  }

  function rebuildPath(artifacts) {
    if (pathLine) {
      scene.remove(pathLine);
      pathLine.geometry.dispose();
      pathLine = null;
    }
    const pts = (artifacts || [])
      .filter((a) => a.kind === 'slide')
      .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
      .map((a) => new THREE.Vector3(0, 0.04, a.z));
    if (pts.length < 2) return;
    pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), pathMat);
    scene.add(pathLine);
  }

  function makePanelMesh(artifact) {
    const group = new THREE.Group();
    let map = null;
    if (artifact.kind === 'image' && artifact.imageUrl) {
      map = new THREE.TextureLoader().load(artifact.imageUrl);
      map.colorSpace = THREE.SRGBColorSpace;
    } else {
      map = makeSlideTexture(artifact);
    }
    const mat = new THREE.MeshStandardMaterial({
      map,
      roughness: 0.42,
      metalness: 0.08,
      emissive: new THREE.Color(artifact.accent || '#d9a24b'),
      emissiveIntensity: 0.08,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), mat);
    plane.userData.artifactId = artifact.id;
    group.add(plane);

    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL_W + 0.12, PANEL_H + 0.12),
      new THREE.MeshBasicMaterial({ color: artifact.accent || '#d9a24b', side: THREE.BackSide })
    );
    frame.position.z = -0.01;
    group.add(frame);

    const light = new THREE.PointLight(artifact.accent || '#d9a24b', 0.55, 10, 2);
    light.position.set(0, 0.4, 1.4);
    group.add(light);

    group.position.set(artifact.x, artifact.y, artifact.z);
    group.rotation.y = artifact.yaw || 0;
    group.userData.artifactId = artifact.id;
    return group;
  }

  function setArtifacts(artifacts) {
    clearGroup(artifactGroup);
    for (const url of state.objectUrls) URL.revokeObjectURL(url);
    state.objectUrls = [];
    for (const art of artifacts || []) {
      artifactGroup.add(makePanelMesh(art));
    }
    rebuildPath(artifacts);
  }

  function setTapestryNodes(nodes) {
    clearGroup(tapestryGroup);
    (nodes || []).forEach((node, index) => {
      const cat = categoryOf(node.category);
      const color = new THREE.Color(cat.color);
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.45,
          roughness: 0.35,
          metalness: 0.2,
        })
      );
      const pose = tapestryPose(node, index);
      mesh.position.set(pose.x, pose.y, pose.z);
      mesh.userData.tapestryId = node.id;
      mesh.userData.title = node.title || 'Untitled piece';
      mesh.userData.body = node.notes || cat.label;
      mesh.userData.kind = 'tapestry';
      tapestryGroup.add(mesh);
    });
  }

  function pick(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      [...artifactGroup.children, ...tapestryGroup.children],
      true
    );
    return hits[0] || null;
  }

  function pickCenter() {
    pointer.x = 0;
    pointer.y = 0;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      [...artifactGroup.children, ...tapestryGroup.children],
      true
    );
    return hits[0] || null;
  }

  function inspectHit(hit) {
    if (!hit) return;
    let obj = hit.object;
    while (obj && !obj.userData.artifactId && !obj.userData.tapestryId) obj = obj.parent;
    if (!obj) return;
    if (obj.userData.tapestryId) {
      onInspect?.({
        id: obj.userData.tapestryId,
        kind: 'tapestry',
        title: obj.userData.title,
        body: obj.userData.body,
      });
      return;
    }
    onInspect?.(obj.userData.artifactId);
  }

  function setLooking(on) {
    state.looking = on;
    mount.classList.toggle('looking', on);
    if (hud) hud.classList.toggle('looking', on);
    if (on) {
      renderer.domElement.requestPointerLock?.();
    } else if (document.pointerLockElement === renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  function onMouseMove(e) {
    if (!state.running) return;
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;
    if (!state.looking && document.pointerLockElement !== renderer.domElement) return;
    state.yaw -= dx * 0.0022;
    state.pitch -= dy * 0.0022;
    state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
    camera.rotation.set(state.pitch, state.yaw, 0);
  }

  function onPointerLockChange() {
    const locked = document.pointerLockElement === renderer.domElement;
    state.looking = locked;
    mount.classList.toggle('looking', locked);
    if (hud) hud.classList.toggle('looking', locked);
  }

  function onPointerDown(e) {
    if (!state.running || e.button !== 0) return;
    if (e.target.closest?.('.world-detail, .world-hud button, .world-hud input, label')) return;
    if (document.pointerLockElement === renderer.domElement) {
      inspectHit(pickCenter());
      setLooking(false);
      return;
    }
    const hit = pick(e.clientX, e.clientY);
    if (hit) {
      inspectHit(hit);
      return;
    }
    setLooking(true);
  }

  function onKeyDown(e) {
    if (!state.running) return;
    keys.add(e.code);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === 'Escape') setLooking(false);
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function resize() {
    const w = mount.clientWidth || 800;
    const h = mount.clientHeight || 600;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function tick() {
    if (!state.running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0.0001) forward.normalize();
    right.crossVectors(forward, up).normalize();

    const fast = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = MOVE_SPEED * (fast ? FAST_MULT : 1) * dt;
    if (keys.has('KeyW')) camera.position.addScaledVector(forward, speed);
    if (keys.has('KeyS')) camera.position.addScaledVector(forward, -speed);
    if (keys.has('KeyD')) camera.position.addScaledVector(right, speed);
    if (keys.has('KeyA')) camera.position.addScaledVector(right, -speed);
    if (keys.has('KeyE') || keys.has('Space')) camera.position.y += speed;
    if (keys.has('KeyQ') || keys.has('ControlLeft')) camera.position.y -= speed;
    camera.position.y = Math.max(0.45, Math.min(18, camera.position.y));

    tapestryGroup.children.forEach((m) => {
      m.rotation.y += dt * 0.6;
    });

    renderer.render(scene, camera);
    state.raf = requestAnimationFrame(tick);
  }

  function start() {
    if (state.running) return;
    state.running = true;
    clock.start();
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    tick();
    onStatus?.('World · click to look · WASD to walk');
  }

  function stop() {
    if (!state.running) return;
    state.running = false;
    setLooking(false);
    cancelAnimationFrame(state.raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    keys.clear();
  }

  function dispose() {
    stop();
    clearGroup(artifactGroup);
    clearGroup(tapestryGroup);
    renderer.dispose();
    renderer.domElement.remove();
  }

  setCamera();

  return {
    start,
    stop,
    dispose,
    setArtifacts,
    setTapestryNodes,
    setCamera,
    getCamera,
    setLooking,
    isLooking: () => state.looking,
    isRunning: () => state.running,
    keepObjectUrl(url) {
      if (url) state.objectUrls.push(url);
    },
  };
}
