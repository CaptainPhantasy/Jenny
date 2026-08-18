import * as THREE from 'three';

// This shader replicates the logic of TSL (Three Shading Language) nodes
// using standard GLSL for maximum compatibility in this standalone React environment.

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uSteps;
  uniform float uPixelSize;
  uniform vec3 uColor1; // Shadow
  uniform vec3 uColor2; // Midtone
  uniform vec3 uColor3; // Highlight
  uniform float uEdgeOnly;
  uniform float uEdgeThreshold;
  uniform float uAberration;
  uniform vec2 uResolution;
  
  varying vec2 vUv;

  // Simple luminosity function
  float getLuminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    // 1. Pixelation Logic (UV Glitch)
    vec2 uv = vUv;
    // Check if pixelation is active (threshold slightly below 2048 default)
    if (uPixelSize < 2000.0) {
       float dx = 1.0 / uPixelSize;
       float dy = 1.0 / uPixelSize * (uResolution.x / uResolution.y);
       uv = vec2(
         floor(vUv.x / dx) * dx,
         floor(vUv.y / dy) * dy
       );
    }

    vec4 texColor;
    if (uAberration > 0.0) {
       float r = texture2D(uTexture, uv + vec2(uAberration, 0.0)).r;
       float g = texture2D(uTexture, uv).g;
       float b = texture2D(uTexture, uv - vec2(uAberration, 0.0)).b;
       texColor = vec4(r, g, b, 1.0);
    } else {
       texColor = texture2D(uTexture, uv);
    }

    // 2. Posterization Logic
    float lum = getLuminance(texColor.rgb);
    
    // Create 'steps' - effectively floor(lum * steps) / steps
    // We adjust denominator to allow for full range
    float stepped = floor(lum * uSteps) / (uSteps - 1.0);
    stepped = clamp(stepped, 0.0, 1.0);

    // 3. Palette Re-mapping (Tri-Color Map)
    vec3 finalColor;
    
    // Mix based on intensity
    if (stepped < 0.5) {
      // Interpolate between Shadow (Color1) and Midtone (Color2)
      finalColor = mix(uColor1, uColor2, stepped * 2.0);
    } else {
      // Interpolate between Midtone (Color2) and Highlight (Color3)
      finalColor = mix(uColor2, uColor3, (stepped - 0.5) * 2.0);
    }

    // 4. Sobel Edge Detection (for Coloring Book mode)
    if (uEdgeOnly > 0.5) {
      float w = 1.0 / uResolution.x;
      float h = 1.0 / uResolution.y;
      
      // Sample neighbors for edge detection
      // We run edge detection on the POSTERIZED result to get clean shapes
      float t = getLuminance(texture2D(uTexture, uv + vec2(0.0, -h)).rgb);
      float b = getLuminance(texture2D(uTexture, uv + vec2(0.0, h)).rgb);
      float l = getLuminance(texture2D(uTexture, uv + vec2(-w, 0.0)).rgb);
      float r = getLuminance(texture2D(uTexture, uv + vec2(w, 0.0)).rgb);
      
      // Also check diagonals for cleaner lines
      float tl = getLuminance(texture2D(uTexture, uv + vec2(-w, -h)).rgb);
      float tr = getLuminance(texture2D(uTexture, uv + vec2(w, -h)).rgb);
      float bl = getLuminance(texture2D(uTexture, uv + vec2(-w, h)).rgb);
      float br = getLuminance(texture2D(uTexture, uv + vec2(w, h)).rgb);

      // Sobel Kernels
      float dX = tr + 2.0*r + br - tl - 2.0*l - bl;
      float dY = bl + 2.0*b + br - tl - 2.0*t - tr;
      
      float edge = sqrt(dX*dX + dY*dY);
      
      // Threshold and invert for black lines on white paper
      float edgeIntensity = smoothstep(uEdgeThreshold, uEdgeThreshold + 0.15, edge);
      
      // Return black lines on white (1.0)
      finalColor = vec3(1.0 - edgeIntensity);
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class PosterizationMaterial extends THREE.ShaderMaterial {
  declare uniforms: { [uniform: string]: { value: any } };

  constructor() {
    super({
      uniforms: {
        uTexture: { value: null },
        uSteps: { value: 4.0 },
        uPixelSize: { value: 2048.0 },
        uColor1: { value: new THREE.Color(0x000000) },
        uColor2: { value: new THREE.Color(0x777777) },
        uColor3: { value: new THREE.Color(0xffffff) },
        uEdgeOnly: { value: 0.0 },
        uEdgeThreshold: { value: 0.15 },
        uAberration: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader,
      fragmentShader
    });
  }

  set steps(v: number) { this.uniforms.uSteps.value = v; }
  set pixelSize(v: number) { this.uniforms.uPixelSize.value = v; }
  set edgeOnly(v: boolean) { this.uniforms.uEdgeOnly.value = v ? 1.0 : 0.0; }
  set edgeThreshold(v: number) { this.uniforms.uEdgeThreshold.value = v; }
  set aberration(v: number) { this.uniforms.uAberration.value = v; }
  
  setPalette(c1: string, c2: string, c3: string) {
    this.uniforms.uColor1.value.set(c1);
    this.uniforms.uColor2.value.set(c2);
    this.uniforms.uColor3.value.set(c3);
  }

  setTexture(tex: THREE.Texture) {
    this.uniforms.uTexture.value = tex;
  }
  
  setResolution(w: number, h: number) {
    this.uniforms.uResolution.value.set(w, h);
  }
}