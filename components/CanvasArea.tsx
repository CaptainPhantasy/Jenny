import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AppState, Palette } from '../types';
import { PosterizationMaterial } from '../webgl/PosterizationMaterial';
import { containScale } from '../lib/imageFit';

/** Signature of the imperative export function exposed to the parent. */
export type ExportFn = () => Promise<Blob | null>;

/** Grabs the current camera frame as a still image data URI (or null). */
export type CaptureFn = () => string | null;

interface CanvasAreaProps {
  state: AppState;
  activePalette: Palette;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  onImageLoaded?: (aspect: number) => void;
  /** Which camera to open: 'user' (front / selfie) or 'environment' (rear). */
  facingMode?: 'user' | 'environment';
  /** Parent-owned ref that receives a function to render a high-res PNG blob. */
  exportApiRef?: React.MutableRefObject<ExportFn | null>;
  /** Parent-owned ref that receives a function to snap a still from the camera. */
  captureApiRef?: React.MutableRefObject<CaptureFn | null>;
  /** Called when the user right-clicks / long-presses the canvas to save. */
  onRequestSave?: () => void;
}

export const CanvasArea: React.FC<CanvasAreaProps> = ({ state, activePalette, onCanvasReady, onImageLoaded, facingMode = 'user', exportApiRef, captureApiRef, onRequestSave }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<PosterizationMaterial | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const planeRef = useRef<THREE.Mesh | null>(null);
  
  // Handling Video/Webcam
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const requestRef = useRef<number>();

  // Cached offscreen export renderer (reused across saves to avoid WebGL context churn).
  const exRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const exSceneRef = useRef<THREE.Scene | null>(null);
  const exCamRef = useRef<THREE.OrthographicCamera | null>(null);
  const exMatRef = useRef<PosterizationMaterial | null>(null);
  const exGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const exMeshRef = useRef<THREE.Mesh | null>(null);

  // Init Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    // Setup Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      preserveDrawingBuffer: true 
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // Defensive: remove any stale canvas left behind (e.g. by a StrictMode
    // double-mount or HMR) so we never accumulate orphaned canvases in the DOM.
    containerRef.current.querySelectorAll('canvas').forEach((el) => el.remove());
    const canvasEl = renderer.domElement;
    containerRef.current.appendChild(canvasEl);
    onCanvasReady(canvasEl);
    rendererRef.current = renderer;

    // Setup Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');
    sceneRef.current = scene;

    // Setup Camera (Orthographic for 2D image processing)
    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
    camera.position.z = 1;
    cameraRef.current = camera;

    // Setup Material & Plane
    const material = new PosterizationMaterial();
    materialRef.current = material;

    const geometry = new THREE.PlaneGeometry(2, 2); // Fill screen
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);
    planeRef.current = plane;

    // Animation Loop
    const animate = () => {
      // Keep the live camera/video feed flowing. We detect the video texture by
      // type rather than reading `state.isVideo` here: this closure is created
      // once on mount, so `state.isVideo` would be permanently stale (false).
      const tex = textureRef.current as THREE.VideoTexture | null;
      const video = videoElementRef.current;
      if (tex?.isVideoTexture && video && video.readyState >= video.HAVE_CURRENT_DATA) {
        tex.needsUpdate = true;
      }
      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      // Guard against a zero dimension during initial layout — a 0-height canvas
      // renders nothing (the old "black canvas" bug). The container's size never
      // changes after mount, so the ResizeObserver won't fire again to correct it;
      // instead retry on the next animation frame until the layout has resolved.
      if (w === 0 || h === 0) {
        requestAnimationFrame(handleResize);
        return;
      }
      renderer.setSize(w, h);
      
      // Update Camera Aspect
      const newAspect = w / h;
      camera.left = -newAspect;
      camera.right = newAspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();

      // Update resolution uniform
      materialRef.current?.setResolution(w, h);
      
      // Adjust plane aspect based on image if needed
      updatePlaneAspect();
    };
    window.addEventListener('resize', handleResize);

    // A ResizeObserver drives sizing off actual layout. This fixes two issues the
    // window-resize-only approach missed: (1) a 0-height canvas on first paint, and
    // (2) the canvas not resizing when the sidebar toggles (Zen mode) since that
    // changes the container width without firing a window resize event.
    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
      cancelAnimationFrame(requestRef.current!);
      renderer.dispose();
      (material as THREE.Material).dispose();
      geometry.dispose();
      // Remove the exact canvas element this effect created. Using .remove()
      // (rather than parent.removeChild) is robust even if the container ref has
      // changed, guaranteeing no orphaned canvas survives a StrictMode re-mount.
      canvasEl.remove();
      // Dispose cached offscreen export resources.
      exRendererRef.current?.dispose();
      exGeoRef.current?.dispose();
      if (exMatRef.current) (exMatRef.current as THREE.Material).dispose();
      exRendererRef.current = null;
      exSceneRef.current = null;
      exCamRef.current = null;
      exMatRef.current = null;
      exGeoRef.current = null;
      exMeshRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Helper to adjust plane scale to match image aspect ratio within container
  const updatePlaneAspect = () => {
    if (!textureRef.current || !planeRef.current || !cameraRef.current || !containerRef.current) return;

    // Read the source's intrinsic size. A `<video>` element (camera / Selfie
    // Station) exposes its size as videoWidth/videoHeight — its `.width`/`.height`
    // are the (usually unset, i.e. 0) HTML attributes. Falling back to those
    // would make the aspect NaN and collapse the plane, so prefer the real dims.
    const src = textureRef.current.image as HTMLImageElement & HTMLVideoElement;
    const iw = src.naturalWidth || src.videoWidth || src.width || 0;
    const ih = src.naturalHeight || src.videoHeight || src.height || 0;
    if (!iw || !ih) return; // Not ready yet — avoid setting a NaN scale.

    const imageAspect = iw / ih;
    const containerAspect = containerRef.current.clientWidth / containerRef.current.clientHeight;

    // 'Contain' fit for the plane (logic in lib/imageFit.ts, locked under tests).
    const { scaleX, scaleY } = containScale(imageAspect, containerAspect);

    // Apply to mesh and flip
    planeRef.current.scale.set(
      state.flipX ? -scaleX : scaleX,
      state.flipY ? -scaleY : scaleY,
      1
    );
  };

  // Update Material Uniforms when React State changes
  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.steps = state.steps;
    materialRef.current.pixelSize = state.pixelation;
    materialRef.current.edgeOnly = state.coloringBookMode;
    materialRef.current.edgeThreshold = state.edgeThreshold;
    materialRef.current.aberration = state.chromaticAberration;
    materialRef.current.threeTone = state.threeToneMode;
    materialRef.current.shadowThreshold = state.shadowThreshold;
    materialRef.current.highlightThreshold = state.highlightThreshold;
    
    if (state.invertColors) {
      materialRef.current.setPalette(
        activePalette.colors[2],
        activePalette.colors[1],
        activePalette.colors[0]
      );
    } else {
      materialRef.current.setPalette(
        activePalette.colors[0],
        activePalette.colors[1],
        activePalette.colors[2]
      );
    }
  }, [state.steps, state.pixelation, state.coloringBookMode, state.edgeThreshold, state.chromaticAberration, state.invertColors, state.threeToneMode, state.shadowThreshold, state.highlightThreshold, activePalette]);

  // Handle Flips
  useEffect(() => {
    updatePlaneAspect();
  }, [state.flipX, state.flipY]);

  // Handle Image Source Changes
  useEffect(() => {
    if (!materialRef.current) return;

    if (state.imageSrc) {
      const loader = new THREE.TextureLoader();
      loader.load(state.imageSrc, (tex) => {
        textureRef.current = tex;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        materialRef.current?.setTexture(tex);
        updatePlaneAspect();
        if (tex.image && tex.image.width && tex.image.height) {
          onImageLoaded?.(tex.image.width / tex.image.height);
        }
      });
    }
  }, [state.imageSrc]);

  // Handle Video/Webcam Source
  useEffect(() => {
    if (!state.isVideo) return;

    // Create hidden video element
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    videoElementRef.current = video;

    // Guards against a race when the effect is torn down (unmount, camera off,
    // or a fast facingMode flip) BEFORE getUserMedia resolves: the stream would
    // otherwise arrive after cleanup and keep the camera on. We track the stream
    // in a closure var and a cancelled flag so cleanup can always stop it.
    let cancelled = false;
    let stream: MediaStream | null = null;

    // Open the requested camera. facingMode is a soft constraint, so devices
    // with a single camera (most laptops) simply use what they have; phones
    // honour it so the flip button can swap between front and rear cameras.
    navigator.mediaDevices.getUserMedia({ video: { facingMode } }).then((s) => {
      stream = s;
      if (cancelled) {
        // We already cleaned up — this stream is orphaned. Stop it immediately
        // so the camera indicator turns off and we don't leak a second camera.
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = s;
      // play() can reject with an AbortError when the source is swapped quickly
      // (e.g. a fast camera flip). It's harmless here (muted autoplay), so we
      // swallow it rather than let it surface as an unhandled promise rejection.
      video.play().catch(() => {});

      const tex = new THREE.VideoTexture(video);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      textureRef.current = tex;
      materialRef.current?.setTexture(tex);
      // Plane aspect will be updated in loop or we wait for metadata
      video.addEventListener('loadedmetadata', () => {
        updatePlaneAspect();
        if (video.videoWidth && video.videoHeight) {
          onImageLoaded?.(video.videoWidth / video.videoHeight);
        }
      });
    }).catch((err) => console.error('Webcam error:', err));

    return () => {
      cancelled = true;
      // Stop whichever stream exists: the one on the element, or one that
      // resolved into the closure (covers the resolve-after-cleanup race).
      const active = (video.srcObject as MediaStream | null) || stream;
      active?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
    // Re-runs when facingMode changes too: the cleanup stops the old camera's
    // tracks and this effect reopens the stream on the newly selected camera.
  }, [state.isVideo, facingMode]);

  // --- High-fidelity export -------------------------------------------------
  // Renders the CURRENT look into an offscreen buffer at the SOURCE image's
  // native resolution (not the CSS-scaled viewport), then composites the grid
  // overlay on top. This produces a 1:1 WYSIWYG PNG with no letterbox bars and
  // no zoom/white artifact, independent of the on-screen device pixel ratio.
  const doExport: ExportFn = async () => {
    const tex = textureRef.current;
    const container = containerRef.current;
    if (!tex || !tex.image) return null;

    const img = tex.image as HTMLImageElement & HTMLVideoElement;
    const imgW = (img as HTMLImageElement).naturalWidth || (img as HTMLVideoElement).videoWidth || 0;
    const imgH = (img as HTMLImageElement).naturalHeight || (img as HTMLVideoElement).videoHeight || 0;
    if (!imgW || !imgH) return null;

    // Cap the longest edge so huge photos don't blow the GPU/memory budget,
    // while preserving the native aspect ratio exactly.
    const MAX_EDGE = 4096;
    const fit = Math.min(1, MAX_EDGE / Math.max(imgW, imgH));
    const outW = Math.max(1, Math.round(imgW * fit));
    const outH = Math.max(1, Math.round(imgH * fit));

    // Reuse (or lazily create) the cached offscreen renderer to avoid hitting
    // browser WebGL context limits on repeated exports.
    if (!exRendererRef.current) {
      const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1);
      if (rendererRef.current) r.outputColorSpace = rendererRef.current.outputColorSpace;
      exRendererRef.current = r;
    }
    const exRenderer = exRendererRef.current;
    exRenderer.setSize(outW, outH, false);

    if (!exSceneRef.current) exSceneRef.current = new THREE.Scene();
    const exScene = exSceneRef.current;

    if (!exCamRef.current) {
      // Full-frame quad: the framebuffer aspect equals the image aspect, so the
      // image fills the whole frame — no letterboxing, no background bars.
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      cam.position.z = 1;
      exCamRef.current = cam;
    }
    const exCam = exCamRef.current;

    if (!exMatRef.current) exMatRef.current = new PosterizationMaterial();
    const exMat = exMatRef.current;
    // Mirror every live uniform so the export matches the screen exactly.
    exMat.steps = state.steps;
    exMat.pixelSize = state.pixelation;
    exMat.edgeOnly = state.coloringBookMode;
    exMat.edgeThreshold = state.edgeThreshold;
    exMat.aberration = state.chromaticAberration;
    exMat.threeTone = state.threeToneMode;
    exMat.shadowThreshold = state.shadowThreshold;
    exMat.highlightThreshold = state.highlightThreshold;
    if (state.invertColors) {
      exMat.setPalette(activePalette.colors[2], activePalette.colors[1], activePalette.colors[0]);
    } else {
      exMat.setPalette(activePalette.colors[0], activePalette.colors[1], activePalette.colors[2]);
    }
    exMat.setTexture(tex);
    exMat.setResolution(outW, outH);

    if (!exGeoRef.current) exGeoRef.current = new THREE.PlaneGeometry(2, 2);
    const exGeo = exGeoRef.current;

    if (!exMeshRef.current) {
      exMeshRef.current = new THREE.Mesh(exGeo, exMat);
      exScene.add(exMeshRef.current);
    }
    const exMesh = exMeshRef.current;
    exMesh.scale.set(state.flipX ? -1 : 1, state.flipY ? -1 : 1, 1);

    exRenderer.render(exScene, exCam);

    // Composite onto a 2D canvas so we can draw the grid overlay on top.
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) { return null; }
    ctx.drawImage(exRenderer.domElement, 0, 0, outW, outH);

    // Draw the inch grid to match what's visible on screen. We reproduce the
    // same cell count/spacing fractions the on-screen overlay uses (relative to
    // the image's displayed "contain" rectangle), scaled to the export size.
    if (state.gridSize > 0 && container) {
      const cW = container.clientWidth;
      const cH = container.clientHeight;
      const imageAspect = imgW / imgH;
      const contAspect = cW / cH;
      let rectW: number, rectH: number;
      if (imageAspect > contAspect) { rectW = cW; rectH = cW / imageAspect; }
      else { rectH = cH; rectW = cH * imageAspect; }

      const cell = state.gridSize * 96; // 96 CSS px = 1 inch (same as overlay)
      const cols = Math.floor(rectW / cell);
      const rows = Math.floor(rectH / cell);

      // Match the on-screen GridOverlay exactly: white/30 lines, white/40 border.
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = Math.max(1, outW / 1400);
      for (let i = 1; i <= cols; i++) {
        const x = (i * cell / rectW) * outW;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, outH); ctx.stroke();
      }
      for (let j = 1; j <= rows; j++) {
        const y = (j * cell / rectH) * outH;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(outW, y); ctx.stroke();
      }
      // Border around the artwork.
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.strokeRect(0.5, 0.5, outW - 1, outH - 1);

      // Legend, sized proportionally to the export.
      const fontPx = Math.max(12, Math.round(outW / 55));
      const label = state.gridSize === 1 ? '1 inch grid' : `${state.gridSize}" grid`;
      ctx.font = `${fontPx}px monospace`;
      const padX = fontPx * 0.5;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(15,23,42,0.7)';
      ctx.fillRect(fontPx * 0.4, fontPx * 0.4, tw + padX * 2, fontPx * 1.6);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, fontPx * 0.4 + padX, fontPx * 0.4 + fontPx * 0.85);
    }

    return await new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), 'image/png'));
  };

  // Snap the current live camera frame into a still image. We capture the RAW
  // video frame (not the shader result) so the still stays fully editable — the
  // poster/palette effect is re-applied live once it loads back in as an image.
  const captureStill: CaptureFn = () => {
    const video = videoElementRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  };

  // Keep the parent's refs pointed at the freshest closures (captures latest
  // state), and clear them on unmount to avoid dangling references.
  useEffect(() => {
    if (exportApiRef) exportApiRef.current = doExport;
    if (captureApiRef) captureApiRef.current = captureStill;
    return () => {
      if (exportApiRef) exportApiRef.current = null;
      if (captureApiRef) captureApiRef.current = null;
    };
  });

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => { if (onRequestSave) { e.preventDefault(); onRequestSave(); } }}
      className="w-full h-full relative overflow-hidden bg-black/40 flex items-center justify-center"
    >
      {/* Three.js canvas appends here */}
      {!state.imageSrc && !state.isVideo && (
        <div className="absolute text-slate-500 flex flex-col items-center gap-2 pointer-events-none px-6 text-center">
           <p>Upload an image or start camera to begin</p>
        </div>
      )}
    </div>
  );
};