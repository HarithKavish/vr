import * as THREE from 'three';

// Fallback head tracking using DeviceOrientation, used only when WebXR is
// unavailable. Converts alpha/beta/gamma + screen orientation into a
// quaternion using the standard W3C device-orientation-to-Three.js
// conversion (as used historically by THREE.DeviceOrientationControls).
//
// Device axes: alpha (Z, compass heading), beta (X, front-back tilt),
// gamma (Y, left-right tilt) are combined with the current screen
// orientation angle so portrait/landscape rotation is accounted for.

const DEG2RAD = Math.PI / 180;

const EULER_ORDER = 'YXZ' as const;
const worldZUp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const worldZUpInverse = worldZUp.clone().invert();

function screenOrientationAngle(): number {
  if (screen.orientation && typeof screen.orientation.angle === 'number') {
    return screen.orientation.angle;
  }
  const legacyAngle = (window as unknown as { orientation?: number }).orientation;
  return typeof legacyAngle === 'number' ? legacyAngle : 0;
}

export interface FallbackMotionOptions {
  onUnavailable?: (reason: string) => void;
}

export class FallbackMotion {
  private quaternion = new THREE.Quaternion();
  private euler = new THREE.Euler();
  private screenAngle = screenOrientationAngle();
  private active = false;
  private hasReceivedEvent = false;
  private readonly onOrientationEvent = (event: DeviceOrientationEvent): void => {
    this.hasReceivedEvent = true;
    const alpha = event.alpha ?? 0;
    const beta = event.beta ?? 0;
    const gamma = event.gamma ?? 0;
    this.updateQuaternion(alpha, beta, gamma, this.screenAngle);
  };
  private readonly onScreenOrientationChange = (): void => {
    this.screenAngle = screenOrientationAngle();
  };

  static async requestPermission(): Promise<boolean> {
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        return result === 'granted';
      } catch {
        return false;
      }
    }
    // No explicit permission API (Android/Chrome): assume available.
    return true;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    window.addEventListener('deviceorientation', this.onOrientationEvent, true);
    window.addEventListener('orientationchange', this.onScreenOrientationChange, true);
    if (screen.orientation) {
      screen.orientation.addEventListener('change', this.onScreenOrientationChange);
    }
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener('deviceorientation', this.onOrientationEvent, true);
    window.removeEventListener('orientationchange', this.onScreenOrientationChange, true);
    if (screen.orientation) {
      screen.orientation.removeEventListener('change', this.onScreenOrientationChange);
    }
  }

  isReceivingData(): boolean {
    return this.hasReceivedEvent;
  }

  private updateQuaternion(alphaDeg: number, betaDeg: number, gammaDeg: number, screenAngleDeg: number): void {
    const alpha = alphaDeg * DEG2RAD;
    const beta = betaDeg * DEG2RAD;
    const gamma = gammaDeg * DEG2RAD;
    const orient = screenAngleDeg * DEG2RAD;

    this.euler.set(beta, alpha, -gamma, EULER_ORDER);
    this.quaternion.setFromEuler(this.euler);
    this.quaternion.multiply(worldZUp);
    this.quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient),
    );
    this.quaternion.multiply(worldZUpInverse);
  }

  getQuaternion(out: THREE.Quaternion): THREE.Quaternion {
    return out.copy(this.quaternion);
  }
}
