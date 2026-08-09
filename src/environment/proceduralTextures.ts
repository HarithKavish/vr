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
