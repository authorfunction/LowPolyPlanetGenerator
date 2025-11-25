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

// --- SIMPLEX NOISE GLSL ---
// Description : Array and textureless GLSL 2D/3D/4D Simplex Noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//

const SNOISE_GLSL = `
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
{
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;

  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}
`;

export const CLOUD_VERTEX = SNOISE_GLSL + `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;

    uniform float uTime;
    uniform float uPlanetScale;
    uniform float uPlanetHeight;
    uniform float uCloudRotation;
    uniform float uCloudShrinkAmount; // <--- ADDED
    uniform float uCloudTransition;   // <--- ADDED
    
    // Instance Attributes (automatically available when using InstancedMesh)
    // attribute mat4 instanceMatrix; 
    
    // Custom Instance Attributes
    attribute float aRandom; // For offset/phase
    attribute vec3 aCloudCenter;
    
    varying float vRainFactor; // <--- ADDED to pass to fragment

    void main() {
        vUv = uv;
        
        // 1. Calculate Planet Local Position of Cloud Center for Noise
        float c = cos(uCloudRotation);
        float s = sin(uCloudRotation);
        mat3 rotY = mat3(
            c, 0.0, s,
            0.0, 1.0, 0.0,
            -s, 0.0, c
        );
        vec3 noisePos = rotY * aCloudCenter;
        vec3 dir = normalize(noisePos);
        
        // 2. Calculate Noise
        vec3 p = dir * 4.0;
        
        float n1 = snoise(p * uPlanetScale * 0.1);
        float n2 = snoise(p * uPlanetScale * 0.3) * 0.5;
        float n3 = snoise(p * uPlanetScale * 1.0) * 0.2;
        
        float noiseVal = max(-0.5, n1 + n2 + n3);
        float displacement = 1.0 + noiseVal * uPlanetHeight * 0.2;
        float surfaceH = (displacement * 4.0 - 4.0) / (uPlanetHeight * 0.8);
        
        // 3. Calculate Shrink Factor
        // Use uCloudTransition for smoothstep width
        float halfWidth = uCloudTransition * 0.5;
        float tMin = 0.6 - halfWidth;
        float tMax = 0.6 + halfWidth;
        
        // Shrink Factor (Physical size change)
        float shrinkT = smoothstep(tMin, tMax, surfaceH);
        
        // Rain/Darkness Factor (Visual color change)
        // Decouple: Make it smoother/wider than the shrinking
        // Start darkening earlier (tMin - 0.4) and finish later (tMax + 0.4)
        float rainT = smoothstep(tMin - 0.4, tMax + 0.4, surfaceH);
        
        vRainFactor = rainT; // Pass to fragment for darkening
        
        // Shrink based on uCloudShrinkAmount
        float targetScale = 1.0 - uCloudShrinkAmount;
        float shrinkFactor = mix(1.0, targetScale, shrinkT);
        
        // 4. Apply Shrinking (Towards Cloud Center)
        // We calculate the vertex position in local space (relative to cloudsMesh)
        vec4 localInstancePos = instanceMatrix * vec4(position, 1.0);
        
        // Calculate vector from cloud center to this vertex
        vec3 offset = localInstancePos.xyz - aCloudCenter;
        
        // Scale the offset
        vec3 shrunkPos = aCloudCenter + offset * shrinkFactor;
        
        // 5. Breathing Animation (Optional, apply to shrunkPos)
        float breathe = 1.0 + sin(uTime * 2.0 + aRandom * 6.0) * 0.05;
        // Apply breathing relative to center as well
        shrunkPos = aCloudCenter + (shrunkPos - aCloudCenter) * breathe;

        // 6. Final Position
        vec4 mvPosition = modelViewMatrix * vec4(shrunkPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        vViewPosition = -mvPosition.xyz;
        vWorldPosition = (modelMatrix * vec4(shrunkPos, 1.0)).xyz;

        // Normal needs to be transformed by the instance rotation
        vec3 transformedNormal = mat3(instanceMatrix) * normal;
        vNormal = normalize(normalMatrix * transformedNormal);
    }
`;

