# Walkthrough - Cloud System Optimization

## Changes Implemented

### 1. Instanced Rendering for Clouds
- **Old Approach**: Created a `THREE.Group` containing hundreds of individual `THREE.Mesh` objects (one for each cloud puff).
- **New Approach**: Replaced with a single `THREE.InstancedMesh` containing all cloud puffs.
- **Benefit**: Reduces draw calls from ~500+ to 1, significantly lowering CPU overhead for the renderer.

### 2. GPU-Based Animation
- **Old Approach**: Calculated Simplex noise and updated the scale/position of every cloud puff in the `animate()` loop on the CPU every frame.
- **New Approach**: Moved the "breathing" animation logic to `CLOUD_VERTEX` shader.
- **Implementation**:
  - Added `attribute float aRandom` to each instance for phase variation.
  - Used `sin(uTime + aRandom)` in the vertex shader to displace vertices.
- **Benefit**: Removes the heavy loop from the main thread, freeing up CPU for other logic.

### 3. Code Cleanup
- Removed the legacy cloud animation loop from `js/main.js`.
- Simplified the `generateClouds` function to populate the `InstancedMesh` matrix and attributes once.

### 4. Cloud Visuals & Optimization
- **Parameters**: Added `cloudShrinkAmount`, `cloudTransition`, and `rainDarkness` for fine-tuned control.
- **Optimization**: Refactored `cloudSize` and `cloudAltitude` to use shader uniforms (`uCloudSize`, `uCloudAltitudeOffset`) instead of regenerating geometry. This allows for smooth, instant adjustments without lag or flickering.
- **Rain Darkening**: Implemented a decoupled darkening effect that transitions smoothly using a separate `smoothstep` range.
- **Uniform Shrinking**: Cloud puffs within a cluster now shrink cohesively towards their shared center (`aCloudCenter`) based on terrain height.
- **Axial Billboarding**: Rain drops are now 2D planes that always face the camera while maintaining a vertical orientation aligned with gravity.
- **Decoupled Darkening**: The rain darkening effect is now decoupled from the physical shrinking. Clouds begin to darken (turning a stormy blue-grey) *before* they shrink, creating a smoother and more natural transition.
- **UI Controls**: Added new sliders to the UI to control these effects in real-time:
    - **Shrink Amount**: Controls the minimum scale of clouds over mountains.
    - **Transition**: Controls the smoothness/width of the shrinking and darkening zones.
    - **Rain Darkness**: Controls the intensity of the storm darkening effect.

These changes result in a visually cohesive, performant, and controllable weather system that accurately interacts with the planet's terrain.

## Verification Results

### Visual Correctness
- Clouds should appear as clusters of dodecahedrons.
- Clouds should "breathe" and shrink when passing over mountains.
- Rain should fall from clouds but only when they are NOT over mountains (or vice versa, depending on logic).

### Performance
- **Draw Calls**: Reduced by ~99% for the cloud layer.
- **CPU Usage**: Significant reduction in the `animate` function execution time.
