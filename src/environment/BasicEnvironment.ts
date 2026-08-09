import * as THREE from 'three';
import { buildCityScape } from './CityScape';
import {
  createFloorPanelTexture,
  createNightSkyEquirect,
  createSmudgeRoughnessTexture,
} from './proceduralTextures';

// A glassy night high-rise interior: an open floor plate with floor-to-
// ceiling glazing, a real 3D city outside, a dark polished floor picking up
// reflections, and warm recessed lighting.
//
// The Jarvis holographic UI from the reference image is deliberately absent
// — that's an explicitly later-phase feature; this is the room only.

const ROOM_SIZE = 20;
const ROOM_HEIGHT = 6;

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

const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.35, metalness: 0.85 });

// Glazing: thin, weakly reflective, and mostly transparent. Physical glass
// with transmission would be more accurate but costs a scene render per
// frame — unusable here, where the scene already renders twice for stereo.
const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xaecbff,
  transparent: true,
  opacity: 0.08,
  roughness: 0.03,
  metalness: 0,
  reflectivity: 0.55,
  side: THREE.DoubleSide,
  depthWrite: false,
});

function makeGlazedWall(def: WallDef): THREE.Group {
  const group = new THREE.Group();
  const origin = new THREE.Vector3(...def.position);

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT), glassMaterial);
  glass.position.copy(origin);
  glass.rotation.y = def.rotationY;
  group.add(glass);

  // Vertical mullions dividing the glazing into bays.
  const bays = 7;
  const mullionGeometry = new THREE.BoxGeometry(0.07, ROOM_HEIGHT, 0.12);
  for (let i = 1; i < bays; i++) {
    const t = (i / bays - 0.5) * ROOM_SIZE;
    const mullion = new THREE.Mesh(mullionGeometry, frameMaterial);
    mullion.position.copy(origin).add(def.tangent.clone().multiplyScalar(t));
    mullion.rotation.y = def.rotationY;
    mullion.castShadow = true;
    group.add(mullion);
  }

  // Head and sill rails.
  const railGeometry = new THREE.BoxGeometry(ROOM_SIZE, 0.16, 0.16);
  for (const y of [0.08, ROOM_HEIGHT - 0.08]) {
    const rail = new THREE.Mesh(railGeometry, frameMaterial);
    rail.position.set(origin.x, y, origin.z);
    rail.rotation.y = def.rotationY;
    group.add(rail);
  }

  // A transom rail matching the reference image's banded glazing.
  const transom = new THREE.Mesh(new THREE.BoxGeometry(ROOM_SIZE, 0.08, 0.1), frameMaterial);
  transom.position.set(origin.x, ROOM_HEIGHT * 0.68, origin.z);
  transom.rotation.y = def.rotationY;
  group.add(transom);

  return group;
}

function makeArmchair(): THREE.Group {
  const chair = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.45, metalness: 0.15 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.3, metalness: 0.8 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.16, 0.62), leather);
  seat.position.y = 0.42;
  chair.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.58, 0.12), leather);
  back.position.set(0, 0.72, -0.25);
  back.rotation.x = -0.12;
  chair.add(back);

  const armGeometry = new THREE.BoxGeometry(0.09, 0.28, 0.56);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeometry, leather);
    arm.position.set(side * 0.32, 0.56, 0);
    chair.add(arm);
  }

  const legGeometry = new THREE.CylinderGeometry(0.022, 0.022, 0.4, 8);
  for (const [lx, lz] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]] as const) {
    const leg = new THREE.Mesh(legGeometry, metal);
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
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.05, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x14120f, roughness: 0.18, metalness: 0.5 }),
  );
  top.position.y = 0.42;
  table.add(top);

  const legGeometry = new THREE.CylinderGeometry(0.018, 0.018, 0.4, 8);
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.3, metalness: 0.8 });
  for (const [lx, lz] of [[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]] as const) {
    const leg = new THREE.Mesh(legGeometry, legMaterial);
    leg.position.set(lx, 0.21, lz);
    table.add(leg);
  }

  const books = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.07, 0.19),
    new THREE.MeshStandardMaterial({ color: 0x3d2020, roughness: 0.75 }),
  );
  books.position.set(-0.24, 0.48, 0.04);
  books.rotation.y = 0.2;
  table.add(books);

  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.043, 0.038, 0.095, 18),
    new THREE.MeshStandardMaterial({ color: 0xdad4c6, roughness: 0.35 }),
  );
  mug.position.set(0.26, 0.47, -0.06);
  table.add(mug);

  table.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return table;
}

function makePlanter(): THREE.Group {
  const plant = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.15, 0.42, 18),
    new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.5, metalness: 0.3 }),
  );
  pot.position.y = 0.21;
  plant.add(pot);

  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c5738,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 14; i++) {
    const length = 0.5 + Math.random() * 0.5;
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.09, length), leafMaterial);
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const lean = 0.25 + Math.random() * 0.5;
    blade.position.set(Math.cos(angle) * 0.06, 0.42 + length / 2 * 0.8, Math.sin(angle) * 0.06);
    blade.rotation.set(Math.cos(angle) * lean, angle, Math.sin(angle) * lean);
    plant.add(blade);
  }

  plant.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return plant;
}

