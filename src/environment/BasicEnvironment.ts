import * as THREE from 'three';
import { createPlasterTexture, createWoodFloorTexture } from './proceduralTextures';

// A static room built to be looked around from its center: floor, dropped
// (false) ceiling with recessed light panels, four distinctly colored
// walls each with hanging planters, and a ring of shapes at eight compass
// points so any rotation shows something new.
//
// This build trades mobile-safety for visual fidelity on request: real
// shadow maps (2 shadow-casting lights, not all of them — five would be
// brutal on a phone doing stereo rendering) and canvas-generated (no
// network) procedural textures instead of flat colors.

const ROOM_SIZE = 32;
const ROOM_HEIGHT = 10;
const RING_RADIUS = 11;

const FALSE_CEILING_DROP = 1.2;
const FALSE_CEILING_INSET = 3;
const FALSE_CEILING_Y = ROOM_HEIGHT - FALSE_CEILING_DROP;

function hexToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

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
  const texture = createPlasterTexture(hexToCss(def.color));
  texture.repeat.set(ROOM_SIZE / 4, ROOM_HEIGHT / 4);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88, side: THREE.DoubleSide }),
  );
  wall.position.set(...def.position);
  wall.rotation.y = def.rotationY;
  wall.receiveShadow = true;
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
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A wall-mounted planter: bracket, tapered pot with a soil disc and rim,
// and a cascade of irregular leaf clusters (icosahedra, not spheres, for a
// less obviously-primitive silhouette) trailing below it.
const potGeometry = new THREE.CylinderGeometry(0.12, 0.16, 0.22, 14);
const potRimGeometry = new THREE.TorusGeometry(0.13, 0.015, 8, 16);
const soilGeometry = new THREE.CircleGeometry(0.115, 14);
const bracketGeometry = new THREE.BoxGeometry(0.06, 0.06, 0.18);
const leafGeometry = new THREE.IcosahedronGeometry(1, 1);
const vineStrandGeometry = new THREE.CylinderGeometry(0.008, 0.008, 1, 5);

const potMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.8 });
const potRimMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.6 });
const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 1 });
const bracketMaterial = new THREE.MeshStandardMaterial({ color: 0x2f2f2f, roughness: 0.5, metalness: 0.4 });
const leafMaterialA = new THREE.MeshStandardMaterial({ color: 0x3f7d4f, roughness: 0.75 });
const leafMaterialB = new THREE.MeshStandardMaterial({ color: 0x5a9a5f, roughness: 0.75 });
const vineMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.9 });

function addShadow(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeHangingPlant(wall: WallDef, tangentOffset: number, height: number): THREE.Group {
  const plant = new THREE.Group();
  const inwardOffset = wall.inward.clone().multiplyScalar(0.14);
  const tangentVec = wall.tangent.clone().multiplyScalar(tangentOffset);
  const basePosition = new THREE.Vector3(wall.position[0], height, wall.position[2])
    .add(tangentVec)
    .add(inwardOffset);

  const bracket = addShadow(new THREE.Mesh(bracketGeometry, bracketMaterial));
  bracket.position.copy(basePosition).addScaledVector(wall.inward, -0.05);
  plant.add(bracket);

  const pot = addShadow(new THREE.Mesh(potGeometry, potMaterial));
  pot.position.copy(basePosition);
  plant.add(pot);

  const rim = new THREE.Mesh(potRimGeometry, potRimMaterial);
  rim.position.copy(basePosition).setY(basePosition.y + 0.11);
  rim.rotation.x = Math.PI / 2;
  plant.add(rim);

  const soil = new THREE.Mesh(soilGeometry, soilMaterial);
  soil.position.copy(basePosition).setY(basePosition.y + 0.105);
  soil.rotation.x = -Math.PI / 2;
  plant.add(soil);

  const clusterCount = 5;
  for (let i = 0; i < clusterCount; i++) {
    const scale = 0.15 - i * 0.02 + Math.random() * 0.015;
    const leaf = addShadow(new THREE.Mesh(leafGeometry, i % 2 === 0 ? leafMaterialA : leafMaterialB));
    leaf.scale.set(scale, scale * (0.8 + Math.random() * 0.3), scale);
    leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    const sideJitter = (i % 2 === 0 ? 1 : -1) * (0.04 + Math.random() * 0.03) * i;
    const dropY = basePosition.y - 0.14 - i * 0.15 - Math.random() * 0.03;
    leaf.position
      .copy(basePosition)
      .add(wall.tangent.clone().multiplyScalar(sideJitter))
      .addScaledVector(wall.inward, 0.02 * i + Math.random() * 0.02)
      .setY(dropY);
    plant.add(leaf);

    if (i > 0) {
      const prevY = basePosition.y - 0.14 - (i - 1) * 0.15;
      const strand = new THREE.Mesh(vineStrandGeometry, vineMaterial);
      const strandLength = prevY - dropY;
      strand.scale.set(1, Math.max(strandLength, 0.02), 1);
      strand.position.copy(leaf.position).setY((prevY + dropY) / 2);
      plant.add(strand);
    }
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

// A simple baseboard trim strip run along the base of each wall.
function makeBaseboard(wall: WallDef): THREE.Mesh {
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_SIZE, 0.12, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.6 }),
  );
  board.position.set(wall.position[0], 0.06, wall.position[2]);
  board.rotation.y = wall.rotationY;
  board.position.addScaledVector(wall.inward, 0.015);
  board.receiveShadow = true;
  return board;
}

