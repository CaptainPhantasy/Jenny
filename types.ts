export interface Palette {
  id: string;
  name: string;
  colors: [string, string, string]; // Shadow, Midtone, Highlight
  description: string; // Educational tooltip content
}

export interface AppState {
  imageSrc: string | null; // URL or base64
  isVideo: boolean;
  steps: number; // Posterization levels (used only when threeToneMode is off)
  pixelation: number; // UV pixelation (resolution)
  activePaletteId: string; // 'custom' uses customColors
  coloringBookMode: boolean; // Edge detection toggle
  gridSize: number; // Drawing grid cell size in INCHES. 0 = off (e.g. 0.5, 1, 2)

  // Three-Tone Poster (clean 3-color finished piece: dark / midtone / light)
  threeToneMode: boolean; // When true, each pixel maps to exactly ONE of the 3 palette colors (no blending)
  shadowThreshold: number; // Luminance cutoff below which a pixel is the shadow/dark color (0..1)
  highlightThreshold: number; // Luminance cutoff above which a pixel is the highlight/light color (0..1)

  // User-selectable custom colors [shadow/dark, midtone, highlight/light]
  customColors: [string, string, string];

  // New Latent Features
  invertColors: boolean;
  flipX: boolean;
  flipY: boolean;
  edgeThreshold: number; // Default 0.15
  chromaticAberration: number; // Default 0.0
  
  // UI Features
  zenMode: boolean;
}
