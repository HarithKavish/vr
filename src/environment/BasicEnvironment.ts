import * as THREE from 'three';
import { createFloorPanelTexture, createNightSkylineTexture } from './proceduralTextures';

// A glassy night office: floor-to-ceiling "windows" on all four sides
// showing a procedurally generated city skyline, a dark polished floor,
// warm recessed downlights plus amber accent strips, and a small cluster
// of dark low-poly furniture. No Jarvis/AI holographic UI here by design —
// that's an explicitly later-phase feature; this is the room only.

const ROOM_SIZE = 20;
const ROOM_HEIGHT = 6;
const WINDOW_INSET = 0.15;

interface WallDef {
  position: [number, number, number];
  rotationY: number;
  inward: THREE.Vector3;
  tangent: THREE.Vector3;
}

function buildWallDefs(half: number): WallDef[] {
  return [
    { position: [0, ROOM_HEIGHT / 2, -half], rotationY: 0, inward: new THREE.Vector3(0, 0, 1), tangent: new THREE.Vector3(1, 0, 0) },
    { position: [0, ROOM_HEIGHT / 2, half], rotationY: Math.PI, inward: new THREE.Vector3(0, 0, -1), tangent: new THREE.Vector3(1, 0, 0) },
    { position: [-half, ROOM_HEIGHT / 2, 0], rotationY: Math.PI / 2, inward: new THREE.Vector3(1, 0, 0), tangent: new THREE.Vector3(0, 0, 1) },
    { position: [half, ROOM_HEIGHT / 2, 0], rotationY: -Math.PI / 2, inward: new THREE.Vector3(-1, 0, 0), tangent: new THREE.Vector3(0, 0, 1) },
  ];
}

const mullionMaterial = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.4, metalness: 0.5 });
const mullionGeometryV = new THREE.BoxGeometry(0.05, ROOM_HEIGHT, 0.05);
const mullionGeometryH = new THREE.BoxGeometry(ROOM_SIZE, 0.05, 0.05);

function makeWindowWall(def: WallDef): THREE.Group {
  const group = new THREE.Group();

  const skyline = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    new THREE.MeshBasicMaterial({ map: createNightSkylineTexture() }),
  );
  skyline.position.set(...def.position);
  skyline.rotation.y = def.rotationY;
  group.add(skyline);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    new THREE.MeshPhysicalMaterial({
      color: 0x9fc4ff,
      transparent: true,
      opacity: 0.06,
      roughness: 0.05,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  glass.position.copy(new THREE.Vector3(...def.position)).addScaledVector(def.inward, WINDOW_INSET);
  glass.rotation.y = def.rotationY;
  group.add(glass);

  const mullionCount = 6;
  for (let i = 1; i < mullionCount; i++) {
    const t = (i / mullionCount - 0.5) * ROOM_SIZE;
    const mullion = new THREE.Mesh(mullionGeometryV, mullionMaterial);
    mullion.position
      .set(def.position[0], ROOM_HEIGHT / 2, def.position[2])
      .add(def.tangent.clone().multiplyScalar(t))
      .addScaledVector(def.inward, WINDOW_INSET + 0.02);
    mullion.rotation.y = def.rotationY;
    group.add(mullion);
  }
  const midMullion = new THREE.Mesh(mullionGeometryH, mullionMaterial);
  midMullion.position.set(def.position[0], ROOM_HEIGHT * 0.62, def.position[2]).addScaledVector(def.inward, WINDOW_INSET + 0.02);
  midMullion.rotation.y = def.rotationY;
  group.add(midMullion);

  return group;
}

// Simple dark low-poly furniture: an armchair (seat + back + arms + legs).
function makeArmchair(): THREE.Group {
  const chair = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: 0x1b1712, roughness: 0.55, metalness: 0.1 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.4, metalness: 0.6 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.6), leather);
  seat.position.y = 0.42;
  chair.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.12), leather);
  back.position.set(0, 0.7, -0.24);
  chair.add(back);

  const armGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.55);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeometry, leather);
    arm.position.set(side * 0.31, 0.56, 0);
    chair.add(arm);
  }

  const legGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8);
  for (const [lx, lz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]] as const) {
    const leg = new THREE.Mesh(legGeometry, trim);
    leg.position.set(lx, 0.2, lz);
    chair.add(leg);
  }

  chair.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return chair;
}