function makeCeiling(group: THREE.Group, half: number): void {
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.95 }),
  );
  slab.rotation.x = Math.PI / 2;
  slab.position.y = ROOM_HEIGHT;
  slab.receiveShadow = true;
  group.add(slab);

  // Exposed structural beams, as in the reference image's dark ceiling.
  const beamMaterial = new THREE.MeshStandardMaterial({ color: 0x0e0f13, roughness: 0.8, metalness: 0.3 });
  const beamGeometry = new THREE.BoxGeometry(ROOM_SIZE, 0.28, 0.22);
  for (let i = -2; i <= 2; i++) {
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.set(0, ROOM_HEIGHT - 0.16, i * (ROOM_SIZE / 6));
    group.add(beam);
  }

  // Recessed linear light coves — the warm streaks running across the
  // ceiling in the reference.
  const coveMaterial = new THREE.MeshBasicMaterial({ color: 0xffc98a });
  for (const [x, z, length, rotY] of [
    [-half * 0.35, -half * 0.45, ROOM_SIZE * 0.55, Math.PI / 5],
    [half * 0.4, -half * 0.1, ROOM_SIZE * 0.42, -Math.PI / 7],
    [half * 0.1, half * 0.5, ROOM_SIZE * 0.5, Math.PI / 9],
  ] as const) {
    const cove = new THREE.Mesh(new THREE.BoxGeometry(length, 0.035, 0.07), coveMaterial);
    cove.position.set(x, ROOM_HEIGHT - 0.32, z);
    cove.rotation.y = rotY;
    group.add(cove);
  }
}

function makeDownlight(x: number, z: number, castsShadow: boolean): THREE.Group {
  const group = new THREE.Group();

  const fixture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd9a8 }),
  );
  fixture.position.set(x, ROOM_HEIGHT - 0.04, z);
  group.add(fixture);

  const light = new THREE.PointLight(0xffb877, 6, 14, 2);
  light.position.set(x, ROOM_HEIGHT - 0.25, z);
  if (castsShadow) {
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.bias = -0.004;
    light.shadow.camera.far = 16;
  }
  group.add(light);

  return group;
}

export function buildEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  const half = ROOM_SIZE / 2;

  // Sky doubles as the reflection environment. Reflections are what make
  // glass and polished stone read as real materials rather than flat color.
  const sky = createNightSkyEquirect();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envTarget = pmrem.fromEquirectangular(sky);
  scene.environment = envTarget.texture;
  scene.background = sky;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  // Haze thins the distant skyline, which is most of what sells scale.
  scene.fog = new THREE.FogExp2(0x0a1018, 0.0026);

  const group = new THREE.Group();

  const floorTexture = createFloorPanelTexture();
  floorTexture.repeat.set(ROOM_SIZE / 2.5, ROOM_SIZE / 2.5);
  const floorRoughness = createSmudgeRoughnessTexture();
  floorRoughness.repeat.set(4, 4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughnessMap: floorRoughness,
      roughness: 0.34,
      metalness: 0.9,
      envMapIntensity: 1.1,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  makeCeiling(group, half);

  for (const wall of buildWallDefs(half)) {
    group.add(makeGlazedWall(wall));
  }

  const spacing = half * 0.5;
  let shadowCaster = true;
  for (const gx of [-spacing, 0, spacing]) {
    for (const gz of [-spacing, 0, spacing]) {
      // Only the first light casts shadows; nine shadow-casting point
      // lights would each add a cubemap render pass, per eye, per frame.
      group.add(makeDownlight(gx, gz, shadowCaster));
      shadowCaster = false;
    }
  }

  const chairA = makeArmchair();
  chairA.position.set(2.4, 0, 2.8);
  chairA.rotation.y = Math.PI * 0.86;
  group.add(chairA);

  const chairB = makeArmchair();
  chairB.position.set(1.0, 0, 3.7);
  chairB.rotation.y = Math.PI * 1.16;
  group.add(chairB);

  const table = makeLowTable();
  table.position.set(1.8, 0, 3.1);
  table.rotation.y = Math.PI * 0.92;
  group.add(table);

  for (const [px, pz] of [[-3.4, -3.6], [3.8, -4.2], [-4.2, 3.4]] as const) {
    const planter = makePlanter();
    planter.position.set(px, 0, pz);
    planter.rotation.y = Math.random() * Math.PI;
    group.add(planter);
  }

  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 40),
    new THREE.MeshStandardMaterial({ color: 0x121215, roughness: 0.95, metalness: 0 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(1.8, 0.004, 3.1);
  rug.receiveShadow = true;
  group.add(rug);

  // Cool moonlight from outside balances the warm interior downlights —
  // that warm/cool split is a large part of the reference image's look.
  const moonlight = new THREE.DirectionalLight(0x9ec0ff, 0.35);
  moonlight.position.set(-half * 1.5, ROOM_HEIGHT * 2, -half * 1.2);
  group.add(moonlight);

  const ambient = new THREE.HemisphereLight(0x35507a, 0x08090c, 0.25);
  group.add(ambient);

  scene.add(group);
  scene.add(buildCityScape());
}
