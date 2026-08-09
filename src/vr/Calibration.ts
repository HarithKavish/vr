import * as THREE from 'three';

// Records a reference heading and re-expresses subsequent orientations
// relative to it, so "CENTER VIEW" makes the current facing direction
// forward.
//
// Only the heading (yaw about world up) is cancelled. Cancelling the full
// orientation would fold the phone's pitch and roll at the moment of
// centring into the reference, tilting world up away from gravity — and
// since yaw physically happens about gravity, the room would then swing
// about a tilted axis and the horizon would drift as you turned.

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);

// Below this, the forward vector is too close to vertical for its
// horizontal projection to carry a heading.
const DEGENERATE_EPSILON = 1e-6;

export class Calibration {
  private readonly referenceInverse = new THREE.Quaternion();
  private hasReference = false;
  private readonly forwardScratch = new THREE.Vector3();
  private readonly upScratch = new THREE.Vector3();

  private headingOf(orientation: THREE.Quaternion): number {
    const forward = this.forwardScratch.copy(FORWARD).applyQuaternion(orientation);
    let x = forward.x;
    let z = forward.z;

    if (x * x + z * z < DEGENERATE_EPSILON) {
      // Looking straight up or down: the forward vector has no heading
      // left, but the up vector is horizontal in exactly that case.
      const up = this.upScratch.copy(WORLD_UP).applyQuaternion(orientation);
      const flip = forward.y > 0 ? -1 : 1;
      x = up.x * flip;
      z = up.z * flip;
    }

    return Math.atan2(-x, -z);
  }

  center(currentOrientation: THREE.Quaternion): void {
    this.referenceInverse.setFromAxisAngle(WORLD_UP, -this.headingOf(currentOrientation));
    this.hasReference = true;
  }

  apply(orientation: THREE.Quaternion, out: THREE.Quaternion): THREE.Quaternion {
    if (!this.hasReference) {
      return out.copy(orientation);
    }
    // Pre-multiplying by a pure world-up rotation spins the scene about
    // true vertical, leaving pitch and roll untouched.
    return out.multiplyQuaternions(this.referenceInverse, orientation);
  }

  reset(): void {
    this.hasReference = false;
    this.referenceInverse.identity();
  }
}
