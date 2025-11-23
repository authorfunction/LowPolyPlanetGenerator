import { HORIZON_UNIFORMS, WATER_UNIFORMS } from "./config.js";

// --- SHADER INJECTION FUNCTIONS ---

// 1. Standard Horizon Fog (For Land, Trees, Clouds)
export function setupHorizonShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHorizonColor = HORIZON_UNIFORMS.uHorizonColor;
    shader.uniforms.uHorizonStrength = HORIZON_UNIFORMS.uHorizonStrength;
    shader.uniforms.uHorizonPower = HORIZON_UNIFORMS.uHorizonPower;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
        #include <common>
        varying vec3 vWorldPositionFog;
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
        #include <worldpos_vertex>
        vWorldPositionFog = worldPosition.xyz;
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `
        #include <common>
        varying vec3 vWorldPositionFog;
        uniform vec3 uHorizonColor;
        uniform float uHorizonStrength;
        uniform float uHorizonPower;
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `
        #include <dithering_fragment>
        vec3 hNormal = normalize(vWorldPositionFog);
        vec3 hView = normalize(cameraPosition - vWorldPositionFog);
        float hDot = max(0.0, dot(hNormal, hView));
        float hFactor = 1.0 - hDot;
        hFactor = pow(hFactor, uHorizonPower);
        float hIntensity = hFactor * uHorizonStrength;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizonColor, hIntensity);
      `,
    );
  };
}

// 2. Water Shader (Horizon Fog + Dynamic Waves)
export function setupWaterShader(material) {
  material.onBeforeCompile = (shader) => {
    // Include all Uniforms
    shader.uniforms.uHorizonColor = HORIZON_UNIFORMS.uHorizonColor;
    shader.uniforms.uHorizonStrength = HORIZON_UNIFORMS.uHorizonStrength;
    shader.uniforms.uHorizonPower = HORIZON_UNIFORMS.uHorizonPower;

    shader.uniforms.uTime = WATER_UNIFORMS.uTime;
    shader.uniforms.uWaveSpeed = WATER_UNIFORMS.uWaveSpeed;
    shader.uniforms.uWaveHeight = WATER_UNIFORMS.uWaveHeight;

    // Vertex Logic: Add Displacement
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
        #include <common>
        uniform float uTime;
        uniform float uWaveSpeed;
        uniform float uWaveHeight;
        varying vec3 vWorldPositionFog;
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
        #include <begin_vertex>

        // Simple Organic Wave Interference
        float wave = sin(position.x * 3.0 + uTime * uWaveSpeed) *
                     sin(position.y * 3.0 + uTime * uWaveSpeed * 0.8) *
                     cos(position.z * 3.0 + uTime * uWaveSpeed * 0.5);

        // Displace along normal
        transformed += normal * wave * uWaveHeight;
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
        #include <worldpos_vertex>
        vWorldPositionFog = worldPosition.xyz;
      `,
    );

    // Fragment Logic: Apply Horizon Fog (Same as before)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `
        #include <common>
        varying vec3 vWorldPositionFog;
        uniform vec3 uHorizonColor;
        uniform float uHorizonStrength;
        uniform float uHorizonPower;
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `
        #include <dithering_fragment>
        vec3 hNormal = normalize(vWorldPositionFog);
        vec3 hView = normalize(cameraPosition - vWorldPositionFog);
        float hDot = max(0.0, dot(hNormal, hView));
        float hFactor = 1.0 - hDot;
        hFactor = pow(hFactor, uHorizonPower);
        float hIntensity = hFactor * uHorizonStrength;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizonColor, hIntensity);
      `,
    );
  };
}

