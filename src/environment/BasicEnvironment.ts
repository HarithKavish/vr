import * as THREE from 'three';

// A static room built to be looked around from its center: floor, dropped
// (false) ceiling with recessed light panels, four distinctly colored
// walls each with hanging planters, and a ring of shapes at eight compass
// points so any rotation shows something new. No textures, no animation —
// geometry only, kept cheap for mobile (a handful of point lights, low
// poly counts, shared geometries where it matters).

const ROOM_SIZE = 32;
const ROOM_HEIGHT = 10;
const RING_RADIUS = 11;

const FALSE_CEILING_DROP = 1.2;
const FALSE_CEILING_INSET = 3;
const FALSE_CEILING_Y = ROOM_HEIGHT - FALSE_CEILING_DROP;

// North = -Z, East = +X, South = +Z, West = -X (Three.js right-handed, -Z forward).
interface WallDef {
  name: 'north' | 'east' | 'south' | 'west';
  color: number;
  position: [number, number, number];
  rotationY: number;
  // Unit vector pointing from the wall into the room, used to offset
  // wall-mounted props (plants) off the wall surface.
  inward: THREE.Vector3;
  // Unit vector along the wall's horizontal span, used to space props out.
  tangent: THREE.Vector3;
}

function buildWallDefs(half: number): WallDef[] {
  return [
    {
      name: 'north',
      color: 0xc0453f,
      position: [0, ROOM_HEIGHT / 2, -half],
      rotationY: 0,
      inward: new THREE.Vector3(0, 0, 1),
      tangent: new THREE.Vector3(1, 0, 0),
    },
    {
      name: 'south',
      color: 0x4caf6e,
      position: [0, ROOM_HEIGHT / 2, half],
      rotationY: Math.PI,
      inward: new THREE.Vector3(0, 0, -1),
      tangent: new THREE.Vector3(1, 0, 0),
    },
    {
      name: 'west',
      color: 0xd9a441,
      position: [-half, ROOM_HEIGHT / 2, 0],
      rotationY: Math.PI / 2,
      inward: new THREE.Vector3(1, 0, 0),
      tangent: new THREE.Vector3(0, 0, 1),
    },
    {
      name: 'east',
      color: 0x4a90d9,
      position: [half, ROOM_HEIGHT / 2, 0],
      rotationY: -Math.PI / 2,
      inward: new THREE.Vector3(-1, 0, 0),
      tangent: new THREE.Vector3(0, 0, 1),
    },
  ];
}

function makeWall(def: WallDef): THREE.Mesh {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.9, side: THREE.DoubleSide }),
  );
  wall.position.set(...def.position);
  wall.rotation.y = def.rotationY;
  return wall;
}

function makeMarker(color: number, angleDeg: number, shape: 'box' | 'sphere' | 'cone' | 'torus'): THREE.Mesh {
  const angle = (angleDeg * Math.PI) / 180;
  const x = Math.sin(angle) * RING_RADIUS;
  const z = -Math.cos(angle) * RING_RADIUS;

  let geometry: THREE.BufferGeometry;
  let y: number;
  switch (shape) {
    case 'box':
      geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      y = 0.25;
      break;
    case 'sphere':
      geometry = new THREE.SphereGeometry(0.3, 24, 16);
      y = 0.3;
      break;
    case 'cone':
      geometry = new THREE.ConeGeometry(0.3, 0.7, 20);
      y = 0.35;
      break;
    case 'torus':
      geometry = new THREE.TorusGeometry(0.28, 0.1, 12, 24);
      y = 1.1;
      break;
  }

  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 }));
  mesh.position.set(x, y, z);
  return mesh;
}

// A wall-mounted planter: a small bracket, a tapered pot, and a cascade of
// shrinking leaf clusters hanging below it.
const potGeometry = new THREE.CylinderGeometry(0.12, 0.16, 0.22, 12);
const bracketGeometry = new THREE.BoxGeometry(0.06, 0.06, 0.18);
const leafGeometry = new THREE.SphereGeometry(1, 10, 8);
const potMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.85 });
const bracketMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.3 });
const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x3f7d4f, roughness: 0.7 });

