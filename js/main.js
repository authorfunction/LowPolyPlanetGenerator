import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import {
  PARAMS,
  DEFAULT_PARAMS,
  BIOMES,
  HORIZON_UNIFORMS,
  WATER_UNIFORMS,
  CLOUD_UNIFORMS, // <--- Add this import
  PRESET_KEY,
} from "./config.js";
import { SimplexNoise, createPRNG } from "./utils.js";
import { ui, displays, showModal } from "./ui.js";
import {
  setupHorizonShader,
  setupWaterShader,
  SUN_VERTEX,
  SUN_FRAGMENT,
  ATMO_VERTEX,
  ATMO_FRAGMENT,
  CLOUD_VERTEX,
  CLOUD_FRAGMENT,
  LAVA_VERTEX,
  LAVA_FRAGMENT,
  RAIN_VERTEX,
  RAIN_FRAGMENT,
} from "./shaders.js";

// --- STATE MANAGEMENT ---
let savedPresets = {};
let currentBiome = BIOMES.terra;
let currentSimplex = null;

// --- THREE.JS GLOBALS ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);
scene.fog = new THREE.FogExp2(0x050505, 0.02);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
//camera.position.z = 16;
//camera.position.y = 4;
// Hardcoded Camera Start
// X=-5 (Left), Y=9 (High up), Z=15 (Back)
camera.position.set(-5, -1, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("canvas-container").appendChild(renderer.domElement);

const controls = new TrackballControls(camera, renderer.domElement);
controls.rotateSpeed = 2.0;
controls.zoomSpeed = 1.2;
controls.panSpeed = 0.8;
controls.noZoom = false;
controls.noPan = false;
controls.staticMoving = false;
controls.dynamicDampingFactor = 0.1;
controls.minDistance = 8;
controls.maxDistance = 30;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(ambientLight);

// --- SCENE OBJECTS ---
const sunOrbit = new THREE.Group();
scene.add(sunOrbit);
// Rotate sun to be behind-right of the planet
sunOrbit.rotation.y = 6.8;

const sunGeo = new THREE.IcosahedronGeometry(1.5, 4);

const sunMat = new THREE.ShaderMaterial({
  uniforms: {
    uColor: { value: new THREE.Color(0xffdd00) },
    uTint: { value: new THREE.Color(0xff4400) },
    uMixAmount: { value: 0.0 },
    uBrightness: { value: 3.0 },
    uTime: { value: 0.0 },
    uSunSide: { value: 0.0 },
    uSunsetFactor: { value: 0.0 },
    uVertexDistortion: { value: 0.0 },
    uSolarEnabled: { value: 1.0 },
  },
  vertexShader: SUN_VERTEX,
  fragmentShader: SUN_FRAGMENT,
  side: THREE.FrontSide,
});

const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.position.set(25, 5, 0);
sunOrbit.add(sunMesh);

// Sun Halo Spheres
const sunHaloGeo = new THREE.IcosahedronGeometry(1.5, 1);
for (let i = 0; i < 3; i++) {
  const s = 1.2 + i * 0.3;
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffdd00,
    transparent: true,
    opacity: 0.15 / (i + 1),
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(sunHaloGeo, mat);
  mesh.scale.set(s, s, s);
  sunMesh.add(mesh);
}

const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
const d = 10;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunMesh.add(sunLight);

const rimLight = new THREE.DirectionalLight(0x4455ff, 0.5);
rimLight.position.set(-10, 5, -10);
scene.add(rimLight);

let starsGroup = new THREE.Group();
scene.add(starsGroup);

const planetGroup = new THREE.Group();
scene.add(planetGroup);

let planetMesh, waterMesh, atmoGroup, cloudsMesh, vegGroup;
let atmoMaterials = [];

// --- CHARACTERS VARIABLES ---
let sam, algen;
const raycaster = new THREE.Raycaster();
const dummyObj = new THREE.Object3D();
const targetPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const charPos = new THREE.Vector3();

let samState = {
  phi: 1.5,
  theta: 0,
  targetPhi: 1.5,
  targetTheta: 0,
  speed: 0.4,
  idleTime: 0,
  wanderAngle: 0,
  stuckTimer: 0,
  lastPos: new THREE.Vector3(),
};

let algenState = {
  phi: 1.5,
  theta: 0.5,
  speed: 0.35,
  moving: false,
  hesitationTimer: 0,
};

// VOLCANO VARIABLES
let lavaMesh, eruptionGroup;
let eruptionTime = 0;
let isErupting = false;
let rocks = []; // Array to store particle data

// --- GENERATION LOGIC ---

function generateStars() {
  while (starsGroup.children.length > 0) {
    const c = starsGroup.children[0];
    c.geometry.dispose();
    c.material.dispose();
    starsGroup.remove(c);
  }

  const baseCount = 1000;
  const totalStars = Math.floor(baseCount * PARAMS.starDensity);

  const createBatch = (count, size, opacity) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 300;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: size,
      transparent: true,
      opacity: opacity,
    });
    starsGroup.add(new THREE.Points(geo, mat));
  };

  createBatch(Math.floor(totalStars * 0.7), 0.1, 0.7);
  createBatch(Math.floor(totalStars * 0.2), 0.15, 0.85);
  createBatch(Math.floor(totalStars * 0.1), 0.25, 1.0);
}

function findRandomSpot() {
  return {
    phi: Math.acos(2 * Math.random() - 1),
    theta: Math.random() * Math.PI * 2,
  };
}

function createCharacters() {
  if (sam) planetGroup.remove(sam);
  if (algen) planetGroup.remove(algen);

  const boatMat = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    flatShading: true,
    roughness: 1.0,
  });
  const ratMat = new THREE.MeshStandardMaterial({
    color: 0x555555,
    flatShading: true,
    roughness: 0.9,
  });
  const pinkMat = new THREE.MeshStandardMaterial({
    color: 0xffaaaa,
    flatShading: true,
  });

  setupHorizonShader(boatMat);
  setupHorizonShader(ratMat);
  setupHorizonShader(pinkMat);

  // 1. Create Sam (Rat)
  sam = new THREE.Group();
  const samMesh = new THREE.Group();
  sam.add(samMesh);

  const rBody = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 6), ratMat);
  rBody.rotation.x = Math.PI / 2;
  rBody.position.z = 0.05;
  samMesh.add(rBody);

  const rEar1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.04), pinkMat);
  rEar1.position.set(0.06, 0.05, -0.05);
  samMesh.add(rEar1);
  const rEar2 = rEar1.clone();
  rEar2.position.set(-0.06, 0.05, -0.05);
  samMesh.add(rEar2);

  const rTail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.02, 0.3, 4),
    pinkMat,
  );
  rTail.rotation.x = Math.PI / 2;
  rTail.position.z = -0.2;
  samMesh.add(rTail);

  const sBoat = new THREE.Group();
  const sbGeo = new THREE.BoxGeometry(0.3, 0.1, 0.5);
  const sbMesh = new THREE.Mesh(sbGeo, boatMat);
  sbMesh.position.y = 0.05;
  sBoat.add(sbMesh);
  sBoat.visible = false;
  sam.add(sBoat);

  sam.userData = {
    mesh: samMesh,
    boat: sBoat,
    yOffsetLand: 0,
    yOffsetWater: 0.1,
  };

  // 2. Create Älgen (Elk)
  algen = new THREE.Group();
  const elkMesh = new THREE.Group();
  elkMesh.rotation.y = Math.PI;
  algen.add(elkMesh);

  const elkMat = new THREE.MeshStandardMaterial({
    color: 0x8b5a2b,
    flatShading: true,
    roughness: 1.0,
  });
  const antlerMat = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    flatShading: true,
  });

  setupHorizonShader(elkMat);
  setupHorizonShader(antlerMat);

  const eBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.6), elkMat);
  eBody.position.y = 0.35;
  elkMesh.add(eBody);

  const eNeck = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.2), elkMat);
  eNeck.position.set(0, 0.55, -0.25);
  eNeck.rotation.x = -Math.PI / 8;
  elkMesh.add(eNeck);

  const eHead = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.3), elkMat);
  eHead.position.set(0, 0.7, -0.4);
  elkMesh.add(eHead);

  const legGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);
  const l1 = new THREE.Mesh(legGeo, elkMat);
  l1.position.set(0.1, 0.2, 0.2);
  elkMesh.add(l1);
  const l2 = new THREE.Mesh(legGeo, elkMat);
  l2.position.set(-0.1, 0.2, 0.2);
  elkMesh.add(l2);
  const l3 = new THREE.Mesh(legGeo, elkMat);
  l3.position.set(0.1, 0.2, -0.2);
  elkMesh.add(l3);
  const l4 = new THREE.Mesh(legGeo, elkMat);
  l4.position.set(-0.1, 0.2, -0.2);
  elkMesh.add(l4);

  const antlerGeo = new THREE.BoxGeometry(0.4, 0.05, 0.05);
  const a1 = new THREE.Mesh(antlerGeo, antlerMat);
  a1.position.set(0, 0.8, -0.35);
  elkMesh.add(a1);
  const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), antlerMat);
  a2.position.set(0.2, 0.9, -0.35);
  elkMesh.add(a2);
  const a3 = a2.clone();
  a3.position.set(-0.2, 0.9, -0.35);
  elkMesh.add(a3);

  const eBoat = new THREE.Group();
  const ebGeo = new THREE.BoxGeometry(0.6, 0.1, 1.0);
  const ebMesh = new THREE.Mesh(ebGeo, boatMat);
  ebMesh.position.y = 0.05;
  eBoat.add(ebMesh);
  eBoat.visible = false;
  algen.add(eBoat);

  algen.userData = {
    mesh: elkMesh,
    boat: eBoat,
    yOffsetLand: 0,
    yOffsetWater: 0.1,
  };

  planetGroup.add(sam);
  planetGroup.add(algen);

  const spawn = findRandomSpot();
  samState.phi = spawn.phi;
  samState.theta = spawn.theta;
  samState.targetPhi = spawn.phi;
  samState.targetTheta = spawn.theta;
  algenState.phi = spawn.phi + 0.05;
  algenState.theta = spawn.theta + 0.05;

  sam.position.setFromSphericalCoords(4, samState.phi, samState.theta);
  algen.position.setFromSphericalCoords(4, algenState.phi, algenState.theta);

  snapCharacter(sam, samState, samState.targetPhi, samState.targetTheta);
  snapCharacter(algen, algenState, samState.phi, samState.theta);
}