function makeLowTable(): THREE.Group {
  const table = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.4, metalness: 0.3 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.55), wood);
  top.position.y = 0.4;
  table.add(top);

  const legGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8);
  for (const [lx, lz] of [[-0.4, -0.22], [0.4, -0.22], [-0.4, 0.22], [0.4, 0.22]] as const) {
    const leg = new THREE.Mesh(legGeometry, wood);
    leg.position.set(lx, 0.2, lz);
    table.add(leg);
  }

  const books = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.08, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x5a2a2a, roughness: 0.7 }),
  );
  books.position.set(-0.2, 0.46, 0.05);
  table.add(books);

  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.04, 0.09, 16),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d5, roughness: 0.3 }),
  );
  mug.position.set(0.2, 0.47, -0.05);
  table.add(mug);

  table.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return table;
}

function makeDeskPlant(): THREE.Group {
  const plant = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 0.16, 14),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }),
  );
  pot.position.y = 0.08;
  plant.add(pot);

  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 0.75 });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.28 + Math.random() * 0.12, 6), leafMaterial);
    const angle = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 0.03, 0.28, Math.sin(angle) * 0.03);
    leaf.rotation.z = Math.cos(angle) * 0.3;
    leaf.rotation.x = Math.sin(angle) * 0.3;
    plant.add(leaf);
  }

  plant.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return plant;
}

function makeDownlight(x: number, z: number, ceilingY: number, castsShadow: boolean): THREE.Group {
  const group = new THREE.Group();
  const fixture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.04, 20),
    new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffb066, emissiveIntensity: 1.2, roughness: 1 }),
  );
  fixture.position.set(x, ceilingY - 0.02, z);
  fixture.rotation.x = Math.PI / 2;
  group.add(fixture);

  const light = new THREE.PointLight(0xffb066, 5, 12, 2);
  light.position.set(x, ceilingY - 0.15, z);
  if (castsShadow) {
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.bias = -0.002;
  }
  group.add(light);

  return group;
}

function makeAccentStrip(x: number, z: number, length: number, rotationY: number, ceilingY: number): THREE.Mesh {
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.03, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xffa63d, emissiveIntensity: 2, roughness: 1 }),
  );
  strip.position.set(x, ceilingY - 0.05, z);
  strip.rotation.y = rotationY;
  return strip;
}

export function buildBasicEnvironment(): THREE.Group {
  const group = new THREE.Group();
  const half = ROOM_SIZE / 2;
  const walls = buildWallDefs(half);

  const floorTexture = createFloorPanelTexture();
  floorTexture.repeat.set(ROOM_SIZE / 2, ROOM_SIZE / 2);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.2, metalness: 0.6 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x0f1014, roughness: 0.9 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  ceiling.receiveShadow = true;
  group.add(ceiling);

  for (const wall of walls) {
    group.add(makeWindowWall(wall));
  }

  const downlightGrid = [-half * 0.4, 0, half * 0.4];
  let first = true;
  for (const gx of downlightGrid) {
    for (const gz of downlightGrid) {
      group.add(makeDownlight(gx, gz, ROOM_HEIGHT, first));
      first = false;
    }
  }

  group.add(makeAccentStrip(-half * 0.5, -half * 0.5, ROOM_SIZE * 0.5, Math.PI / 4, ROOM_HEIGHT));
  group.add(makeAccentStrip(half * 0.3, -half * 0.2, ROOM_SIZE * 0.35, -Math.PI / 6, ROOM_HEIGHT));

  const chairA = makeArmchair();
  chairA.position.set(2.2, 0, 2.6);
  chairA.rotation.y = Math.PI * 0.85;
  group.add(chairA);

  const chairB = makeArmchair();
  chairB.position.set(1.1, 0, 3.4);
  chairB.rotation.y = Math.PI * 1.1;
  group.add(chairB);

  const table = makeLowTable();
  table.position.set(1.7, 0, 2.9);
  table.rotation.y = Math.PI * 0.9;
  group.add(table);

  const plant = makeDeskPlant();
  plant.position.set(-2.8, 0, -3.2);
  group.add(plant);

  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 32),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.95 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.005;
  rug.receiveShadow = true;
  group.add(rug);

  const hemi = new THREE.HemisphereLight(0x30507a, 0x0a0a0c, 0.4);
  group.add(hemi);

  const moonlight = new THREE.DirectionalLight(0x8fb0ff, 0.25);
  moonlight.position.set(-half, ROOM_HEIGHT, -half * 0.5);
  group.add(moonlight);

  return group;
}
