import * as THREE from 'three';

// A minimal static room: floor, walls, ceiling, a couple of static shapes,
// and basic lighting. No textures, no animation — just enough geometry to
// verify stereo depth and head tracking.

const ROOM_SIZE = 6;
const ROOM_HEIGHT = 3;

export function buildBasicEnvironment(): THREE.Group {
  const group = new THREE.Group();

  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x556b5a, roughness: 0.9 });
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.95 });
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 1 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  group.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE), ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  group.add(ceiling);

  const wallGeometry = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT);
  const half = ROOM_SIZE / 2;

  const wallDefs: Array<{ position: [number, number, number]; rotationY: number }> = [
    { position: [0, ROOM_HEIGHT / 2, -half], rotationY: 0 },
    { position: [0, ROOM_HEIGHT / 2, half], rotationY: Math.PI },
    { position: [-half, ROOM_HEIGHT / 2, 0], rotationY: Math.PI / 2 },
    { position: [half, ROOM_HEIGHT / 2, 0], rotationY: -Math.PI / 2 },
  ];

  for (const def of wallDefs) {
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(...def.position);
    wall.rotation.y = def.rotationY;
    group.add(wall);
  }

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xd9534f, roughness: 0.6 }),
  );
  cube.position.set(-1.2, 0.3, -1.5);
  group.add(cube);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0x4a90d9, roughness: 0.4, metalness: 0.1 }),
  );
  sphere.position.set(1.2, 0.35, -1.8);
  group.add(sphere);

  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.8, 20),
    new THREE.MeshStandardMaterial({ color: 0xf0ad4e, roughness: 0.5 }),
  );
  cone.position.set(0, 0.4, -2.6);
  group.add(cone);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  group.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(2, ROOM_HEIGHT, 2);
  group.add(directional);

  return group;
}