export const RAIN_VERTEX = SNOISE_GLSL + `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uPlanetScale;
    uniform float uPlanetHeight;
    uniform float uCloudRotation;
    uniform float uCloudTransition; // <--- ADDED
    
    attribute float aSpeed;
    attribute float aRandom;
    attribute vec3 aCloudCenter;

    void main() {
        vUv = uv;
        
        // 1. Calculate World Position of Drop Center
        // We start at the instance origin (0,0,0 local)
        vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); 
        vec3 worldPos = (modelMatrix * instancePos).xyz;
        
        // 2. Check Terrain (using Cloud Center in Planet Local Space)
        float c = cos(uCloudRotation);
        float s = sin(uCloudRotation);
        mat3 rotY = mat3(
            c, 0.0, s,
            0.0, 1.0, 0.0,
            -s, 0.0, c
        );
        vec3 noisePos = rotY * aCloudCenter;
        vec3 dir = normalize(noisePos);
        vec3 p = dir * 4.0;
        
        float n1 = snoise(p * uPlanetScale * 0.1);
        float n2 = snoise(p * uPlanetScale * 0.3) * 0.5;
        float n3 = snoise(p * uPlanetScale * 1.0) * 0.2;
        float noiseVal = max(-0.5, n1 + n2 + n3);
        float displacement = 1.0 + noiseVal * uPlanetHeight * 0.2;
        float surfaceH = (displacement * 4.0 - 4.0) / (uPlanetHeight * 0.8);
        
        // 3. Visibility Logic
        // Match Cloud Transition
        float halfWidth = uCloudTransition * 0.5;
        float tMin = 0.6 - halfWidth;
        float tMax = 0.6 + halfWidth;
        
        float rainFactor = smoothstep(tMin, tMax, surfaceH);
        
        if (rainFactor <= 0.01) {
            gl_Position = vec4(0.0);
            return;
        }
        
        // 4. Animation (Falling)
        float fallSpeed = aSpeed * 3.0;
        float fallOffset = mod(uTime * fallSpeed + aRandom * 10.0, 2.5);
        
        // Move towards planet center (Radial Inward)
        vec3 dropUp = normalize(worldPos); // Points AWAY from planet center
        vec3 animatedWorldPos = worldPos - dropUp * fallOffset;
        
        // 5. AXIAL BILLBOARDING
        // We want the drop to point along 'dropUp' (or -dropUp)
        // And face the camera.
        
        vec3 viewDir = normalize(cameraPosition - animatedWorldPos);
        
        // Ensure viewDir and dropUp are not parallel
        // If they are, cross product is zero.
        // This happens if looking straight down at the drop.
        // Fallback: use a default right vector.
        vec3 right = cross(viewDir, dropUp);
        if (length(right) < 0.001) {
            right = vec3(1.0, 0.0, 0.0);
        } else {
            right = normalize(right);
        }
        
        // Construct the vertex position
        // position.x is width, position.y is height
        float scale = rainFactor;
        
        // Note: PlaneGeometry is XY plane.
        // We map X to 'right' and Y to 'dropUp'.
        
        vec3 finalPos = animatedWorldPos 
            + right * position.x * scale 
            + dropUp * position.y * scale;
            
        gl_Position = projectionMatrix * viewMatrix * vec4(finalPos, 1.0);
    }
`;

export const RAIN_FRAGMENT = `
    varying vec2 vUv;
    void main() {
        gl_FragColor = vec4(0.6, 0.8, 1.0, 0.6); // Light Blue
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
    uniform float uRainDarkness; // <--- ADDED

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;
    varying float vRainFactor; // <--- ADDED

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
        
        // --- Rain Darkening ---
        // Use a fixed dark storm color for maximum contrast
        vec3 stormColor = vec3(0.05, 0.05, 0.1); 
        
        // Mix based on rain factor and user setting
        // We boost the factor slightly to ensure it hits full darkness
        float mixFactor = clamp(vRainFactor * uRainDarkness * 1.5, 0.0, 1.0);
        
        finalColor = mix(finalColor, stormColor, mixFactor);

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
// --- LAVA SHADER ---

export const LAVA_VERTEX = `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float uTime;
    uniform float uSpeed;

    void main() {
        vUv = uv;
        vPosition = position;

        // Add a slow "breathing" movement to the surface
        vec3 pos = position;
        pos.y += sin(pos.x * 5.0 + uTime * uSpeed) * 0.05;
        pos.y += cos(pos.z * 5.0 + uTime * uSpeed * 0.8) * 0.05;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

export const LAVA_FRAGMENT = `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uBrightness;

    varying vec2 vUv;
    varying vec3 vPosition;

    void main() {
        // Create bubbling pattern using overlapping sine waves
        float n1 = sin(vPosition.x * 8.0 + uTime * uSpeed);
        float n2 = sin(vPosition.z * 6.0 - uTime * uSpeed * 1.5);
        float n3 = sin((vPosition.x + vPosition.z) * 4.0 + uTime * uSpeed * 0.5);

        float bubble = n1 + n2 + n3;

        // Colors: Dark Magma to Bright Yellow
        vec3 darkColor = vec3(0.3, 0.0, 0.0);
        vec3 brightColor = vec3(1.0, 0.8, 0.0);
        vec3 medColor = vec3(1.0, 0.2, 0.0);

        // Mix based on "height" of the wave
        vec3 finalColor = mix(darkColor, medColor, smoothstep(-2.0, 0.5, bubble));
        finalColor = mix(finalColor, brightColor, smoothstep(0.5, 2.0, bubble));

        // Add pulsating glow
        float pulse = 1.0 + sin(uTime * 2.0) * 0.2;

        gl_FragColor = vec4(finalColor * uBrightness * pulse, 1.0);
    }
`;