function generateVegetation(planetBaseRadius, simplex, prng) {
  if (vegGroup) {
    planetGroup.remove(vegGroup);
    vegGroup.children.forEach((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    vegGroup = null;
  }

  if (PARAMS.vegetationDensity <= 0) return;

  vegGroup = new THREE.Group();
  let trunkGeo, foliageGeo;

  if (currentBiome === BIOMES.desert) {
    trunkGeo = new THREE.CapsuleGeometry(0.12, 1.0, 1, 7);
    trunkGeo.translate(0, 0.5, 0);
    foliageGeo = new THREE.CapsuleGeometry(0.08, 0.3, 1, 7);
    foliageGeo.translate(0, 0.15, 0);
    foliageGeo.rotateZ(Math.PI / 4);
    foliageGeo.translate(0.15, 0.6, 0);
  } else {
    trunkGeo = new THREE.CylinderGeometry(0.05, 0.1, 0.3, 5);
    trunkGeo.translate(0, 0.15, 0);
    const coneRadius = 0.25;
    const coneHeight = 0.6;
    foliageGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 5);
    const yOffset = 0.2 + coneHeight / 2;
    foliageGeo.translate(0, yOffset, 0);
  }

  const rockGeo = new THREE.DodecahedronGeometry(0.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: currentBiome.trunkColor,
    flatShading: true,
    roughness: 1.0,
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: currentBiome.treeColor,
    flatShading: true,
    roughness: 0.8,
  });
  const rockMat = new THREE.MeshStandardMaterial({
    color: currentBiome.rockColor,
    flatShading: true,
    roughness: 0.9,
  });

  setupHorizonShader(trunkMat);
  setupHorizonShader(foliageMat);
  setupHorizonShader(rockMat);

  const count = PARAMS.vegetationDensity * 4;
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const foliageMesh = new THREE.InstancedMesh(foliageGeo, foliageMat, count);
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, count);

  trunkMesh.receiveShadow = true;
  trunkMesh.castShadow = true;
  foliageMesh.receiveShadow = true;
  foliageMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  rockMesh.castShadow = true;

  const dummy = new THREE.Object3D();
  const _position = new THREE.Vector3();
  const _normal = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  let tIdx = 0;
  let rIdx = 0;

  for (let i = 0; i < count; i++) {
    const u = prng();
    const v = prng();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    _position.setFromSphericalCoords(4, phi, theta);
    const x = _position.x;
    const y = _position.y;
    const z = _position.z;

    const n1 = simplex.noise(
      x * PARAMS.scale * 0.1,
      y * PARAMS.scale * 0.1,
      z * PARAMS.scale * 0.1,
    );
    const n2 =
      simplex.noise(
        x * PARAMS.scale * 0.3,
        y * PARAMS.scale * 0.3,
        z * PARAMS.scale * 0.3,
      ) * 0.5;
    const n3 =
      simplex.noise(
        x * PARAMS.scale * 1.0,
        y * PARAMS.scale * 1.0,
        z * PARAMS.scale * 1.0,
      ) * 0.2;
    let noiseVal = Math.max(-0.5, n1 + n2 + n3);
    const displacement = 1 + noiseVal * PARAMS.height * 0.2;
    _position.multiplyScalar(displacement);

    const surfaceRadius = _position.length();
    const h = (surfaceRadius - 4.0) / (PARAMS.height * 0.8);

    let isTree = false;
    let isRock = false;
    if (h < PARAMS.waterLevel + 0.05) continue;

    if (
      currentBiome === BIOMES.terra ||
      currentBiome === BIOMES.ice ||
      currentBiome === BIOMES.alien
    ) {
      if (h > 0.2 && h < 0.7) isTree = true;
      else if (h >= 0.7) isRock = true;
    } else if (currentBiome === BIOMES.desert) {
      if (prng() > 0.8) isTree = true;
      else if (prng() > 0.5) isRock = true;
    } else if (
      currentBiome === BIOMES.molten ||
      currentBiome === BIOMES.barren
    ) {
      if (prng() > 0.6) isRock = true;
    }

    if (isTree && tIdx < count) {
      dummy.position.copy(_position);
      dummy.lookAt(0, 0, 0);
      _normal.copy(_position).normalize();
      dummy.quaternion.setFromUnitVectors(_up, _normal);
      dummy.rotateY(prng() * Math.PI * 2);
      const s = 0.7 + prng() * 0.6;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(tIdx, dummy.matrix);
      foliageMesh.setMatrixAt(tIdx, dummy.matrix);
      tIdx++;
    }
    if (isRock && rIdx < count) {
      dummy.position.copy(_position);
      _normal.copy(_position).normalize();
      dummy.quaternion.setFromUnitVectors(_up, _normal);
      dummy.rotateY(prng() * Math.PI);
      dummy.rotateX(prng() * Math.PI * 0.2);
      const s = 0.3 + prng() * 0.5;
      dummy.scale.set(s, s * 0.7, s);
      dummy.updateMatrix();
      rockMesh.setMatrixAt(rIdx, dummy.matrix);
      rIdx++;
    }
  }
  trunkMesh.count = tIdx;
  foliageMesh.count = tIdx;
  rockMesh.count = rIdx;
  vegGroup.add(trunkMesh);
  vegGroup.add(foliageMesh);
  vegGroup.add(rockMesh);
  planetGroup.add(vegGroup);
}

