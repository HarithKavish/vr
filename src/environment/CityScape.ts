import * as THREE from 'three';
import { createBuildingFacadeTextures } from './proceduralTextures';

// A real 3D city surrounding the room, rather than a skyline painted on the
// glass. This matters specifically in VR: a flat texture is identical in
// both eyes, so it reads as a painted wall no matter how detailed it is.
// Actual geometry at varying distances produces real stereo parallax, which
// is the strongest available depth cue.
//
// Everything is instanced — ~420 buildings cost 4 draw calls, not 420.

const CITY_GROUND_Y = -70;
const INNER_RADIUS = 26;
const OUTER_RADIUS = 330;

interface HeightClass {
  height: number;
  count: number;
  minFootprint: number;
  maxFootprint: number;
}

const HEIGHT_CLASSES: HeightClass[] = [
  { height: 38, count: 150, minFootprint: 9, maxFootprint: 16 },
  { height: 62, count: 130, minFootprint: 9, maxFootprint: 15 },
  { height: 92, count: 90, minFootprint: 8, maxFootprint: 13 },
  { height: 125, count: 50, minFootprint: 8, maxFootprint: 12 },
];

// Rejection-sample an annulus so the city surrounds the tower without
// intersecting it, with density falling off toward the horizon.
function samplePosition(): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  // sqrt bias pushes samples outward for even area coverage; the extra
  // pow flattens it back so nearby blocks stay dense enough to feel urban.
  const t = Math.pow(Math.random(), 0.65);
  const radius = INNER_RADIUS + t * (OUTER_RADIUS - INNER_RADIUS);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

function buildInstancedClass(cls: HeightClass, variant: number): THREE.InstancedMesh {
  const { map, emissiveMap } = createBuildingFacadeTextures(variant);
  // Repeat tuned per class so window density stays roughly constant
  // regardless of how tall the class is.
  const repeatY = Math.max(1, Math.round(cls.height / 26));
  map.repeat.set(1, repeatY);
  emissiveMap.repeat.set(1, repeatY);

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0); // origin at base, so scaling grows upward

  const material = new THREE.MeshStandardMaterial({
    map,
    emissiveMap,
    emissive: 0xffffff,
    emissiveIntensity: 2.2,
    roughness: 0.55,
    metalness: 0.15,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, cls.count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();

  for (let i = 0; i < cls.count; i++) {
    const { x, z } = samplePosition();
    const footprintX = cls.minFootprint + Math.random() * (cls.maxFootprint - cls.minFootprint);
    const footprintZ = cls.minFootprint + Math.random() * (cls.maxFootprint - cls.minFootprint);
    const height = cls.height * (0.82 + Math.random() * 0.36);

    position.set(x, CITY_GROUND_Y, z);
    euler.set(0, Math.random() * Math.PI * 2, 0);
    quaternion.setFromEuler(euler);
    scale.set(footprintX, height, footprintZ);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = true;
  return mesh;
}

// Red aviation beacons on the tallest towers — a small detail, but a very
// recognizable one in real night skylines.
function buildBeacons(count: number): THREE.InstancedMesh {
  const geometry = new THREE.SphereGeometry(0.9, 6, 5);
  const material = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const mesh = new THREE.InstancedMesh(geometry, material, count);

  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = INNER_RADIUS + Math.random() * (OUTER_RADIUS - INNER_RADIUS) * 0.75;
    const height = CITY_GROUND_Y + 100 + Math.random() * 45;
    matrix.makeTranslation(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function buildCityScape(): THREE.Group {
  const city = new THREE.Group();

  HEIGHT_CLASSES.forEach((cls, index) => {
    city.add(buildInstancedClass(cls, index));
  });

  city.add(buildBeacons(26));

  // Ground far below, catching a little of the street-level glow.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(OUTER_RADIUS * 1.6, 48),
    new THREE.MeshStandardMaterial({ color: 0x0a0d14, roughness: 0.9, metalness: 0.1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = CITY_GROUND_Y;
  city.add(ground);

  return city;
}
