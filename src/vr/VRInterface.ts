import * as THREE from 'three';

// Gaze-pointer UI for a headset with no controllers, only a button that
// taps the screen.
//
// The reticle is parented to the head rig, so it sits at the centre of the
// view and never moves. The panels live in world space, so turning your
// head sweeps the reticle across them — that relative motion is the
// pointing mechanism. A tap anywhere on the screen activates whatever the
// reticle is currently on.
//
// Everything here is scene geometry, so it renders through the same stereo
// path as the room and appears correctly in both eyes.

const PANEL_DISTANCE = 2.5;
const RETICLE_BASE_DISTANCE = 2.5;

export interface VRButtonSpec {
  id: string;
  label: string;
  onSelect: () => void;
  // Buttons are laid out in rows; more than about five across becomes an
  // uncomfortably wide sweep of the head to reach the ends.
  row?: number;
}

interface VRButton {
  spec: VRButtonSpec;
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  hovered: boolean;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable.');
  return { canvas, ctx };
}

export class VRInterface {
  readonly group = new THREE.Group();
  readonly reticle = new THREE.Group();
  private readonly reticleRing: THREE.Mesh;
  private readonly reticleHalo: THREE.Mesh;

  private readonly buttons: VRButton[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly origin = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly headQuaternion = new THREE.Quaternion();
  private hovered: VRButton | null = null;

  private readonly infoCanvas: HTMLCanvasElement;
  private readonly infoCtx: CanvasRenderingContext2D;
  private readonly infoTexture: THREE.CanvasTexture;
  private readonly infoMesh: THREE.Mesh;

  constructor(specs: VRButtonSpec[]) {
    const buttonWidth = 0.34;
    const buttonHeight = 0.15;
    const gap = 0.03;
    const rowSpacing = buttonHeight + gap;
    const topRowY = 1.12;

    const rows = new Map<number, VRButtonSpec[]>();
    for (const spec of specs) {
      const row = spec.row ?? 0;
      const existing = rows.get(row);
      if (existing) existing.push(spec);
      else rows.set(row, [spec]);
    }

    for (const [row, rowSpecs] of rows) {
      const totalWidth = rowSpecs.length * buttonWidth + (rowSpecs.length - 1) * gap;
      const startX = -totalWidth / 2 + buttonWidth / 2;

      rowSpecs.forEach((spec, index) => {
        const { canvas, ctx } = makeCanvas(320, 140);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(buttonWidth, buttonHeight),
          // Basic (unlit) so the UI stays readable in a dark night scene.
          new THREE.MeshBasicMaterial({ map: texture, transparent: true, fog: false }),
        );
        mesh.position.set(
          startX + index * (buttonWidth + gap),
          topRowY - row * rowSpacing,
          -PANEL_DISTANCE,
        );
        mesh.renderOrder = 10;

        const button: VRButton = { spec, mesh, canvas, ctx, texture, hovered: false };
        this.drawButton(button);
        this.buttons.push(button);
        this.meshes.push(mesh);
        this.group.add(mesh);
      });
    }

    const info = makeCanvas(512, 320);
    this.infoCanvas = info.canvas;
    this.infoCtx = info.ctx;
    this.infoTexture = new THREE.CanvasTexture(this.infoCanvas);
    this.infoTexture.colorSpace = THREE.SRGBColorSpace;
    this.infoMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.39),
      new THREE.MeshBasicMaterial({ map: this.infoTexture, transparent: true, fog: false }),
    );
    this.infoMesh.position.set(0, 1.62, -PANEL_DISTANCE);
    this.infoMesh.renderOrder = 10;
    this.group.add(this.infoMesh);
    this.setInfoLines([]);

    // Sized to subtend roughly 1.5 degrees, which is about the smallest a
    // reticle can be and still be easy to place. Depth test off keeps it
    // visible against any geometry, and a dark halo behind the bright ring
    // keeps it readable over both the night sky and a lit UI panel.
    this.reticleHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.014, 0.029, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthTest: false, fog: false }),
    );
    this.reticleHalo.renderOrder = 998;

    this.reticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.016, 0.024, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, fog: false }),
    );
    this.reticleRing.renderOrder = 999;

    this.reticle.add(this.reticleHalo, this.reticleRing);
    this.reticle.position.set(0, 0, -RETICLE_BASE_DISTANCE);
  }

  // The reticle must follow the head, so it belongs to the camera rig
  // rather than to the world-space panel group.
  attachReticle(rig: THREE.Object3D): void {
    rig.add(this.reticle);
  }

  private drawButton(button: VRButton): void {
    const { ctx, canvas, hovered, spec } = button;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = hovered ? 'rgba(56,132,255,0.94)' : 'rgba(16,20,28,0.88)';
    roundedRect(ctx, 6, 6, w - 12, h - 12, 22);
    ctx.fill();

    ctx.strokeStyle = hovered ? '#dbe9ff' : 'rgba(150,175,210,0.55)';
    ctx.lineWidth = hovered ? 5 : 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.label, w / 2, h / 2 + 2);

    button.texture.needsUpdate = true;
  }

  setInfoLines(lines: string[]): void {
    const ctx = this.infoCtx;
    const w = this.infoCanvas.width;
    const h = this.infoCanvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    roundedRect(ctx, 6, 6, w - 12, h - 12, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,175,210,0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#cfe0f5';
    ctx.font = '30px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillText(line, 34, 34 + i * 40);
    });

    this.infoTexture.needsUpdate = true;
  }

  setInfoVisible(visible: boolean): void {
    this.infoMesh.visible = visible;
  }

  isInfoVisible(): boolean {
    return this.infoMesh.visible;
  }

  // Casts from the head straight ahead, updates hover state, and parks the
  // reticle on whatever it hits so it never floats at a conflicting depth.
  update(rig: THREE.Object3D): void {
    rig.updateMatrixWorld();
    this.group.updateMatrixWorld();

    this.origin.setFromMatrixPosition(rig.matrixWorld);
    rig.getWorldQuaternion(this.headQuaternion);
    this.direction.set(0, 0, -1).applyQuaternion(this.headQuaternion).normalize();
    this.raycaster.set(this.origin, this.direction);

    const hit = this.raycaster.intersectObjects(this.meshes, false)[0];
    const next = hit ? this.buttons.find((b) => b.mesh === hit.object) ?? null : null;

    if (next !== this.hovered) {
      if (this.hovered) {
        this.hovered.hovered = false;
        this.drawButton(this.hovered);
      }
      if (next) {
        next.hovered = true;
        this.drawButton(next);
      }
      this.hovered = next;

      (this.reticleRing.material as THREE.MeshBasicMaterial).color.set(next ? 0x6cb0ff : 0xffffff);
    }

    const distance = hit ? Math.max(hit.distance - 0.03, 0.3) : RETICLE_BASE_DISTANCE;
    this.reticle.position.set(0, 0, -distance);
    // Keep a constant angular size regardless of how far away it sits.
    this.reticle.scale.setScalar(distance / RETICLE_BASE_DISTANCE);
  }

  // Called on a screen tap — the only input the headset button provides.
  activate(): boolean {
    if (!this.hovered) return false;
    this.hovered.spec.onSelect();
    return true;
  }

  dispose(): void {
    for (const button of this.buttons) {
      button.texture.dispose();
      button.mesh.geometry.dispose();
      (button.mesh.material as THREE.Material).dispose();
    }
    this.infoTexture.dispose();
    this.infoMesh.geometry.dispose();
    (this.infoMesh.material as THREE.Material).dispose();
    for (const part of [this.reticleRing, this.reticleHalo]) {
      part.geometry.dispose();
      (part.material as THREE.Material).dispose();
    }
  }
}
