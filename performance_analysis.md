# Performance Analysis & Optimization Report

## Executive Summary
The application currently runs well on powerful devices but contains several architectural choices that may cause frame drops on lower-end hardware or mobile devices. The primary bottlenecks are frequent geometry recreation and CPU-heavy animation loops.

## Critical Bottlenecks

### 1. Geometry Recreation (`generatePlanet`)
**Severity: High**
- **Issue**: The `generatePlanet()` function completely disposes of and recreates the planet, water, atmosphere, and cloud meshes every time a parameter changes.
- **Impact**: Causes significant garbage collection (GC) pauses and frame stutters during interaction.
- **Recommendation**:
  - **Reuse Geometry**: Instead of `new THREE.IcosahedronGeometry`, keep the existing geometry and only update the `position` attribute array.
  - **Attribute Updates**: Use `geometry.attributes.position.needsUpdate = true` after modifying vertices.

### 2. CPU-Bound Cloud Animation
**Severity: High**
- **Issue**: The `animate()` loop iterates through every single cloud object (hundreds of meshes) every frame. It calculates Simplex noise on the CPU for each cloud to drive the "bobbing" and "scaling" effects.
- **Impact**: High CPU usage, limiting the number of clouds possible.
- **Recommendation**:
  - **Move to Vertex Shader**: The cloud shader already receives `uTime`. The bobbing logic (`sin(time + offset)`) should be moved to `CLOUD_VERTEX` shader.
  - **Attributes**: Pass random offsets (for phase differences) as a vertex attribute or instance attribute.

### 3. Object Count & Instancing
**Severity: Medium**
- **Issue**: Clouds are implemented as a `THREE.Group` containing hundreds of individual `THREE.Mesh` objects (Main puff + children).
- **Impact**: High draw call count.
- **Recommendation**:
  - **Use `THREE.InstancedMesh`**: Since all cloud puffs use the same geometry (Dodecahedron) and material, they are perfect candidates for instancing. This would reduce draw calls from ~500+ to 1.

### 4. Shadow Map Resolution
**Severity: Low/Medium**
- **Issue**: Shadow map size is set to `2048x2048` with `PCFSoftShadowMap`.
- **Impact**: High VRAM usage and GPU processing time.
- **Recommendation**:
  - **Dynamic Quality**: Allow users to toggle shadow quality (e.g., Low=512, Med=1024, High=2048).
  - **Bake Static Shadows**: For static objects (like trees on the planet), shadows could potentially be baked or approximated if the sun didn't move, but since the sun moves, this is harder.

## Quick Wins (Low Effort, High Impact)

1.  **Optimize `animate` Loop**:
    - Stop calculating Simplex noise for clouds in JavaScript. Even a simple `Math.sin` in JS is better than 3 calls to `simplex.noise` per cloud per frame.
    - **Action**: Replace noise-based cloud scaling with a simple sine wave in the vertex shader.

2.  **Throttle UI Updates**:
    - The UI sliders trigger `updatePlanet()` on every `input` event.
    - **Action**: Debounce the slider inputs so `updatePlanet` only runs once every 100ms or on `change` (mouse up) instead of `input`.

## Long-Term Architectural Improvements

- **Worker Threads**: Move the heavy terrain generation (Simplex noise calculations for the planet surface) to a Web Worker to prevent the main thread from freezing during generation.
- **LOD (Level of Detail)**: Implement a dynamic LOD system that reduces geometry detail when the camera is far away.