function generatePlanet() {
  HORIZON_UNIFORMS.uHorizonColor.value.setHex(currentBiome.atmosphereColor);
  const prng = createPRNG(PARAMS.seed);
  const simplex = new SimplexNoise(prng);
  currentSimplex = simplex;

  if (planetMesh) {
    planetMesh.geometry.dispose();
    planetGroup.remove(planetMesh);
  }

  const geometry = new THREE.IcosahedronGeometry(4, PARAMS.detail);
  const posAttribute = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < posAttribute.count; i++) {
    vertex.fromBufferAttribute(posAttribute, i);

    // 1. Calculate Distance from North Pole (0, 4, 0)
    // We assume planet radius is 4.0
    const northPole = new THREE.Vector3(0, 4, 0);
    const distToPole = vertex.distanceTo(northPole);

    // 2. Standard Noise (Existing Code)
    const n1 = simplex.noise(
      vertex.x * PARAMS.scale * 0.1,
      vertex.y * PARAMS.scale * 0.1,
      vertex.z * PARAMS.scale * 0.1,
    );
    const n2 =
      simplex.noise(
        vertex.x * PARAMS.scale * 0.3,
        vertex.y * PARAMS.scale * 0.3,
        vertex.z * PARAMS.scale * 0.3,
      ) * 0.5;
    const n3 =
      simplex.noise(
        vertex.x * PARAMS.scale * 1.0,
        vertex.y * PARAMS.scale * 1.0,
        vertex.z * PARAMS.scale * 1.0,
      ) * 0.2;
    let noiseVal = Math.max(-0.5, n1 + n2 + n3);

    // 3. APPLY VOLCANO MODIFIER
    // If we are close to the pole, override noise to make a mountain
    let volcanoHeight = 0.0;
    const volcanoRadius = 2.5;

    if (distToPole < volcanoRadius) {
      // A. Raise the mountain (Bell Curve)
      let rise =
        Math.exp(-distToPole * distToPole) * PARAMS.volcanoHeight * 3.0;

      // B. Dig the crater (Inverted Bell Curve at center)
      if (distToPole < 0.6) {
        rise -= Math.exp(-distToPole * 4.0) * PARAMS.volcanoHeight * 3.5;
      }

      volcanoHeight = rise;
      // Flatten noise on the volcano cone so it looks smooth/clean
      // Note: Three.js puts the value FIRST, then min, then max (different order than GLSL!)
      noiseVal *= THREE.MathUtils.smoothstep(distToPole, 0.5, 2.0);
    }

    // Combine
    const displacement =
      1 + noiseVal * PARAMS.height * 0.2 + volcanoHeight * 0.2;

    vertex.multiplyScalar(displacement);
    posAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  //const nonIndexedGeo = geometry.toNonIndexed();
  // Fix: Only convert if it actually has an index
  const nonIndexedGeo = geometry.index ? geometry.toNonIndexed() : geometry;
  nonIndexedGeo.computeVertexNormals();

  const count = nonIndexedGeo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const posAttr = nonIndexedGeo.attributes.position;
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // vertex.fromBufferAttribute(posAttr, i);
    // const dist = vertex.length();
    // let h = (dist - 4.0) / (PARAMS.height * 0.8);
    // let colorHex = currentBiome.colors[0].c;
    // for (let c of currentBiome.colors) {
    //   if (h >= c.h - PARAMS.waterLevel) colorHex = c.c;
    // }
    vertex.fromBufferAttribute(posAttr, i);
    const dist = vertex.length();

    // Check distance to North Pole for coloring
    const poleDist = vertex.distanceTo(new THREE.Vector3(0, 4, 0)); // Approx

    let h = (dist - 4.0) / (PARAMS.height * 0.8);
    let colorHex = currentBiome.colors[0].c;

    // Standard Biome Logic
    for (let c of currentBiome.colors) {
      if (h >= c.h - PARAMS.waterLevel) colorHex = c.c;
    }

    // OVERRIDE: VOLCANO BIOME
    // If close to pole, make it dark rock (Volcano Cone)
    if (poleDist < 1.5 && h > PARAMS.waterLevel) {
      colorHex = 0x221111; // Dark burnt rock
    }
    //  If extremely close (Crater Rim), make it reddish
    if (poleDist < 0.6) {
      colorHex = 0x551100;
    }

    color.setHex(colorHex);

    const variation = (Math.random() - 0.5) * 0.05;
    color.r += variation;
    color.g += variation;
    color.b += variation;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  nonIndexedGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.8,
    metalness: 0.1,
  });
  setupHorizonShader(material);

  planetMesh = new THREE.Mesh(nonIndexedGeo, material);
  planetMesh.castShadow = true;
  planetMesh.receiveShadow = true;
  planetGroup.add(planetMesh);

  if (waterMesh) {
    waterMesh.geometry.dispose();
    planetGroup.remove(waterMesh);
  }
  if (PARAMS.waterLevel > 0.05) {
    const waterGeo = new THREE.IcosahedronGeometry(
      4 + PARAMS.waterLevel * PARAMS.height * 0.5,
      Math.min(PARAMS.detail, 3),
    );
    const waterMat = new THREE.MeshStandardMaterial({
      color: currentBiome.waterColor,
      transparent: true,
      opacity: 0.7,
      flatShading: true,
      roughness: 0.1,
      metalness: 0.5,
    });
    setupWaterShader(waterMat);
    waterMesh = new THREE.Mesh(waterGeo, waterMat);
    planetGroup.add(waterMesh);
  }

  if (atmoGroup) {
    atmoGroup.children.forEach((c) => {
      c.geometry.dispose();
      c.material.dispose();
    });
    planetGroup.remove(atmoGroup);
    atmoGroup = null;
  }
  atmoMaterials = [];

  if (PARAMS.atmosphereOpacity > 0) {
    atmoGroup = new THREE.Group();
    const steps = PARAMS.atmoCount;
    const sunsetColor = new THREE.Color(0xff6600);
    const sunriseColor = new THREE.Color(0x88aaff);
    const dayColor = new THREE.Color(currentBiome.atmosphereColor);

    for (let i = 0; i < steps; i++) {
      const s = PARAMS.atmoScale + i * 0.12;
      const geo = new THREE.IcosahedronGeometry(4.2, 2);
      const op = (PARAMS.atmosphereOpacity * 0.5) / (i + 1);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          sunPosition: { value: new THREE.Vector3(1, 0, 0) },
          dayColor: { value: dayColor },
          sunsetColor: { value: sunsetColor },
          sunriseColor: { value: sunriseColor },
          uOpacity: { value: op },
          uHaloStrength: { value: PARAMS.haloStrength },
          uSunsetOffset: { value: PARAMS.sunsetOffset },
          uSunsetWidth: { value: PARAMS.sunsetWidth },
          uSunsetFactor: { value: 0.0 },
          uHazeSpread: { value: PARAMS.hazeSpread },
          uHazeIntensity: {
            value: PARAMS.hazeEnabled ? PARAMS.hazeIntensity : 0.0,
          },
          uHazeFalloff: { value: PARAMS.hazeFalloff },
          uSunSide: { value: 0.0 },
          uTime: { value: 0.0 },
          uAtmoDistortion: { value: PARAMS.atmoDistortion },
          uVibrance: { value: PARAMS.colorVibrance },
          uSolarEnabled: { value: PARAMS.solarEnabled ? 1.0 : 0.0 },
        },
        vertexShader: ATMO_VERTEX,
        fragmentShader: ATMO_FRAGMENT,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      });
      atmoMaterials.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(s, s, s);
      atmoGroup.add(mesh);
    }
    planetGroup.add(atmoGroup);
  }

  // ... inside generatePlanet() ...

  if (cloudsMesh) {
    planetGroup.remove(cloudsMesh);
    cloudsMesh = null;
  }

  cloudsMesh = new THREE.Group();

  // 1. New Cloud Shader Material
  // We use the same 'sunWorldPos' logic we use for atmosphere to light the clouds
  const cloudShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(0xffffff) }, // Pure white center
      uRimColor: { value: new THREE.Color(0xddeeff) }, // Blueish-white edges
      uOpacity: { value: 0.9 },
      sunPosition: { value: new THREE.Vector3(10, 5, 0) }, // Will update in animate
      uTime: { value: 0.0 },
      // NEW LIGHTING UNIFORMS
      uSunColor: { value: new THREE.Color(0xffffff) },
      uAmbientColor: { value: new THREE.Color(0x334455) },
      // --- ADD THESE 3 LINES ---
      // We link directly to the global objects so they auto-update!
      uHorizonColor: HORIZON_UNIFORMS.uHorizonColor,
      uHorizonStrength: HORIZON_UNIFORMS.uHorizonStrength,
      uHorizonPower: HORIZON_UNIFORMS.uHorizonPower,
      uCloudHazeMultiplier: CLOUD_UNIFORMS.uCloudHazeMultiplier,
      uCloudLightWrap: CLOUD_UNIFORMS.uCloudLightWrap,
      uPlanetScale: { value: PARAMS.scale },
      uPlanetHeight: { value: PARAMS.height },
      uCloudRotation: { value: 0.0 },
      uCloudShrinkAmount: { value: PARAMS.cloudShrinkAmount },
      uCloudTransition: { value: PARAMS.cloudTransition },
      uRainDarkness: { value: PARAMS.rainDarkness },
    },
    vertexShader: CLOUD_VERTEX,
    fragmentShader: CLOUD_FRAGMENT,
    transparent: true,
    // side: THREE.DoubleSide // Optional: makes them look thicker but might cause artifacts
  });



  const minCloudHeight = 4.0 * (1 + PARAMS.height * 0.2) + 0.2;
  const cloudBaseRadius = minCloudHeight + PARAMS.cloudAltitude * 1.5;
  const cloudCount = Math.floor(PARAMS.cloudCoverage);

  // --- CLOUD GENERATION (INSTANCED) ---
  // 1. Calculate Total Count
  // We estimate average puffs per cloud to pre-allocate
  const puffsPerCloud = 5; // Average puffs (1 main + ~4 children)
  const totalInstances = cloudCount * puffsPerCloud;

  // 2. Create InstancedMesh
  const puffGeo = new THREE.DodecahedronGeometry(1, 0);
  const instancedCloudMesh = new THREE.InstancedMesh(
    puffGeo,
    cloudShaderMat,
    totalInstances,
  );
  instancedCloudMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  instancedCloudMesh.frustumCulled = false; // Prevent culling issues since we don't compute bounding sphere

  // --- RAIN INITIALIZATION ---
  const dropsPerCloud = 8;
  const totalRainInstances = cloudCount * dropsPerCloud;

  // Use PlaneGeometry for Billboarding
  const rainGeo = new THREE.PlaneGeometry(0.05, 0.5);
  // No rotation needed here, we will handle orientation in shader or via lookAt
  // Actually, PlaneGeometry faces +Z by default.

  const rainShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uPlanetScale: { value: PARAMS.scale },
      uPlanetHeight: { value: PARAMS.height },
      uCloudRotation: { value: 0.0 },
      uCloudTransition: { value: PARAMS.cloudTransition }
    },
    vertexShader: RAIN_VERTEX,
    fragmentShader: RAIN_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide // <--- ADDED to prevent culling
  });

  const instancedRainMesh = new THREE.InstancedMesh(rainGeo, rainShaderMat, totalRainInstances);
  instancedRainMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  instancedRainMesh.frustumCulled = false;

  const rainRandoms = new Float32Array(totalRainInstances);
  const rainSpeeds = new Float32Array(totalRainInstances);
  const rainCloudCenters = new Float32Array(totalRainInstances * 3); // <--- ADDED
  let rainIdx = 0;

  // 3. Setup Attributes
  const dummy = new THREE.Object3D();
  const randoms = new Float32Array(totalInstances);
  const cloudCenters = new Float32Array(totalInstances * 3); // <--- ADDED
  let instanceIdx = 0;

  for (let i = 0; i < cloudCount; i++) {
    // Cloud Center Position
    const phi = Math.acos(-1 + (2 * i) / cloudCount);
    const theta = Math.sqrt(cloudCount * Math.PI) * phi;
    const phiR = phi + (Math.random() - 0.5) * 0.5;
    const thetaR = theta + (Math.random() - 0.5) * 0.5;

    // Base Rotation for the whole cloud cluster
    const cloudRotationZ = Math.random() * Math.PI * 2;

    // --- A. Main Puff ---
    if (instanceIdx >= totalInstances) break;

    const mainPos = new THREE.Vector3().setFromSphericalCoords(
      cloudBaseRadius,
      phiR,
      thetaR,
    );

    dummy.position.copy(mainPos);
    dummy.lookAt(0, 0, 0); // Z points to center
    // Rotate to align with surface tangent
    dummy.rotateZ(cloudRotationZ);

    // Scale: Flatten radially (Z in local space after lookAt)
    const globalScale = PARAMS.cloudSize * (0.8 + Math.random() * 0.4);
    dummy.scale.set(globalScale, globalScale, globalScale * 0.6);

    dummy.updateMatrix();
    instancedCloudMesh.setMatrixAt(instanceIdx, dummy.matrix);
    randoms[instanceIdx] = Math.random();

    // Store Center
    cloudCenters[instanceIdx * 3] = mainPos.x;
    cloudCenters[instanceIdx * 3 + 1] = mainPos.y;
    cloudCenters[instanceIdx * 3 + 2] = mainPos.z;

    instanceIdx++;

    // --- B. Child Puffs ---
    const numChildren = 3 + Math.floor(Math.random() * 3);

    // We need a local coordinate system for children relative to the main puff
    // Construct a basis from the main puff's position (Normal)
    const normal = mainPos.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    let tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
    if (tangent.lengthSq() < 0.001) {
      tangent = new THREE.Vector3(1, 0, 0); // Handle pole case
    }
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent);

    for (let k = 0; k < numChildren; k++) {
      if (instanceIdx >= totalInstances) break;

      const dist = (0.6 + Math.random() * 0.6) * globalScale; // Scale offset by cloud size
      const angle = Math.random() * Math.PI * 2;

      // Calculate offset in tangent plane
      const xOff = Math.cos(angle) * dist;
      const yOff = Math.sin(angle) * dist;
      const zOff = (Math.random() - 0.5) * 0.3 * globalScale;

      // Combine to get world position
      const childPos = mainPos.clone()
        .add(tangent.clone().multiplyScalar(xOff))
        .add(bitangent.clone().multiplyScalar(yOff))
        .add(normal.clone().multiplyScalar(zOff));

      dummy.position.copy(childPos);
      dummy.lookAt(0, 0, 0);
      dummy.rotateZ(Math.random() * Math.PI * 2); // Random spin

      const childScale = globalScale * (0.4 + Math.random() * 0.4);
      dummy.scale.set(childScale, childScale, childScale * 0.6);

      dummy.updateMatrix();
      instancedCloudMesh.setMatrixAt(instanceIdx, dummy.matrix);
      randoms[instanceIdx] = Math.random();

      // Store Center (Same as main puff for uniform shrinking)
      cloudCenters[instanceIdx * 3] = mainPos.x;
      cloudCenters[instanceIdx * 3 + 1] = mainPos.y;
      cloudCenters[instanceIdx * 3 + 2] = mainPos.z;

      instanceIdx++;
    }

    // --- C. Rain Drops ---
    // Generate drops around the cloud center
    for (let r = 0; r < dropsPerCloud; r++) {
      if (rainIdx >= totalRainInstances) break;

      // Random position around cloud center
      const rainDist = (Math.random() - 0.5) * 1.5 * globalScale;
      const rainAngle = Math.random() * Math.PI * 2;

      // Offset in tangent plane (similar to children)
      // We use the same basis vectors (tangent, bitangent, normal) calculated for children
      // But we want rain to be "under" the cloud? 
      // Actually, the shader handles the "falling" animation.
      // We just need to place them in the cloud volume.

      const rX = Math.cos(rainAngle) * rainDist;
      const rY = Math.sin(rainAngle) * rainDist;
      // LOWER SPAWN POINT:
      // Cloud is at radius ~4.5. 
      // We want rain to start "inside" or "below".
      // Z is radial distance here (along normal).
      // 0.5 was "above" center? No, normal points OUT.
      // So +Z is OUT (higher). -Z is IN (lower).
      // Let's spawn them slightly lower (closer to planet).
      const rZ = -0.5 + Math.random() * 0.5;

      const dropPos = mainPos.clone()
        .add(tangent.clone().multiplyScalar(rX))
        .add(bitangent.clone().multiplyScalar(rY))
        .add(normal.clone().multiplyScalar(rZ)); // Radial offset

      dummy.position.copy(dropPos);
      dummy.lookAt(0, 0, 0); // Align with planet center
      // No rotation needed as geometry is rotated
      dummy.scale.set(1, 1, 1);

      dummy.updateMatrix();
      instancedRainMesh.setMatrixAt(rainIdx, dummy.matrix);
      rainRandoms[rainIdx] = Math.random();
      rainSpeeds[rainIdx] = 2.0 + Math.random() * 3.0;

      // Store Center
      rainCloudCenters[rainIdx * 3] = mainPos.x;
      rainCloudCenters[rainIdx * 3 + 1] = mainPos.y;
      rainCloudCenters[rainIdx * 3 + 2] = mainPos.z;

      rainIdx++;
    }
  }

  // Add Attributes
  instancedCloudMesh.geometry.setAttribute(
    "aRandom",
    new THREE.InstancedBufferAttribute(randoms, 1),
  );
  instancedCloudMesh.geometry.setAttribute(
    "aCloudCenter",
    new THREE.InstancedBufferAttribute(cloudCenters, 3),
  );

  // Set actual count used
  instancedCloudMesh.count = instanceIdx;

  cloudsMesh.add(instancedCloudMesh);

  // Add Rain Attributes
  instancedRainMesh.geometry.setAttribute(
    "aRandom",
    new THREE.InstancedBufferAttribute(rainRandoms, 1),
  );
  instancedRainMesh.geometry.setAttribute(
    "aSpeed",
    new THREE.InstancedBufferAttribute(rainSpeeds, 1),
  );
  instancedRainMesh.geometry.setAttribute(
    "aCloudCenter",
    new THREE.InstancedBufferAttribute(rainCloudCenters, 3),
  );
  instancedRainMesh.count = rainIdx;
  cloudsMesh.add(instancedRainMesh);

  planetGroup.add(cloudsMesh);

  // --- GENERATE LAVA ---
  if (lavaMesh) {
    planetGroup.remove(lavaMesh);
  }

  // Create a disk at the North Pole, slightly below the rim
  const lavaGeo = new THREE.CircleGeometry(0.5, 16);
  // Rotate to face up
  lavaGeo.rotateX(-Math.PI / 2);
  // FIX: Calculate the actual peak height based on the displacement formula
  // Radius = 4.0 * (1 + displacement)
  // Displacement at peak = (volcanoHeight * 3.0) * 0.2
  const peakDisplacement = PARAMS.volcanoHeight * 3.0 * 0.2;
  const peakRadius = 4.0 * (1 + peakDisplacement);

  // Position lava slightly below the peak (crater depth)
  //const lavaHeight = peakRadius * 0.98;
  const lavaHeight = 4.5 + PARAMS.volcanoHeight * 0.15 * 4.0;

  lavaGeo.translate(0, lavaHeight, 0);

  const lavaMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSpeed: { value: PARAMS.lavaSpeed },
      uBrightness: { value: PARAMS.lavaBrightness },
    },
    vertexShader: LAVA_VERTEX,
    fragmentShader: LAVA_FRAGMENT,
  });

  lavaMesh = new THREE.Mesh(lavaGeo, lavaMat);
  planetGroup.add(lavaMesh);

  // Add a PointLight for the glow
  const lavaLight = new THREE.PointLight(0xffaa00, 2.0, 4.0);
  lavaLight.position.set(0, 0.5, 0); // Relative to lava mesh
  lavaMesh.add(lavaLight);

  // --- GENERATE ERUPTION SYSTEM ---
  if (eruptionGroup) {
    planetGroup.remove(eruptionGroup);
  }
  eruptionGroup = new THREE.Group();
  rocks = [];

  const rockGeo = new THREE.DodecahedronGeometry(0.1, 0);

  // 1. Define two distinct materials
  // A. Glowing Magma (Hot)
  const magmaMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: 0xff4400,
    emissiveIntensity: 0.8,
    flatShading: true,
  });

  // B. Cold Ash Rock (Smoke/Debris)
  const ashMat = new THREE.MeshStandardMaterial({
    color: 0x222222, // Dark Grey
    roughness: 1.0, // Very matte
    flatShading: true,
  });

  for (let i = 0; i < 40; i++) {
    // Increased count slightly

    // 2. Randomly pick Hot or Cold
    const isMagma = Math.random() > 0.4; // 60% Magma, 40% Rock
    const mat = isMagma ? magmaMat : ashMat;

    const rock = new THREE.Mesh(rockGeo, mat);
    rock.visible = false;

    // 3. Randomize Scale for variety
    const s = 0.8 + Math.random() * 0.6;
    rock.scale.set(s, s, s);

    rock.userData = {
      velocity: new THREE.Vector3(),
      active: false,
      rotSpeed: new THREE.Vector3(),
      isMagma: isMagma, // Store type in case we want specific physics later
    };
    eruptionGroup.add(rock);
    rocks.push(rock);
  }
  planetGroup.add(eruptionGroup);

  generateVegetation(4, simplex, prng);
  createCharacters();
}