// --- CUSTOM SUN SHADER DEFINITIONS ---
export const SUN_VERTEX = `
    uniform float uTime;
    uniform float uSunSide;
    uniform float uSunsetFactor;
    uniform float uVertexDistortion;
    uniform float uSolarEnabled;
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
        vUv = uv;
        vNormal = normal;
        vec3 pos = position;

        // Apply vertex distortion only if enabled and on sunset side (uSunSide > 0)
        if (uSolarEnabled > 0.5 && uSunSide > 0.0) {
            float noise = sin(pos.y * 3.0 + uTime * 5.0) * sin(pos.x * 3.0 + uTime * 4.0) * sin(pos.z * 3.0 + uTime * 3.0);
            // Use dedicated vertex distortion uniform
            pos += normal * noise * uVertexDistortion * 50.0 * uSunsetFactor;
        }

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

export const SUN_FRAGMENT = `
    uniform vec3 uColor; // Base yellow/white
    uniform vec3 uTint;  // Calculated tint (Sunrise/Sunset color)
    uniform float uMixAmount; // How much to tint
    uniform float uBrightness;
    uniform float uSolarEnabled;

    void main() {
        vec3 finalColor = uColor;

        // Mix base color with tint if solar effects enabled
        if (uSolarEnabled > 0.5) {
           finalColor = mix(uColor, uTint, uMixAmount);
        }

        // Output
        gl_FragColor = vec4(finalColor * uBrightness, 1.0);
    }
`;

// --- ATMOSPHERE SHADERS ---
export const ATMO_VERTEX = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`;

export const ATMO_FRAGMENT = `
    uniform vec3 sunPosition;
    uniform vec3 dayColor;
    uniform vec3 sunsetColor;
    uniform vec3 sunriseColor;
    uniform float uOpacity;
    uniform float uHaloStrength;
    uniform float uSunsetOffset;
    uniform float uSunsetWidth;
    uniform float uSunsetFactor;
    uniform float uHazeSpread;
    uniform float uHazeIntensity;
    uniform float uHazeFalloff;
    uniform float uSunSide;
    uniform float uTime;
    uniform float uAtmoDistortion;
    uniform float uVibrance;
    uniform float uSolarEnabled;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
        vec3 n = normalize(vNormal);
        vec3 s = normalize(sunPosition);
        vec3 v = normalize(cameraPosition - vWorldPosition);

        float sunAngle = dot(n, s);
        vec3 finalColor = dayColor;

        // Calculate Sun-View Alignment EARLY to use for radial distortion
        float sunViewDot = dot(-v, s);

        // --- MODE SELECTION ---
        vec3 targetHorizonColor = sunsetColor;
        float heatWave = 0.0;
        float sharpness = 1.0;
        float vibrance = 1.0;

        if (uSolarEnabled > 0.5) {
            // Solar Effects ON
            float sideMix = smoothstep(-0.5, 0.5, uSunSide);
            targetHorizonColor = mix(sunriseColor, sunsetColor, sideMix);
            vibrance = uVibrance;

            if (uSunSide > 0.2) {
                // --- RADIAL HEAT HAZE ---
                float distFromSun = 1.0 - clamp(sunViewDot, 0.0, 1.0);
                heatWave = sin(distFromSun * 150.0 - uTime * 8.0) * uAtmoDistortion * max(0.0, uSunSide);
            }
            sharpness = mix(1.5, 0.8, sideMix);
        } else {
            // Solar Effects OFF (Classic Mode)
            targetHorizonColor = sunsetColor;
            heatWave = 0.0;
            sharpness = 1.0;
            vibrance = 1.0;
        }

        // Apply Vibrance
        targetHorizonColor *= vibrance;

        // Sunset Band Logic
        float offsetAngle = sunAngle - uSunsetOffset;
        float sunsetIntensity = 1.0 - smoothstep(0.0, uSunsetWidth, abs(offsetAngle));
        finalColor = mix(finalColor, targetHorizonColor, sunsetIntensity);

        float dayAlpha = smoothstep(-0.2 + uSunsetOffset, 0.1 + uSunsetOffset, sunAngle);

        // View/Fresnel Logic
        float viewDot = abs(dot(n, v));
        float fresnel = 1.0 - viewDot;
        fresnel = pow(fresnel, uHazeSpread * sharpness);

        // Apply heat wave distortion to sun alignment check
        float sunCheck = sunViewDot + heatWave;

        float falloffFactor = (sunCheck + 1.0) * 0.5;
        falloffFactor = pow(falloffFactor, uHazeFalloff);

        float hazeComponent = fresnel * uHazeIntensity * falloffFactor;

        float sunHalo = smoothstep(0.85, 1.0, sunCheck);
        sunHalo = pow(sunHalo, 3.0);

        vec3 dayHalo = vec3(1.0, 1.0, 0.9);
        vec3 setHalo = targetHorizonColor * 1.2;
        vec3 currentHaloColor = mix(dayHalo, setHalo, uSunsetFactor);

        finalColor = mix(finalColor, currentHaloColor, sunHalo * uHaloStrength);

        float alpha = (uOpacity + hazeComponent) * dayAlpha;
        alpha += sunHalo * uHaloStrength * 0.6;

        if (alpha < 0.01) discard;

        gl_FragColor = vec4(finalColor, alpha);
    }
`;

