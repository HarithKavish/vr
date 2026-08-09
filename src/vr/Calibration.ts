import * as THREE from 'three';

// Records a reference orientation and re-expresses subsequent orientations
// relative to it, so "CENTER VIEW" makes the current facing direction forward.
export class Calibration {
  private referenceInverse = new THREE.Quaternion();
  private hasReference = false;

  center(currentOrientation: THREE.Quaternion): void {
    this.referenceInverse.copy(currentOrientation).invert();
    this.hasReference = true;
  }

  apply(orientation: THREE.Quaternion, out: THREE.Quaternion): THREE.Quaternion {
    if (!this.hasReference) {
      return out.copy(orientation);
    }
    return out.multiplyQuaternions(this.referenceInverse, orientation);
  }

  reset(): void {
    this.hasReference = false;
    this.referenceInverse.identity();
  }
}