function updatePlanet() {
  generatePlanet();
}

// --- CHARACTER SNAP LOGIC ---
function snapCharacter(obj, state, lookTargetPhi, lookTargetTheta) {
  if (!obj || !planetMesh || !planetGroup) return;
  charPos.setFromSphericalCoords(6, state.phi, state.theta);
  const rayOrigin = charPos.clone().applyMatrix4(planetGroup.matrixWorld);
  const direction = new THREE.Vector3(0, 0, 0).sub(rayOrigin).normalize();

  raycaster.set(rayOrigin, direction);
  const intersects = raycaster.intersectObject(planetMesh);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const waterRadius = 4 + PARAMS.waterLevel * PARAMS.height * 0.5;
    const localHit = hit.point
      .clone()
      .applyMatrix4(planetGroup.matrixWorld.clone().invert());
    const dist = localHit.length();
    let finalPos = localHit;
    let normal = hit.face.normal.clone().normalize();
    let isWater = false;

    if (dist < waterRadius) {
      isWater = true;
      finalPos.setLength(waterRadius);
      normal.copy(finalPos).normalize();
    }
    obj.position.copy(finalPos);
    obj.visible = true;

    if (obj.userData.boat) {
      obj.userData.boat.visible = isWater;
      obj.userData.mesh.position.y = isWater
        ? obj.userData.yOffsetWater
        : obj.userData.yOffsetLand;
    }

    targetPos.setFromSphericalCoords(4, lookTargetPhi, lookTargetTheta);
    const forward = targetPos.sub(obj.position).normalize();
    const dot = forward.dot(normal);
    const projectedForward = forward
      .sub(normal.clone().multiplyScalar(dot))
      .normalize();

    dummyObj.position.copy(obj.position);
    dummyObj.up.copy(normal);
    lookTarget.copy(obj.position).add(projectedForward);
    dummyObj.lookAt(lookTarget);
    obj.quaternion.slerp(dummyObj.quaternion, 0.1);
  } else {
    obj.visible = false;
  }
}

