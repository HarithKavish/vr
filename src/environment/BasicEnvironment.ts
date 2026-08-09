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
// Standard rather than Physical. Physical is the heaviest shader three.js
// ships — it carries the clearcoat, sheen, iridescence and transmission
// paths whether or not they are used — and this glazing used none of them,
// only `reflectivity`, which Standard reproduces through envMapIntensity.
// It covers all four walls and is transparent, so it is also the scene's
// largest source of overdraw, making it the worst place to pay for it.
const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0xaecbff,
  transparent: true,
  opacity: 0.08,
  // Physical's reflectivity 0.55 works out to F0 ~0.044, which is within a
  // rounding error of Standard's fixed 0.04 at metalness 0 — so these
  // values reproduce the old Fresnel response rather than approximating it.
  roughness: 0.03,
  metalness: 0,
  envMapIntensity: 1,
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

  // Mullions are built separately, as one instanced mesh across all four
  // walls — see buildMullions.

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

// Every mullion is the same box in the same material, differing only by
// position and wall rotation, so all 24 collapse into one instanced draw
// without touching their geometry or appearance.
const MULLION_BAYS = 7;

function buildMullions(walls: WallDef[]): THREE.InstancedMesh {
  const perWall = MULLION_BAYS - 1;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.07, ROOM_HEIGHT, 0.12),
    frameMaterial,
    walls.length * perWall,
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3(1, 1, 1);

  let index = 0;
  for (const def of walls) {
    const origin = new THREE.Vector3(...def.position);
    euler.set(0, def.rotationY, 0);
    quaternion.setFromEuler(euler);
    for (let i = 1; i < MULLION_BAYS; i++) {
      const t = (i / MULLION_BAYS - 0.5) * ROOM_SIZE;
      position.copy(origin).addScaledVector(def.tangent, t);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index++, matrix);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  return mesh;
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

const BLADES_PER_PLANTER = 14;

// Blades previously carried their length in their geometry, so every one
// was a separate PlaneGeometry and could not be instanced. A unit-height
// plane with the length moved into the instance scale is exactly
// equivalent — PlaneGeometry(w, h) places its vertices at +/-h/2, so
// scaling PlaneGeometry(w, 1) by h lands on the identical positions, and
// UVs and normals are unaffected.
const bladeGeometry = new THREE.PlaneGeometry(0.09, 1);
const bladeMaterial = new THREE.MeshStandardMaterial({
  color: 0x2c5738,
  roughness: 0.7,
  side: THREE.DoubleSide,
});

function makePlanterPot(): THREE.Mesh {
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.15, 0.42, 18),
    new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.5, metalness: 0.3 }),
  );
  pot.position.y = 0.21;
  pot.castShadow = true;
  pot.receiveShadow = true;
  return pot;
}

// One instanced draw for every blade of every planter. Each planter's own
// placement is folded into the instance matrices, so the blades keep the
// exact transforms they had as children of a planter group.
function buildPlanterBlades(planters: THREE.Object3D[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    bladeGeometry,
    bladeMaterial,
    planters.length * BLADES_PER_PLANTER,
  );

  const matrix = new THREE.Matrix4();
  const planterMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();

  let index = 0;
  for (const planter of planters) {
    planter.updateMatrix();
    planterMatrix.copy(planter.matrix);

    for (let i = 0; i < BLADES_PER_PLANTER; i++) {
      const length = 0.5 + Math.random() * 0.5;
      const angle = (i / BLADES_PER_PLANTER) * Math.PI * 2 + Math.random() * 0.3;
      const lean = 0.25 + Math.random() * 0.5;

      position.set(Math.cos(angle) * 0.06, 0.42 + (length / 2) * 0.8, Math.sin(angle) * 0.06);
      euler.set(Math.cos(angle) * lean, angle, Math.sin(angle) * lean);
      quaternion.setFromEuler(euler);
      scale.set(1, length, 1);

      matrix.compose(position, quaternion, scale);
      matrix.premultiply(planterMatrix);
      mesh.setMatrixAt(index++, matrix);
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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

  // three.js r155+ uses physically-correct units by default: PointLight
  // intensity is candela with inverse-square falloff, so the old value of 6
  // delivered almost nothing at 4m and left the room black.
  const light = new THREE.PointLight(0xffb877, 220, 26, 2);
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
  scene.environmentIntensity = 1.1;
  pmrem.dispose();

  // Haze thins the distant skyline, which is most of what sells scale.
  scene.fog = new THREE.FogExp2(0x101a30, 0.0018);

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
      // A near-fully-metallic floor has almost no diffuse response, so
      // against a dark night sky it reads as a black mirror. Keep it
      // polished but let it actually catch the ceiling lights.
      roughness: 0.28,
      metalness: 0.35,
      envMapIntensity: 1.1,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  makeCeiling(group, half);

  const wallDefs = buildWallDefs(half);
  for (const wall of wallDefs) {
    group.add(makeGlazedWall(wall));
  }
  group.add(buildMullions(wallDefs));

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

  const planters: THREE.Object3D[] = [];
  for (const [px, pz] of [[-3.4, -3.6], [3.8, -4.2], [-4.2, 3.4]] as const) {
    const planter = new THREE.Group();
    planter.position.set(px, 0, pz);
    planter.rotation.y = Math.random() * Math.PI;
    planter.add(makePlanterPot());
    group.add(planter);
    planters.push(planter);
  }
  // Blades live at the room level rather than under each planter, since one
  // instanced mesh now covers all of them.
  group.add(buildPlanterBlades(planters));

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
  const moonlight = new THREE.DirectionalLight(0x9ec0ff, 1.4);
  moonlight.position.set(-half * 1.5, ROOM_HEIGHT * 2, -half * 1.2);
  group.add(moonlight);

  const ambient = new THREE.HemisphereLight(0x35507a, 0x08090c, 0.9);
  group.add(ambient);

  scene.add(group);
  scene.add(buildCityScape());
}