// --- CLOUD SHADERS ---

export const CLOUD_VERTEX = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;

    uniform float uTime;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;

        // Calculate world position for height-based logic if needed
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const CLOUD_FRAGMENT = `
    uniform vec3 uBaseColor;
    uniform float uOpacity;
    uniform vec3 sunPosition;

    uniform vec3 uSunColor;
    uniform vec3 uAmbientColor;

    uniform vec3 uHorizonColor;
    uniform float uHorizonStrength;
    uniform float uHorizonPower;
    uniform float uCloudHazeMultiplier;
    uniform float uCloudLightWrap;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        vec3 sunDir = normalize(sunPosition);

        // --- 1. PLANETARY SHADOW MASK (The Fix) ---
        // Calculate where this cloud is relative to the planet's day/night cycle
        vec3 planetNormal = normalize(vWorldPosition);
        float globalAlignment = dot(planetNormal, sunDir);

        // Create a mask that fades out clouds on the night side
        // We use the same Wrap slider to control how far the "Day" extends
        // If Wrap is -0.5, this mask cuts off clouds even before they hit the middle
        float globalMask = smoothstep(-uCloudLightWrap - 0.1, -uCloudLightWrap + 0.4, globalAlignment);

        // --- 2. Local Diffuse Lighting ---
        float NdotL = dot(normal, sunDir);
        float lightingTerm = NdotL + uCloudLightWrap;
        float lightIntensity = smoothstep(0.0, 0.4, lightingTerm);

        // APPLY THE MASK: Force sun intensity to 0 on the dark side
        lightIntensity *= globalMask;

        vec3 bodyColor = mix(uAmbientColor, uSunColor, lightIntensity);

        // --- 3. Rim Lighting ---
        float fresnel = 1.0 - abs(dot(viewDir, normal));
        fresnel = pow(fresnel, 1.5);

        vec3 sunRim = uSunColor * fresnel * 0.8;
        vec3 ambRim = uAmbientColor * fresnel * 0.5;

        // Mix rims based on the masked intensity
        vec3 finalRim = mix(ambRim, sunRim, lightIntensity);

        // --- 4. Forward Scattering ---
        float sunViewDot = dot(viewDir, sunDir);
        float forwardScatter = max(0.0, sunViewDot);
        forwardScatter = pow(forwardScatter, 6.0);

        // Also mask the scatter so night clouds don't glow from behind
        vec3 scatterColor = uSunColor * forwardScatter * 2.0 * globalMask;

        // Combine
        vec3 finalColor = bodyColor + finalRim + scatterColor;

        // --- 5. Atmospheric Haze ---
        vec3 hNormal = normalize(vWorldPosition);
        vec3 hView = normalize(cameraPosition - vWorldPosition);
        float hDot = max(0.0, dot(hNormal, hView));
        float hFactor = 1.0 - hDot;
        hFactor = pow(hFactor, uHorizonPower);
        float hIntensity = hFactor * uHorizonStrength * uCloudHazeMultiplier;
        hIntensity = min(1.0, hIntensity);

        finalColor = mix(finalColor, uHorizonColor, hIntensity);

        gl_FragColor = vec4(finalColor, uOpacity);
    }
`;