function makeHangingPlant(wall: WallDef, tangentOffset: number, height: number): THREE.Group {
  const plant = new THREE.Group();
  const inwardOffset = wall.inward.clone().multiplyScalar(0.14);
  const tangentVec = wall.tangent.clone().multiplyScalar(tangentOffset);
  const basePosition = new THREE.Vector3(wall.position[0], height, wall.position[2])
    .add(tangentVec)
    .add(inwardOffset);

  const bracket = new THREE.Mesh(bracketGeometry, bracketMaterial);
  bracket.position.copy(basePosition).addScaledVector(wall.inward, -0.05);
  plant.add(bracket);

  const pot = new THREE.Mesh(potGeometry, potMaterial);
  pot.position.copy(basePosition);
  plant.add(pot);

  const vineCount = 4;
  for (let i = 0; i < vineCount; i++) {
    const scale = 0.14 - i * 0.025;
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.scale.setScalar(scale);
    const sideJitter = (i % 2 === 0 ? 1 : -1) * 0.05 * i;
    leaf.position.copy(basePosition)
      .add(wall.tangent.clone().multiplyScalar(sideJitter))
      .addScaledVector(wall.inward, 0.03 * i)
      .setY(basePosition.y - 0.15 - i * 0.16);
    plant.add(leaf);
  }

  return plant;
}

// A recessed square ceiling light panel: an emissive plane facing down.
const lightPanelGeometry = new THREE.PlaneGeometry(1.1, 1.1);
const lightPanelMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xffffff,
  emissiveIntensity: 1.4,
  roughness: 1,
});

function makeLightPanel(x: number, z: number): THREE.Mesh {
  const panel = new THREE.Mesh(lightPanelGeometry, lightPanelMaterial);
  panel.position.set(x, FALSE_CEILING_Y - 0.02, z);
  panel.rotation.x = Math.PI / 2;
  return panel;
}

export function buildBasicEnvironment(): THREE.Group {
  const group = new THREE.Group();
  const half = ROOM_SIZE / 2;
  const walls = buildWallDefs(half);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x3a3f38, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  // True ceiling (structural), then a dropped false ceiling beneath it so
  // the gap between the two reads as a recessed border.
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: 0xcfcfc6, roughness: 1 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  group.add(ceiling);

  const falseCeilingSize = ROOM_SIZE - FALSE_CEILING_INSET * 2;
  const falseCeiling = new THREE.Mesh(
    new THREE.PlaneGeometry(falseCeilingSize, falseCeilingSize),
    new THREE.MeshStandardMaterial({ color: 0xf2f2ec, roughness: 0.95 }),
  );
  falseCeiling.rotation.x = Math.PI / 2;
  falseCeiling.position.y = FALSE_CEILING_Y;
  group.add(falseCeiling);

  // A 3x3 grid of recessed light panels across the false ceiling, each
  // paired with a real point light so the room is actually lit from above.
  const panelSpan = falseCeilingSize * 0.55;
  const gridPositions = [-panelSpan / 2, 0, panelSpan / 2];
  for (const gx of gridPositions) {
    for (const gz of gridPositions) {
      group.add(makeLightPanel(gx, gz));
    }
  }
  for (const gx of [-panelSpan / 2, panelSpan / 2]) {
    for (const gz of [-panelSpan / 2, panelSpan / 2]) {
      const light = new THREE.PointLight(0xfff4e0, 6, 18, 2);
      light.position.set(gx, FALSE_CEILING_Y - 0.3, gz);
      group.add(light);
    }
  }
  const centerLight = new THREE.PointLight(0xfff4e0, 8, 22, 2);
  centerLight.position.set(0, FALSE_CEILING_Y - 0.3, 0);
  group.add(centerLight);

  for (const wall of walls) {
    group.add(makeWall(wall));

    const plantHeight = 2.3;
    const wallHalfSpan = ROOM_SIZE / 2 - 2;
    for (const offset of [-wallHalfSpan * 0.6, 0, wallHalfSpan * 0.6]) {
      group.add(makeHangingPlant(wall, offset, plantHeight));
    }
  }

  // A shape every 45 degrees around the center, alternating form/height.
  const ringDefs: Array<{ angle: number; color: number; shape: 'box' | 'sphere' | 'cone' | 'torus' }> = [
    { angle: 0, color: 0xffffff, shape: 'box' },
    { angle: 45, color: 0xf0ad4e, shape: 'torus' },
    { angle: 90, color: 0xffffff, shape: 'sphere' },
    { angle: 135, color: 0xf0ad4e, shape: 'cone' },
    { angle: 180, color: 0xffffff, shape: 'box' },
    { angle: 225, color: 0xf0ad4e, shape: 'torus' },
    { angle: 270, color: 0xffffff, shape: 'sphere' },
    { angle: 315, color: 0xf0ad4e, shape: 'cone' },
  ];
  for (const def of ringDefs) {
    group.add(makeMarker(def.color, def.angle, def.shape));
  }

  // A center-floor marker directly beneath the viewer, visible when looking down.
  const centerMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 0.03, 32),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }),
  );
  centerMarker.position.y = 0.02;
  group.add(centerMarker);

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  group.add(ambient);

  return group;
}