// --- UI LOGIC BINDING ---
// (We handle UI listeners here to keep access to `updatePlanet`)

function loadPresetsFromStorage() {
  try {
    const stored = localStorage.getItem(PRESET_KEY);
    if (stored) savedPresets = JSON.parse(stored);
    else savedPresets = {};
  } catch (e) {
    console.error("Failed to load presets", e);
    savedPresets = {};
  }
}

function savePresetsToStorage() {
  localStorage.setItem(PRESET_KEY, JSON.stringify(savedPresets));
}

function populatePresetDropdown() {
  ui.presetSelect.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "Default";
  defaultOpt.innerText = "Default";
  ui.presetSelect.appendChild(defaultOpt);
  Object.keys(savedPresets).forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.innerText = name;
    ui.presetSelect.appendChild(opt);
  });
}

function updateDependentShaders(key, val) {
  if (key === "horizonStrength") HORIZON_UNIFORMS.uHorizonStrength.value = val;
  if (key === "horizonPower") HORIZON_UNIFORMS.uHorizonPower.value = val;
  if (key === "cloudHazeMultiplier")
    CLOUD_UNIFORMS.uCloudHazeMultiplier.value = val;
  if (key === "cloudLightWrap") CLOUD_UNIFORMS.uCloudLightWrap.value = val; // <--- Add this
  if (key === "waveSpeed") WATER_UNIFORMS.uWaveSpeed.value = val;
  if (key === "waveHeight") WATER_UNIFORMS.uWaveHeight.value = val;
  if (key === "sunDistortion") sunMat.uniforms.uVertexDistortion.value = val;

  atmoMaterials.forEach((mat) => {
    if (key === "haloStrength") mat.uniforms.uHaloStrength.value = val;
    if (key === "sunsetOffset") mat.uniforms.uSunsetOffset.value = val;
    if (key === "sunsetWidth") mat.uniforms.uSunsetWidth.value = val;
    if (key === "hazeSpread") mat.uniforms.uHazeSpread.value = val;
    if (key === "hazeFalloff") mat.uniforms.uHazeFalloff.value = val;
    if (key === "atmoDistortion") mat.uniforms.uAtmoDistortion.value = val;
    if (key === "colorVibrance") mat.uniforms.uVibrance.value = val;
    if (key === "solarEnabled")
      mat.uniforms.uSolarEnabled.value = val ? 1.0 : 0.0;
    if (key === "hazeIntensity")
      mat.uniforms.uHazeIntensity.value = PARAMS.hazeEnabled ? val : 0.0;
    if (key === "hazeEnabled")
      mat.uniforms.uHazeIntensity.value = val ? PARAMS.hazeIntensity : 0.0;
  });

  // Update Cloud Uniforms
  if (cloudsMesh && cloudsMesh.children.length > 0) {
    const instancedMesh = cloudsMesh.children[0];
    if (instancedMesh && instancedMesh.material) {
      if (key === "scale") instancedMesh.material.uniforms.uPlanetScale.value = val;
      if (key === "height") instancedMesh.material.uniforms.uPlanetHeight.value = val;
      if (key === "cloudShrinkAmount") instancedMesh.material.uniforms.uCloudShrinkAmount.value = val;
      if (key === "cloudTransition") instancedMesh.material.uniforms.uCloudTransition.value = val;
      if (key === "rainDarkness") instancedMesh.material.uniforms.uRainDarkness.value = val;
    }
  }

  // Update Rain Uniforms
  if (cloudsMesh && cloudsMesh.children.length > 1) {
    // Rain is the second child (index 1)
    const rainMesh = cloudsMesh.children[1];
    if (rainMesh && rainMesh.material) {
      if (key === "scale") rainMesh.material.uniforms.uPlanetScale.value = val;
      if (key === "height") rainMesh.material.uniforms.uPlanetHeight.value = val;
      if (key === "cloudTransition") rainMesh.material.uniforms.uCloudTransition.value = val; // Rain needs this too for sync
    }
  }
}

function updateLighting() {
  const intensity = 0.6 - PARAMS.nightDarkness * 0.55;
  ambientLight.intensity = intensity;
}

