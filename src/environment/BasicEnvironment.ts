import * as THREE from 'three';

// A static room built to be looked around from its center: floor, ceiling,
// and four walls each given a distinct color so every heading (front, back,
// left, right) reads differently at a glance, plus a ring of shapes at
// eight compass points and a few heights so any rotation shows something
// new. No textures, no animation — geometry only, kept cheap for mobile.

const ROOM_SIZE = 16;
const ROOM_HEIGHT = 5;
const RING_RADIUS = 5.5;

// North = -Z, East = +X, South = +Z, West = -X (Three.js right-handed, -Z forward).
const WALL_COLORS = {
  north: 0xc0453f, // red — the wall you face by default on entry
  east: 0x4a90d9, // blue — to your right
  south: 0x4caf6e, // green — behind you
  west: 0xd9a441, // amber — to your left
};

function makeWall(color: number, position: [number, number, number], rotationY: number): THREE.Mesh {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }),
  );
  wall.position.set(...position);
  wall.rotation.y = rotationY;
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

export function buildBasicEnvironment(): THREE.Group {
  const group = new THREE.Group();
  const half = ROOM_SIZE / 2;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x3a3f38, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 1 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  group.add(ceiling);

  group.add(makeWall(WALL_COLORS.north, [0, ROOM_HEIGHT / 2, -half], 0));
  group.add(makeWall(WALL_COLORS.south, [0, ROOM_HEIGHT / 2, half], Math.PI));
  group.add(makeWall(WALL_COLORS.west, [-half, ROOM_HEIGHT / 2, 0], Math.PI / 2));
  group.add(makeWall(WALL_COLORS.east, [half, ROOM_HEIGHT / 2, 0], -Math.PI / 2));

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

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  group.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.7);
  directional.position.set(2, ROOM_HEIGHT, 2);
  group.add(directional);

  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-2, ROOM_HEIGHT * 0.6, -2);
  group.add(fill);

  return group;
}
