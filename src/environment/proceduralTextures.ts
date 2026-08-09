import * as THREE from 'three';

// Canvas-generated textures — no network requests, no bundled image assets.
// Traded mobile-safety for visual fidelity here on request; these are the
// most expensive-to-look-good, cheapest-to-compute option available.

function createCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable.');
  return { canvas, ctx };
}

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, v));
}

export function createWoodFloorTexture(baseColor = '#8a6242', size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 70; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.08})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 12, size * 0.7, y + (Math.random() - 0.5) * 12, size, y);
    ctx.stroke();
  }

  const planks = 8;
  for (let i = 1; i < planks; i++) {
    const x = (size / planks) * i;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

// A night-city skyline silhouette: gradient sky, a warm horizon glow, and a
// band of randomly generated buildings with scattered lit windows. Drawn
// once per wall (not tiled) so each "window" shows a slightly different
// skyline.
export function createNightSkylineTexture(width = 512, height = 288): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable.');

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#050810');
  sky.addColorStop(0.6, '#0a0f1e');
  sky.addColorStop(1, '#151b2c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createLinearGradient(0, height * 0.5, 0, height);
  glow.addColorStop(0, 'rgba(255,170,90,0)');
  glow.addColorStop(1, 'rgba(255,170,90,0.1)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);

  let x = 0;
  while (x < width) {
    const buildingWidth = 14 + Math.random() * 26;
    const buildingHeight = 40 + Math.random() * height * 0.6;
    const buildingY = height - buildingHeight;
    const shade = 8 + Math.random() * 8;
    ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 6})`;
    ctx.fillRect(x, buildingY, buildingWidth, buildingHeight);

    const rows = Math.floor(buildingHeight / 11);
    const cols = Math.max(1, Math.floor(buildingWidth / 7));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.32) {
          ctx.fillStyle = Math.random() < 0.8 ? 'rgba(255,214,150,0.9)' : 'rgba(160,200,255,0.75)';
          ctx.fillRect(x + 2 + c * 7, buildingY + 4 + r * 11, 3, 4);
        }
      }
    }
    x += buildingWidth + 2 + Math.random() * 4;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

// A dark polished floor panel texture: subtle seams on a near-black base.
export function createFloorPanelTexture(size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = '#0b0c10';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
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

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createPlasterTexture(baseColor: string, size = 128): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 16;
    data[i] = clamp255(data[i] + noise);
    data[i + 1] = clamp255(data[i + 1] + noise);
    data[i + 2] = clamp255(data[i + 2] + noise);
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}