export function buildBasicEnvironment(): THREE.Group {
  const group = new THREE.Group();
  const half = ROOM_SIZE / 2;
  const walls = buildWallDefs(half);

  const floorTexture = createWoodFloorTexture();
  floorTexture.repeat.set(ROOM_SIZE / 2, ROOM_SIZE / 2);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.65 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // True ceiling (structural), then a dropped false ceiling beneath it so
  // the gap between the two reads as a recessed border.
  const ceilingTexture = createPlasterTexture('#cfcfc6');
  ceilingTexture.repeat.set(ROOM_SIZE / 4, ROOM_SIZE / 4);
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ map: ceilingTexture, roughness: 1 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  group.add(ceiling);

  const falseCeilingTexture = createPlasterTexture('#f2f2ec');
  const falseCeilingSize = ROOM_SIZE - FALSE_CEILING_INSET * 2;
  falseCeilingTexture.repeat.set(falseCeilingSize / 4, falseCeilingSize / 4);
  const falseCeiling = new THREE.Mesh(
    new THREE.PlaneGeometry(falseCeilingSize, falseCeilingSize),
    new THREE.MeshStandardMaterial({ map: falseCeilingTexture, roughness: 0.95 }),
  );
  falseCeiling.rotation.x = Math.PI / 2;
  falseCeiling.position.y = FALSE_CEILING_Y;
  falseCeiling.receiveShadow = true;
  group.add(falseCeiling);

  // A 3x3 grid of recessed light panels across the false ceiling. Only the
  // center one casts real shadows; the rest are non-shadow fill lights —
  // five simultaneous shadow-casting point lights would be genuinely
  // unusable on a phone rendering stereo.
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
  const centerLight = new THREE.PointLight(0xfff4e0, 8, 24, 2);
  centerLight.position.set(0, FALSE_CEILING_Y - 0.3, 0);
  centerLight.castShadow = true;
  centerLight.shadow.mapSize.set(512, 512);
  centerLight.shadow.bias = -0.002;
  group.add(centerLight);

  // A single "sun" through an imagined window: the main shadow-casting light.
  const sun = new THREE.DirectionalLight(0xfff0dd, 1.1);
  sun.position.set(half * 0.5, ROOM_HEIGHT - 1, half * 0.4);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -half;
  sun.shadow.camera.right = half;
  sun.shadow.camera.top = half;
  sun.shadow.camera.bottom = -half;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = ROOM_HEIGHT + half;
  sun.shadow.bias = -0.0015;
  group.add(sun, sun.target);

  for (const wall of walls) {
    group.add(makeWall(wall));
    group.add(makeBaseboard(wall));

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
  centerMarker.receiveShadow = true;
  group.add(centerMarker);

  // Sky-tinted-from-above, ground-tinted-from-below fill light, replacing a
  // flat ambient for a more natural (if still cheap) base illumination.
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a2f1f, 0.4);
  group.add(hemi);

  return group;
}
