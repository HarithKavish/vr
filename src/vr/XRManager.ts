import * as THREE from 'three';

// Wraps WebXR immersive-vr session lifecycle. When WebXR provides the pose,
// we never combine raw sensor values ourselves — the renderer's XR camera
// already reflects the tracked viewer pose each frame.
export class XRManager {
  private session: XRSession | null = null;
  private baseReferenceSpace: XRReferenceSpace | null = null;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly onSessionEnd: () => void;

  constructor(renderer: THREE.WebGLRenderer, onSessionEnd: () => void) {
    this.renderer = renderer;
    this.onSessionEnd = onSessionEnd;
  }

  async start(): Promise<void> {
    const nav = navigator as Navigator & { xr?: XRSystem };
    if (!nav.xr) {
      throw new Error('WebXR not available on this device/browser.');
    }

    const session = await nav.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor'],
    });

    this.session = session;
    session.addEventListener('end', this.handleSessionEnd);

    await this.renderer.xr.setSession(session);
    this.baseReferenceSpace = this.renderer.xr.getReferenceSpace();
  }

  private readonly handleSessionEnd = (): void => {
    this.session = null;
    this.baseReferenceSpace = null;
    this.onSessionEnd();
  };

  async stop(): Promise<void> {
    if (this.session) {
      await this.session.end();
    }
  }

  isActive(): boolean {
    return this.session !== null;
  }

  // Recenters the virtual camera on the current head pose by offsetting the
  // reference space, without touching the underlying tracking data.
  centerView(frame: XRFrame): void {
    if (!this.session || !this.baseReferenceSpace) return;

    const pose = frame.getViewerPose(this.baseReferenceSpace);
    if (!pose) return;

    const { position, orientation } = pose.transform;
    const inverseTransform = new XRRigidTransform(
      { x: position.x, y: position.y, z: position.z, w: 1 },
      { x: orientation.x, y: orientation.y, z: orientation.z, w: orientation.w },
    );

    const offsetSpace = this.baseReferenceSpace.getOffsetReferenceSpace(inverseTransform);
    this.renderer.xr.setReferenceSpace(offsetSpace);
  }
}
