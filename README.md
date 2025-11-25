# Planet Forge - Low Poly Planet Generator

A powerful, browser-based procedural planet generator built with **Three.js**. Create, customize, and explore low-poly worlds with dynamic biomes, atmospheric effects, and living ecosystems.

## Features

### 🌍 Procedural Generation
- **Simplex Noise Terrain**: Infinite variations of terrain using seeded random generation.
- **Dynamic Biomes**: Switch instantly between distinct biomes:
  - **Terra**: Earth-like forests and oceans.
  - **Desert**: Sandy dunes and oases.
  - **Ice**: Frozen wastelands and glaciers.
  - **Alien**: Purple skies and strange flora.
  - **Molten**: Volcanic landscapes with animated lava.
  - **Barren**: Moon-like desolate rocks.
- **Customizable Detail**: Adjust mesh resolution, roughness, and relief height in real-time.

### 🌤️ Atmospheric & Solar Effects
- **Day/Night Cycle**: Fully simulated rotating sun with dynamic lighting.
- **Atmospheric Scattering**: Realistic horizon fog, sunset gradients, and atmospheric haze.
- **Volumetric Clouds**: Procedural cloud layers that react to lighting (rim lighting, forward scattering) and fade during the night cycle.
- **Solar Distortion**: Heat haze and vertex distortion effects near the sun.

### 💧 Dynamic Water & Lava
- **Living Oceans**: Shader-based water with wave interference patterns and depth-based coloring.
- **Lava Flows**: Animated lava shaders with bubbling effects and pulsating glow for the Molten biome.

### 🌲 Ecosystems
- **Vegetation**: Procedurally placed trees and rocks based on biome rules and altitude.
- **Inhabitants**: Meet **Sam** (the rat) and **Älgen** (the elk), two characters that roam the planet surface.

### 🛠️ Powerful UI
- **Preset Manager**: Save and load your favorite planet configurations.
- **Fine-Tuning**: Over 40 sliders to control everything from cloud coverage to sun temperature.
- **Randomizer**: Generate completely new worlds with a single click.

## Installation & Usage

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd LowPolyPlanetGenerator
    ```

2.  **Run locally**:
    Because this project uses ES6 modules, you need a local web server to run it (opening `index.html` directly in the file explorer will not work due to CORS policies).

    You can use Python's built-in server:
    ```bash
    # Python 3
    python -m http.server
    ```
    Or Node.js `http-server`:
    ```bash
    npx http-server
    ```

3.  **Open in Browser**:
    Navigate to `http://localhost:8000` (or whatever port your server uses).

## Project Structure

- **`index.html`**: Main entry point and UI structure.
- **`style.css`**: Styling for the UI overlay.
- **`js/`**:
  - **`main.js`**: Core application logic, Three.js scene setup, and render loop.
  - **`shaders.js`**: Custom GLSL shader definitions for water, atmosphere, clouds, and sun.
  - **`config.js`**: Configuration constants, biome definitions, and default parameters.
  - **`ui.js`**: DOM element mapping and UI event handling.
  - **`utils.js`**: Utility functions including Simplex Noise implementation.

## Controls

- **Orbit**: Left Click + Drag
- **Zoom**: Scroll Wheel
- **Pan**: Right Click + Drag
- **Toggle UI**: Click the icon in the top-right corner.
- **Pause Animation**: Press `P`.

## Technical Details

The project utilizes **Three.js** for 3D rendering. Key technical implementations include:

- **Custom Shaders**: Extensive use of `ShaderMaterial` and `onBeforeCompile` to inject custom GLSL code into standard Three.js materials, allowing for features like horizon fog and vertex displacement without writing full custom shaders from scratch.
- **Instanced Rendering**: Vegetation and rocks use `THREE.InstancedMesh` for high performance even with thousands of objects.
- **Noise Algorithms**: Simplex noise is used for terrain generation, vegetation distribution, and cloud patterns.

## Credits

Developed as a "Planet Forge" tool for generating stylized low-poly worlds.
