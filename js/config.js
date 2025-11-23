import * as THREE from "three";

// --- GLOBAL UNIFORMS ---
export const HORIZON_UNIFORMS = {
  uHorizonColor: { value: new THREE.Color(0x4488ff) },
  uHorizonStrength: { value: 0.15 },
  uHorizonPower: { value: 7.0 },
};

export const CLOUD_UNIFORMS = {
  uCloudHazeMultiplier: { value: 1.0 },
};

export const WATER_UNIFORMS = {
  uTime: { value: 0.0 },
  uWaveSpeed: { value: 1.0 },
  uWaveHeight: { value: 0.05 },
};

export const BIOMES = {
  terra: {
    waterColor: 0x22aaff,
    atmosphereColor: 0x4488ff,
    treeColor: 0x2a7a28,
    trunkColor: 0x5d4037,
    rockColor: 0x888888,
    colors: [
      { h: 0.0, c: 0x1a4dad },
      { h: 0.2, c: 0x2b65d9 },
      { h: 0.25, c: 0xe6d991 },
      { h: 0.45, c: 0x59c93c },
      { h: 0.7, c: 0x2a7a28 },
      { h: 0.9, c: 0x6e6e6e },
      { h: 1.0, c: 0xffffff },
    ],
  },
  desert: {
    waterColor: 0x20b2aa,
    atmosphereColor: 0xffccaa,
    treeColor: 0x44aa44,
    trunkColor: 0x44aa44,
    rockColor: 0x8b4513,
    colors: [
      { h: 0.0, c: 0xcc7a00 },
      { h: 0.3, c: 0xffa500 },
      { h: 0.5, c: 0xffd700 },
      { h: 0.7, c: 0x8b4513 },
      { h: 0.9, c: 0xcd853f },
      { h: 1.0, c: 0xffefd5 },
    ],
  },
  ice: {
    waterColor: 0x111122,
    atmosphereColor: 0xaaddff,
    treeColor: 0xdbeef9,
    trunkColor: 0x555555,
    rockColor: 0x53789e,
    colors: [
      { h: 0.0, c: 0x2e3f57 },
      { h: 0.2, c: 0x53789e },
      { h: 0.4, c: 0x88aacc },
      { h: 0.6, c: 0xb0d0ef },
      { h: 0.8, c: 0xdbeef9 },
      { h: 1.0, c: 0xffffff },
    ],
  },
  alien: {
    waterColor: 0x8800aa,
    atmosphereColor: 0xff00ff,
    treeColor: 0x00ffaa,
    trunkColor: 0x440066,
    rockColor: 0xcc00ff,
    colors: [
      { h: 0.0, c: 0x220033 },
      { h: 0.2, c: 0x440066 },
      { h: 0.3, c: 0xff00aa },
      { h: 0.6, c: 0x00ffaa },
      { h: 0.8, c: 0x330044 },
      { h: 1.0, c: 0xcc00ff },
    ],
  },
  molten: {
    waterColor: 0xff2200,
    atmosphereColor: 0xff5500,
    treeColor: 0x222222,
    trunkColor: 0x111111,
    rockColor: 0x333333,
    colors: [
      { h: 0.0, c: 0x330000 },
      { h: 0.3, c: 0x550000 },
      { h: 0.4, c: 0x222222 },
      { h: 0.6, c: 0x444444 },
      { h: 0.85, c: 0x111111 },
      { h: 1.0, c: 0xaa0000 },
    ],
  },
  barren: {
    waterColor: 0x000000,
    atmosphereColor: 0x888888,
    treeColor: 0x555555,
    trunkColor: 0x333333,
    rockColor: 0x777777,
    colors: [
      { h: 0.0, c: 0x1a1a1a },
      { h: 0.3, c: 0x333333 },
      { h: 0.5, c: 0x555555 },
      { h: 0.7, c: 0x777777 },
      { h: 0.9, c: 0x999999 },
      { h: 1.0, c: 0xbbbbbb },
    ],
  },
};

export const PRESET_KEY = "planet_forge_presets";

export const DEFAULT_PARAMS = {
  biome: "terra",
  seed: 0,
  detail: 30,
  scale: 1.5,
  height: 1.2,
  waterLevel: 0.2,
  rotationSpeed: 0.0,
  cloudSpeed: 0.1,
  sunSpeed: 0.1,
  nightDarkness: 0.8,
  haloStrength: 0.6,
  sunReddening: 1.8,
  sunBrightness: 5.5,
  atmosphereOpacity: 0.05,
  atmoScale: 1.75,
  atmoCount: 5,
  sunsetOffset: 0.45,
  sunsetWidth: 0.31,
  hazeEnabled: true,
  hazeSpread: 1.0,
  hazeIntensity: 0.7,
  hazeFalloff: 30.0,
  cloudHazeMultiplier: 2.0,
  cloudCoverage: 20,
  cloudAltitude: 0.4,
  cloudSize: 1.0,
  vegetationDensity: 50,
  starDensity: 5.0,
  horizonStrength: 0.15,
  horizonPower: 7.0,
  waveSpeed: 1.0,
  waveHeight: 0.05,
  cycleFlip: true,
  solarEnabled: true,
  sunDistortion: 0.006,
  atmoDistortion: 0.006,
  colorVibrance: 2.0,
  sunriseTemp: 0.8,
  sunsetTemp: 0.55,
  sunriseTintStrength: 0.5,
  sunsetTintStrength: 0.8,
  tintBrightnessDrop: 0.5,
};

export const PARAMS = { ...DEFAULT_PARAMS };