function applyParamsToUI() {
  const setVal = (el, val, display) => {
    if (!el) return;
    if (el.type === "checkbox") el.checked = val;
    else {
      el.value = val;
      if (display) {
        if (el.id === "stars") display.innerText = val.toFixed(1) + "x";
        else display.innerText = val;
      }
    }
  };
  // Map params to UI (Abbreviated list logic, maps strict keys)
  setVal(ui.seed, PARAMS.seed, displays.seed);
  setVal(ui.detail, PARAMS.detail, displays.detail);
  setVal(ui.scale, PARAMS.scale, displays.scale);
  setVal(ui.height, PARAMS.height, displays.height);
  setVal(ui.water, PARAMS.waterLevel, displays.water);
  setVal(ui.veg, PARAMS.vegetationDensity, displays.veg);
  setVal(ui.atmo, PARAMS.atmosphereOpacity, displays.atmo);
  setVal(ui.alayers, PARAMS.atmoCount, displays.alayers);
  setVal(ui.speed, PARAMS.rotationSpeed, displays.speed);
  setVal(ui.cspeed, PARAMS.cloudSpeed, displays.cspeed);
  setVal(ui.sun, PARAMS.sunSpeed, displays.sun);
  setVal(ui.dark, PARAMS.nightDarkness, displays.dark);
  setVal(ui.halo, PARAMS.haloStrength, displays.halo);
  setVal(ui.sred, PARAMS.sunReddening, displays.sred);
  setVal(ui.sbright, PARAMS.sunBrightness, displays.sbright);
  setVal(ui.soff, PARAMS.sunsetOffset, displays.soff);
  setVal(ui.swidth, PARAMS.sunsetWidth, displays.swidth);
  setVal(ui.ascale, PARAMS.atmoScale, displays.ascale);
  setVal(ui.hspread, PARAMS.hazeSpread, displays.hspread);
  setVal(ui.hint, PARAMS.hazeIntensity, displays.hint);
  setVal(ui.hfall, PARAMS.hazeFalloff, displays.hfall);
  setVal(ui.stars, PARAMS.starDensity, displays.stars);
  setVal(ui.cCov, PARAMS.cloudCoverage, displays.cCov);
  setVal(ui.cAlt, PARAMS.cloudAltitude, displays.cAlt);
  setVal(ui.cSize, PARAMS.cloudSize, displays.cSize);
  setVal(ui.cShrink, PARAMS.cloudShrinkAmount, displays.cShrink); // <--- ADDED
  setVal(ui.cTrans, PARAMS.cloudTransition, displays.cTrans);     // <--- ADDED
  setVal(ui.rDark, PARAMS.rainDarkness, displays.rDark);          // <--- ADDED
  setVal(ui.hStr, PARAMS.horizonStrength, displays.hStr);
  setVal(ui.hPow, PARAMS.horizonPower, displays.hPow);
  setVal(ui.chaze, PARAMS.cloudHazeMultiplier, displays.chaze); // <--- Add this
  setVal(ui.cwrap, PARAMS.cloudLightWrap, displays.cwrap); // <--- Add this
  setVal(ui.wSpeed, PARAMS.waveSpeed, displays.wSpeed);
  setVal(ui.wHeight, PARAMS.waveHeight, displays.wHeight);
  //setVal(ui.hazeDist, PARAMS.hazeDistortion, displays.hazeDist); <== DELETED
  setVal(ui.sunDist, PARAMS.sunDistortion, displays.sunDist);
  setVal(ui.atmoDist, PARAMS.atmoDistortion, displays.atmoDist);
  setVal(ui.vib, PARAMS.colorVibrance, displays.vib);
  setVal(ui.sunrise, PARAMS.sunriseTemp, null);
  setVal(ui.sunset, PARAMS.sunsetTemp, null);
  setVal(ui.riseTint, PARAMS.sunriseTintStrength, displays.riseTint);
  setVal(ui.setTint, PARAMS.sunsetTintStrength, displays.setTint);
  setVal(ui.tintDim, PARAMS.tintBrightnessDrop, displays.tintDim);
  setVal(ui.htoggle, PARAMS.hazeEnabled);
  setVal(ui.flip, PARAMS.cycleFlip);
  setVal(ui.solar, PARAMS.solarEnabled);

  ui.presets.forEach((b) => b.classList.remove("ring-2", "ring-white"));
  const activeBtn = document.querySelector(
    `.preset-btn[data-preset="${PARAMS.biome}"]`,
  );
  if (activeBtn) activeBtn.classList.add("ring-2", "ring-white");

  currentBiome = BIOMES[PARAMS.biome];
  rimLight.color.setHex(currentBiome.atmosphereColor);
  updateLighting();
  generateStars();
  updatePlanet();
  Object.keys(PARAMS).forEach((key) =>
    updateDependentShaders(key, PARAMS[key]),
  );
}

function bindInput(key, element, display, isInt = false) {
  if (!element) return;
  if (element.type === "checkbox") {
    element.addEventListener("change", (e) => {
      PARAMS[key] = e.target.checked;
      updateDependentShaders(key, e.target.checked);
    });
    return;
  }
  element.addEventListener("input", (e) => {
    let val = parseFloat(e.target.value);
    if (isInt) val = parseInt(val);
    PARAMS[key] = val;
    if (key === "starDensity") display.innerText = val.toFixed(1) + "x";
    else if (display) display.innerText = val;
    updateDependentShaders(key, val);
    if (
      key === "starDensity" ||
      key === "atmoScale" ||
      key === "atmoCount" ||
      (key !== "rotationSpeed" &&
        key !== "cloudSpeed" &&
        key !== "sunSpeed" &&
        key !== "sunReddening" &&
        key !== "sunBrightness" &&
        key !== "horizonStrength" &&
        key !== "horizonPower" &&
        key !== "waveSpeed" &&
        key !== "waveHeight" &&
        key !== "cycleFlip" &&
        key !== "sunriseTemp" &&
        key !== "sunsetTemp" &&
        key !== "sunriseTintStrength" &&
        key !== "sunsetTintStrength" &&
        key !== "tintBrightnessDrop" &&
        key !== "sunDistortion" &&
        key !== "atmoDistortion")
    ) {
      if (key === "starDensity") generateStars();
      else updatePlanet();
    }
    if (key === "nightDarkness") updateLighting();
  });
}

// BINDING
bindInput("seed", ui.seed, displays.seed, true);
bindInput("detail", ui.detail, displays.detail, true);
bindInput("scale", ui.scale, displays.scale);
bindInput("height", ui.height, displays.height);
bindInput("waterLevel", ui.water, displays.water);
bindInput("vegetationDensity", ui.veg, displays.veg, true);
bindInput("atmosphereOpacity", ui.atmo, displays.atmo);
bindInput("atmoCount", ui.alayers, displays.alayers, true);
bindInput("rotationSpeed", ui.speed, displays.speed);
bindInput("cloudSpeed", ui.cspeed, displays.cspeed);
bindInput("sunSpeed", ui.sun, displays.sun);
bindInput("nightDarkness", ui.dark, displays.dark);
bindInput("sunReddening", ui.sred, displays.sred);
bindInput("sunBrightness", ui.sbright, displays.sbright);
bindInput("starDensity", ui.stars, displays.stars);
bindInput("haloStrength", ui.halo, displays.halo);
bindInput("sunsetOffset", ui.soff, displays.soff);
bindInput("sunsetWidth", ui.swidth, displays.swidth);
bindInput("atmoScale", ui.ascale, displays.ascale);
bindInput("hazeEnabled", ui.htoggle, null);
bindInput("hazeSpread", ui.hspread, displays.hspread);
bindInput("hazeIntensity", ui.hint, displays.hint);
bindInput("hazeFalloff", ui.hfall, displays.hfall);
bindInput("horizonStrength", ui.hStr, displays.hStr);
bindInput("horizonPower", ui.hPow, displays.hPow);
bindInput("cloudHazeMultiplier", ui.chaze, displays.chaze); // <--- Add this
bindInput("cloudLightWrap", ui.cwrap, displays.cwrap); // <--- Add this
bindInput("waveSpeed", ui.wSpeed, displays.wSpeed);
bindInput("waveHeight", ui.wHeight, displays.wHeight);
bindInput("cycleFlip", ui.flip, null);
bindInput("solarEnabled", ui.solar, null);
bindInput("sunDistortion", ui.sunDist, displays.sunDist);
bindInput("atmoDistortion", ui.atmoDist, displays.atmoDist);
bindInput("colorVibrance", ui.vib, displays.vib);
bindInput("sunriseTemp", ui.sunrise, null);
bindInput("sunsetTemp", ui.sunset, null);
bindInput("sunriseTintStrength", ui.riseTint, displays.riseTint);
bindInput("sunsetTintStrength", ui.setTint, displays.setTint);
bindInput("tintBrightnessDrop", ui.tintDim, displays.tintDim);
bindInput("cloudCoverage", ui.cCov, displays.cCov);
bindInput("cloudAltitude", ui.cAlt, displays.cAlt);
bindInput("cloudSize", ui.cSize, displays.cSize);
bindInput("cloudShrinkAmount", ui.cShrink, displays.cShrink); // <--- ADDED
bindInput("cloudTransition", ui.cTrans, displays.cTrans);     // <--- ADDED
bindInput("rainDarkness", ui.rDark, displays.rDark);          // <--- ADDED

