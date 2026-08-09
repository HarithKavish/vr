import * as THREE from 'three';

// Provides head-orientation tracking via a WebXR 'inline' session — supported
// broadly (no headset/runtime pairing required, unlike 'immersive-vr') and
// backed by the platform's fused sensor pose rather than raw device events.
// The actual stereo split is always rendered manually by StereoRenderer; this
// class only supplies the tracked quaternion, so we never combine raw sensor
// values ourselves when an XR pose is available.
export class XRManager {
  private session: XRSession | null = null;
  private referenceSpace: XRReferenceSpace | null = null;
  private readonly latestQuaternion = new THREE.Quaternion();
  private readonly onSessionEnd: () => void;

  constructor(onSessionEnd: () => void) {
    this.onSessionEnd = onSessionEnd;
  }

  async start(): Promise<void> {
    const nav = navigator as Navigator & { xr?: XRSystem };
    if (!nav.xr) {
      throw new Error('WebXR not available on this device/browser.');
    }

    const session = await nav.xr.requestSession('inline');
    this.session = session;
    session.addEventListener('end', this.handleSessionEnd);

    try {
      this.referenceSpace = await session.requestReferenceSpace('local');
    } catch {
      this.referenceSpace = await session.requestReferenceSpace('viewer');
    }

    session.requestAnimationFrame(this.onXRFrame);
  }

  private readonly onXRFrame = (_time: number, frame: XRFrame): void => {
    if (!this.session || !this.referenceSpace) return;

    const pose = frame.getViewerPose(this.referenceSpace);
    if (pose) {
      const o = pose.transform.orientation;
      this.latestQuaternion.set(o.x, o.y, o.z, o.w);
    }

    this.session.requestAnimationFrame(this.onXRFrame);
  };

  private readonly handleSessionEnd = (): void => {
    this.session = null;
    this.referenceSpace = null;
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

  getQuaternion(out: THREE.Quaternion): THREE.Quaternion {
    return out.copy(this.latestQuaternion);
  }
}
