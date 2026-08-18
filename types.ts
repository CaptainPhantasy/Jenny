export interface Palette {
  id: string;
  name: string;
  colors: [string, string, string]; // Shadow, Midtone, Highlight
  description: string; // Educational tooltip content
}

export interface AppState {
  imageSrc: string | null; // URL or base64
  isVideo: boolean;
  steps: number; // Posterization levels
  pixelation: number; // UV pixelation (resolution)
  activePaletteId: string;
  coloringBookMode: boolean; // Edge detection toggle
  gridSize: number; // 0 = off, 3 = 3x3, etc.
  
  // New Latent Features
  invertColors: boolean;
  flipX: boolean;
  flipY: boolean;
  edgeThreshold: number; // Default 0.15
  chromaticAberration: number; // Default 0.0
  
  // UI Features
  zenMode: boolean;
}

export const DEFAULT_IMAGE = "https://picsum.photos/800/800";
