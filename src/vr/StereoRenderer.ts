import * as THREE from 'three';

// Owns the Three.js renderer/scene and the two rendering paths:
//  - WebXR: renderer.xr handles stereo natively from the XR viewer pose.
//  - Fallback: manual split-viewport rendering with a fixed-IPD camera pair
//    driven by DeviceOrientation via FallbackMotion + Calibration.
//
// IPD is a prototype-only constant; expose it here so it is trivial to
// wire up to a calibration UI later without touching rendering logic.
export const DEFAULT_IPD_METERS = 0.063;

export class StereoRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new THREE.Group();

  private readonly leftCamera: THREE.PerspectiveCamera;
  private readonly rightCamera: THREE.PerspectiveCamera;
  // Used only for the WebXR path: renderer.xr replaces this with its own
  // ArrayCamera derived from the XR views, so it needs no manual IPD offset.
  readonly xrCamera = new THREE.PerspectiveCamera(60, 1, 0.05, 100);
  private ipd = DEFAULT_IPD_METERS;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.xr.enabled = true;

    this.leftCamera = new THREE.PerspectiveCamera(60, 1, 0.05, 100);
    this.rightCamera = new THREE.PerspectiveCamera(60, 1, 0.05, 100);
    this.rig.add(this.leftCamera, this.rightCamera);
    this.scene.add(this.rig);

    this.setIPD(this.ipd);
  }

  setIPD(meters: number): void {
    this.ipd = meters;
    this.leftCamera.position.x = -meters / 2;
    this.rightCamera.position.x = meters / 2;
  }

  getIPD(): number {
    return this.ipd;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    const halfAspect = width / 2 / height;
    this.leftCamera.aspect = halfAspect;
    this.rightCamera.aspect = halfAspect;
    this.leftCamera.updateProjectionMatrix();
    this.rightCamera.updateProjectionMatrix();
  }

  setRigQuaternion(quaternion: THREE.Quaternion): void {
    this.rig.quaternion.copy(quaternion);
  }

  renderXRFrame(): void {
    this.renderer.render(this.scene, this.xrCamera);
  }

  // Renders left/right halves with no gap, no viewport stretching.
  renderFallbackFrame(): void {
    const width = this.renderer.domElement.width;
    const height = this.renderer.domElement.height;
    const halfWidth = width / 2;

    this.renderer.setScissorTest(true);

    this.renderer.setViewport(0, 0, halfWidth, height);
    this.renderer.setScissor(0, 0, halfWidth, height);
    this.renderer.render(this.scene, this.leftCamera);

    this.renderer.setViewport(halfWidth, 0, width - halfWidth, height);
    this.renderer.setScissor(halfWidth, 0, width - halfWidth, height);
    this.renderer.render(this.scene, this.rightCamera);

    this.renderer.setScissorTest(false);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