bindInput("horizonStrength", ui.hStr, displays.hStr);
bindInput("horizonPower", ui.hPow, displays.hPow);

ui.random.addEventListener("click", () => {
  const newSeed = Math.floor(Math.random() * 1000);
  ui.seed.value = newSeed;
  displays.seed.innerText = newSeed;
  PARAMS.seed = newSeed;
  updatePlanet();
});

ui.presets.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const type = e.target.dataset.preset;
    currentBiome = BIOMES[type];
    rimLight.color.setHex(currentBiome.atmosphereColor);
    ui.presets.forEach((b) => b.classList.remove("ring-2", "ring-white"));
    e.target.classList.add("ring-2", "ring-white");
    PARAMS.biome = type;
    updatePlanet();
  });
});

ui.presetSelect.addEventListener("change", () => {
  const name = ui.presetSelect.value;
  let data;
  if (name === "Default") data = { ...DEFAULT_PARAMS };
  else if (savedPresets[name]) data = { ...savedPresets[name] };
  else return;
  Object.assign(PARAMS, data);
  applyParamsToUI();
});

// Modal Actions
ui.btnSave.addEventListener("click", async () => {
  const name = ui.presetSelect.value;
  if (name === "Default") {
    await showModal("Error", "Cannot overwrite Default preset. Use 'Save As'.");
    return;
  }
  savedPresets[name] = { ...PARAMS };
  savePresetsToStorage();
  await showModal("Success", `Saved preset "${name}"`);
});

ui.btnSaveAs.addEventListener("click", async () => {
  const name = await showModal("Save As", "Enter new preset name:", true);
  if (name) {
    if (name === "Default") {
      await showModal("Error", "Cannot create a preset named 'Default'.");
      return;
    }
    savedPresets[name] = { ...PARAMS };
    savePresetsToStorage();
    populatePresetDropdown();
    ui.presetSelect.value = name;
  }
});

ui.btnDelete.addEventListener("click", async () => {
  const name = ui.presetSelect.value;
  if (name === "Default") {
    await showModal("Error", "Cannot delete Default preset.");
    return;
  }
  const confirmed = await showModal(
    "Delete Preset",
    `Are you sure you want to delete "${name}"?`,
    false,
    true,
  );
  if (confirmed) {
    delete savedPresets[name];
    savePresetsToStorage();
    populatePresetDropdown();
    ui.presetSelect.value = "Default";
    Object.assign(PARAMS, DEFAULT_PARAMS);
    applyParamsToUI();
  }
});

ui.toggle.addEventListener("click", () =>
  ui.panel.classList.toggle("translate-x-full"),
);

ui.camReset.addEventListener("click", () => {
  camera.position.set(0, 4, 16);
  camera.up.set(0, 1, 0);
  controls.target.set(0, 0, 0);
  controls.update();
});
ui.camFront.addEventListener("click", () => {
  camera.position.set(0, 0, 16);
  camera.up.set(0, 1, 0);
  controls.target.set(0, 0, 0);
  controls.update();
});
ui.camTop.addEventListener("click", () => {
  camera.position.set(0, 16, 0.001);
  camera.up.set(0, 0, -1);
  controls.target.set(0, 0, 0);
  controls.update();
});

let isPaused = false;
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "p") {
    isPaused = !isPaused;
    ui.pauseIndicator.classList.toggle("visible", isPaused);
  }
});
let isSunFrozen = false;
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "f") {
    isSunFrozen = !isSunFrozen;
    //ui.pauseIndicator.classList.toggle("visible", isPaused);
  }
});
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  controls.handleResize();
});

// --- ANIMATION ---
const clock = new THREE.Clock();
const tempVec = new THREE.Vector3();
const sunWorldPos = new THREE.Vector3();
const vecToSun = new THREE.Vector3();
const vecToPlanet = new THREE.Vector3();
const crossVec = new THREE.Vector3();
const baseSunColor = new THREE.Color(0xffdd00);
const cRiseCold = new THREE.Color(0x4444ff);
const cRiseWarm = new THREE.Color(0xffaa00);
const cSetOrange = new THREE.Color(0xffaa00);
const cSetRed = new THREE.Color(0xff0044);

