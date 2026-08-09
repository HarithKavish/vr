import * as THREE from 'three';

// Owns the Three.js renderer/scene and the manual split-viewport stereo
// render: a fixed-IPD camera pair parented to a rig whose orientation is
// driven by whichever tracking source is active (WebXR inline pose or
// DeviceOrientation fallback). Rendering is always manual here — relying on
// renderer.xr's own immersive-vr compositor turned out to require a real
// paired headset runtime that most phones don't have, silently leaving the
// canvas unsplit even though sensor tracking kept working.
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
  private ipd = DEFAULT_IPD_METERS;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Real shadow maps, rendered twice per frame (once per eye) — a
    // deliberate perf trade for visual realism on this build.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Filmic tone mapping + a correct sRGB output pipeline. This is the
    // single largest "photographic vs. CG" difference available without
    // post-processing: it rolls off bright emissives instead of clipping
    // them to flat white.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Far plane must clear the city (~330m out). Near stays at 0.1 rather
    // than 0.05 to keep enough depth precision across that larger range.
    this.leftCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
    this.rightCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
    this.rig.add(this.leftCamera, this.rightCamera);
    this.rig.position.set(0, 1.6, 0); // average standing eye height, room center
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
    // Layout can transiently report a zero dimension mid fullscreen/
    // orientation transition; a NaN/Infinity aspect would otherwise poison
    // the projection matrix and render nothing until the next valid resize.
    if (width <= 0 || height <= 0) return;

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

  // Renders left/right halves with no gap, no viewport stretching.
  renderStereoFrame(): void {
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
