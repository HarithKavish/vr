import * as THREE from 'three';

// Canvas-generated textures — no network requests, no bundled image assets.
// Traded mobile-safety for visual fidelity here on request; these are the
// most expensive-to-look-good, cheapest-to-compute option available.

function createCanvas(width: number, height = width): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable.');
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface FacadeTextures {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

// A building facade: dark concrete/glass base plus a grid of windows, a
// fraction of them lit. The emissive pass carries only the lit windows so
// they glow independently of scene lighting — the core "night city" cue.
export function createBuildingFacadeTextures(seedVariant: number): FacadeTextures {
  const width = 128;
  const height = 256;
  const base = createCanvas(width, height);
  const emissive = createCanvas(width, height);

  const shade = 14 + seedVariant * 5;
  base.ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 7})`;
  base.ctx.fillRect(0, 0, width, height);
  emissive.ctx.fillStyle = '#000000';
  emissive.ctx.fillRect(0, 0, width, height);

  const cols = 8;
  const rows = 26;
  const cellW = width / cols;
  const cellH = height / rows;
  const winW = cellW * 0.62;
  const winH = cellH * 0.55;

  // Whole floors go dark now and then, which reads as far more believable
  // than uniformly random windows.
  for (let r = 0; r < rows; r++) {
    const floorDark = Math.random() < 0.18;
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + (cellW - winW) / 2;
      const y = r * cellH + (cellH - winH) / 2;

      base.ctx.fillStyle = 'rgba(120,150,190,0.10)';
      base.ctx.fillRect(x, y, winW, winH);

      if (floorDark || Math.random() > 0.42) continue;

      const warm = Math.random() < 0.78;
      const alpha = 0.55 + Math.random() * 0.45;
      const color = warm
        ? `rgba(255, ${190 + Math.random() * 40}, ${120 + Math.random() * 50}, ${alpha})`
        : `rgba(${150 + Math.random() * 50}, ${200 + Math.random() * 40}, 255, ${alpha})`;
      emissive.ctx.fillStyle = color;
      emissive.ctx.fillRect(x, y, winW, winH);
      base.ctx.fillStyle = color;
      base.ctx.fillRect(x, y, winW, winH);
    }
  }

  return { map: toTexture(base.canvas, true), emissiveMap: toTexture(emissive.canvas, true) };
}

// Equirectangular night sky used both as the visible background and, via
// PMREM, as the scene's reflection environment. Reflections are what sell
// "glassy", so this doubles as the most important lighting input.
export function createNightSkyEquirect(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const { canvas, ctx } = createCanvas(width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#02030a');
  sky.addColorStop(0.42, '#060b18');
  sky.addColorStop(0.5, '#0d1524');
  sky.addColorStop(0.54, '#1b2436');
  sky.addColorStop(0.62, '#0a0f18');
  sky.addColorStop(1, '#050609');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Warm light-pollution bloom sitting on the horizon line.
  for (let i = 0; i < 5; i++) {
    const cx = Math.random() * width;
    const radius = 120 + Math.random() * 220;
    const glow = ctx.createRadialGradient(cx, height * 0.53, 0, cx, height * 0.53, radius);
    glow.addColorStop(0, 'rgba(255, 168, 92, 0.20)');
    glow.addColorStop(1, 'rgba(255, 168, 92, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - radius, height * 0.53 - radius, radius * 2, radius * 2);
  }

  // Faint stars above the horizon only.
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height * 0.45;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.4})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Scattered city light below the horizon feeds the floor's reflections.
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * width;
    const y = height * 0.55 + Math.random() * height * 0.3;
    ctx.fillStyle = Math.random() < 0.8 ? 'rgba(255,190,120,0.5)' : 'rgba(170,210,255,0.45)';
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1);
  }

  const texture = toTexture(canvas, true);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

// Blotchy grayscale noise driving roughness on the floor. Perfectly uniform
// reflections are the single clearest "this is CG" tell; varying roughness
// breaks them into believable smudges and wear.
export function createSmudgeRoughnessTexture(size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 90; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const radius = 10 + Math.random() * 55;
    const blob = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const bright = Math.random() < 0.5;
    blob.addColorStop(0, bright ? 'rgba(150,150,150,0.5)' : 'rgba(10,10,10,0.5)');
    blob.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = blob;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  return toTexture(canvas, false);
}

// Dark polished floor panels: near-black base with faint seams.
export function createFloorPanelTexture(size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = '#0a0b0f';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  const panels = 4;
  for (let i = 1; i < panels; i++) {
    const p = (size / panels) * i;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  return toTexture(canvas, true);
}