function animate() {
  requestAnimationFrame(animate);
  let delta = clock.getDelta();
  if (delta > 0.1) delta = 0.1;
  const time = clock.getElapsedTime();

  WATER_UNIFORMS.uTime.value = time;

  if (!isPaused) {
    planetGroup.rotation.y += PARAMS.rotationSpeed * delta * 0.5;
    if (sunOrbit && !isSunFrozen) {
      sunOrbit.rotation.y += PARAMS.sunSpeed * delta;
      sunMesh.rotation.z -= delta * 0.5;
      sunMesh.rotation.x -= delta * 0.2;
    }
    if (cloudsMesh) cloudsMesh.rotation.y += PARAMS.cloudSpeed * delta;
  }

  if (sunOrbit) {
    sunMesh.getWorldPosition(sunWorldPos);
    const camPos = camera.position;
    vecToSun.subVectors(sunWorldPos, camPos);
    vecToPlanet.subVectors(new THREE.Vector3(0, 0, 0), camPos);

    const viewDir = vecToPlanet.clone().negate().normalize();
    const camRight = new THREE.Vector3()
      .crossVectors(viewDir, camera.up)
      .normalize();
    const sunDir = sunWorldPos.clone().normalize();
    let sunSide = camRight.dot(sunDir);
    if (PARAMS.cycleFlip) sunSide = -sunSide;

    crossVec.crossVectors(vecToSun, vecToPlanet);
    const perpDist = crossVec.length() / vecToSun.length();
    const isBehind = vecToSun.lengthSq() > vecToPlanet.lengthSq();
    let sunsetFactor = 0.0;
    if (isBehind) {
      const rInner = 3.8;
      const rOuter = 4.5 * PARAMS.atmoScale;
      if (perpDist < rOuter) {
        let t = (perpDist - rInner) / (rOuter - rInner);
        t = Math.max(0.0, Math.min(1.0, t));
        sunsetFactor = 1.0 - THREE.MathUtils.smoothstep(t, 0.0, 1.0);
        sunsetFactor *= PARAMS.sunReddening;
      }
    }

    const currentSunrise = cRiseCold
      .clone()
      .lerp(cRiseWarm, PARAMS.sunriseTemp);
    const currentSunset = cSetOrange.clone().lerp(cSetRed, PARAMS.sunsetTemp);

    atmoMaterials.forEach((mat) => {
      mat.uniforms.sunPosition.value.copy(sunWorldPos);
      mat.uniforms.uSunsetFactor.value = sunsetFactor;
      mat.uniforms.uSunSide.value = sunSide;
      mat.uniforms.uTime.value = time;
      mat.uniforms.sunriseColor.value.copy(currentSunrise);
      mat.uniforms.sunsetColor.value.copy(currentSunset);
    });

    const sideBlend = THREE.MathUtils.smoothstep(sunSide, -0.5, 0.5);
    const targetTint = currentSunrise.clone().lerp(currentSunset, sideBlend);
    const strength = THREE.MathUtils.lerp(
      PARAMS.sunriseTintStrength,
      PARAMS.sunsetTintStrength,
      sideBlend,
    );
    let sunColor = baseSunColor.clone();
    targetTint.multiplyScalar(PARAMS.colorVibrance);
    const mixAlpha = Math.min(1.0, sunsetFactor * strength * 2.5);
    sunColor.lerp(targetTint, mixAlpha);
    const dimFactor = THREE.MathUtils.lerp(
      1.0,
      1.0 - PARAMS.tintBrightnessDrop,
      mixAlpha,
    );
    let brightness = PARAMS.sunBrightness * dimFactor;

    sunColor.multiplyScalar(brightness);
    sunMat.uniforms.uColor.value.copy(baseSunColor);
    sunMat.uniforms.uTint.value.copy(targetTint);
    sunMat.uniforms.uMixAmount.value = mixAlpha;
    sunMat.uniforms.uBrightness.value = brightness;
    sunMat.uniforms.uTime.value = time;
    sunMat.uniforms.uSunSide.value = sunSide;
    sunMat.uniforms.uSunsetFactor.value = sunsetFactor;
    sunMat.uniforms.uVertexDistortion.value = PARAMS.sunDistortion;
    sunMat.uniforms.uSolarEnabled.value = PARAMS.solarEnabled ? 1.0 : 0.0;
    // --- UPDATE CLOUDS WITH SOLAR COLORS ---
    if (cloudsMesh && cloudsMesh.children.length > 0) {
      const instancedMesh = cloudsMesh.children[0];
      if (instancedMesh && instancedMesh.material && instancedMesh.material.uniforms.uSunColor) {
        // 1. Sun Color (Direct Light)
        // Mix White (Day) -> TargetTint (Sunset) based on sunset factor
        // We boost tint saturation slightly for clouds so they catch color early
        let cloudSunColor = new THREE.Color(0xffffff);
        cloudSunColor.lerp(targetTint, sunsetFactor * 1.2);
        instancedMesh.material.uniforms.uSunColor.value.copy(cloudSunColor);

        // 2. Ambient Color (Shadow Side)
        // Day: Blue-Grey (0x445566) -> Night: Dark Violet/Black (0x111122)
        let dayAmb = new THREE.Color(0x445566);
        let setAmb = new THREE.Color(0x110511); // Dark purple shadow
        let currentAmb = dayAmb.lerp(setAmb, sunsetFactor);

        // Apply night darkness param
        currentAmb.multiplyScalar(0.5 + (1.0 - PARAMS.nightDarkness) * 0.5);

        instancedMesh.material.uniforms.uAmbientColor.value.copy(currentAmb);
      }
    }
  } // End of sunOrbit block

  if (cloudsMesh && !isPaused) {
    const cloudsRotation = cloudsMesh.rotation.y;

    // --- 1. NEW LOCATION: Update Material Uniforms ONCE per frame ---
    // Since all clouds share the same material, we don't need to do this inside the loop
    if (cloudsMesh.children.length > 0) {
      // The first child is now the InstancedMesh
      const instancedMesh = cloudsMesh.children[0];
      if (instancedMesh && instancedMesh.material) {
        instancedMesh.material.uniforms.sunPosition.value.copy(sunWorldPos);
        instancedMesh.material.uniforms.uTime.value = time;
        instancedMesh.material.uniforms.uCloudRotation.value = cloudsRotation; // <--- RE-ADDED
      }

      // Update Rain Time
      if (cloudsMesh.children.length > 1) {
        const rainMesh = cloudsMesh.children[1];
        if (rainMesh && rainMesh.material) {
          rainMesh.material.uniforms.uTime.value = time;
          rainMesh.material.uniforms.uCloudRotation.value = cloudsRotation; // <--- RE-ADDED
        }
      }
    }

    // Legacy loop removed. Animation is now handled in Vertex Shader.


    // --- DELETED THE MATERIAL UPDATE BLOCK HERE ---

  }

  if (!isPaused) {
    // 1. UPDATE LAVA
    if (lavaMesh) {
      lavaMesh.material.uniforms.uTime.value = time;
    }

    // 2. ERUPTION LOGIC
    if (time > eruptionTime) {
      isErupting = true;
      // Reset timer (randomized slightly)
      eruptionTime = time + PARAMS.volcanoFrequency + Math.random() * 2.0;

      // Launch a batch of rocks
      rocks.forEach((rock) => {
        if (!rock.userData.active && Math.random() > 0.5) {
          rock.userData.active = true;
          rock.visible = true;

          // Reset to Crater Center (North Pole relative to planet)
          // Note: Since planet rotates, we need local coordinates.
          // North Pole Local is (0, height, 0)
          // FIX: Spawn at the new peak radius
          // We recalculate it here or you could store it globally,
          // but calculating it is cheap.
          const peakDisp = PARAMS.volcanoHeight * 3.0 * 0.2;
          //const spawnHeight = 4.0 * (1 + peakDisp);
          // FIX: Spawn exactly at the lava level we calculated above
          const spawnHeight = 4.5 + PARAMS.volcanoHeight * 0.15 * 4.0;

          rock.position.set(0, spawnHeight, 0);

          // Random Velocity Up and Out
          const theta = Math.random() * Math.PI * 2;
          const spread = 0.5;
          rock.userData.velocity.set(
            Math.cos(theta) * spread,
            PARAMS.volcanoForce * (0.5 + Math.random() * 0.5), // Upward force
            Math.sin(theta) * spread,
          );

          rock.userData.rotSpeed.set(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5,
          );
        }
      });
    }

    // 3. PHYSICS UPDATE
    rocks.forEach((rock) => {
      if (rock.userData.active) {
        // Apply Gravity (Down towards (0,0,0) in local space)
        // Simple approximation: just pull Y down relative to planet
        rock.userData.velocity.y -= delta * 9.8;

        // Move
        rock.position.add(rock.userData.velocity.clone().multiplyScalar(delta));

        // Rotate
        rock.rotation.x += rock.userData.rotSpeed.x;
        rock.rotation.y += rock.userData.rotSpeed.y;

        // Collision/Death (If it falls below ground level)
        if (rock.position.length() < 3.8) {
          rock.userData.active = false;
          rock.visible = false;
        }
      }
    });
  }

  if (!isPaused) starsGroup.rotation.y -= delta * 0.02;

  controls.update();
  renderer.render(scene, camera);

  if (sam && algen && planetMesh) {
    if (!isPaused) {
      if (samState.stuckTimer > 5.0) {
        const d = sam.position.distanceTo(samState.lastPos);
        if (d < 1.0) {
          samState.idleTime = 0;
          samState.wanderAngle += Math.PI;
          samState.stuckTimer = 0;
        } else {
          samState.lastPos.copy(sam.position);
          samState.stuckTimer = 0;
        }
      } else {
        samState.stuckTimer += delta;
      }

      if (samState.idleTime > 0) {
        samState.idleTime -= delta;
      } else {
        const dPhi = samState.targetPhi - samState.phi;
        let dTheta = samState.targetTheta - samState.theta;
        if (dTheta > Math.PI) dTheta -= Math.PI * 2;
        if (dTheta < -Math.PI) dTheta += Math.PI * 2;
        const dist = Math.sqrt(dPhi * dPhi + dTheta * dTheta);
        if (dist < 0.05) {
          samState.wanderAngle += (Math.random() - 0.5) * 1.5;
          const stepDist = 2.5 + Math.random() * 1.5;
          const tp = samState.phi + Math.cos(samState.wanderAngle) * stepDist;
          const tt = samState.theta + Math.sin(samState.wanderAngle) * stepDist;
          samState.targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, tp));
          samState.targetTheta = tt;
          samState.idleTime = 0.2 + Math.random() * 0.5;
        } else {
          const speed = samState.speed * delta;
          samState.phi += (dPhi / dist) * speed;
          samState.theta += (dTheta / dist) * speed;
        }
      }

      let dPhi = samState.phi - algenState.phi;
      let dTheta = samState.theta - algenState.theta;
      if (dTheta > Math.PI) dTheta -= Math.PI * 2;
      if (dTheta < -Math.PI) dTheta += Math.PI * 2;
      const distToSam = Math.sqrt(dPhi * dPhi + dTheta * dTheta) * 4;

      if (algenState.hesitationTimer > 0) {
        algenState.hesitationTimer -= delta;
        algenState.moving = false;
      } else {
        if (distToSam > 2.0) algenState.moving = true;
        else if (distToSam < 1.0) algenState.moving = false;
        if (algenState.moving) {
          if (Math.random() < 0.005)
            algenState.hesitationTimer = 1.0 + Math.random() * 1.5;
          const speed = algenState.speed * delta;
          algenState.phi += dPhi * speed * 1.5;
          algenState.theta += dTheta * speed * 1.5;
        }
      }
    }
    snapCharacter(sam, samState, samState.targetPhi, samState.targetTheta);
    snapCharacter(algen, algenState, samState.phi, samState.theta);
  }
}

// INITIALIZATION
loadPresetsFromStorage();
populatePresetDropdown();
applyParamsToUI();
updateLighting();
generateStars(); // Ensure stars generate on load
generatePlanet(); // Starts the loop essentially
animate();

// --- DEV TOOL: Export Config ---
window.exportConfig = function () {
  // 1. Convert the current PARAMS object to a formatted string
  // The 'null, 2' arguments make it pretty-print with 2-space indentation
  const jsonString = JSON.stringify(PARAMS, null, 2);

  // 2. Wrap it in the actual code syntax for config.js
  const codeBlock = `export const DEFAULT_PARAMS = ${jsonString};`;

  // 3. Log it cleanly
  console.log(
    "%cCopy the code below:",
    "color: #4ade80; font-weight: bold; font-size: 14px;",
  );
  console.log(codeBlock);

  // 4. (Optional) Attempt to copy to clipboard automatically
  try {
    navigator.clipboard.writeText(codeBlock);
    console.log(
      "%c(Also copied to clipboard!)",
      "color: #888; font-style: italic;",
    );
  } catch (err) {
    // Ignore clipboard errors if browser blocks it
  }
};
