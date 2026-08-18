import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AppState, Palette } from '../types';
import { PosterizationMaterial } from '../webgl/PosterizationMaterial';

interface CanvasAreaProps {
  state: AppState;
  activePalette: Palette;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const CanvasArea: React.FC<CanvasAreaProps> = ({ state, activePalette, onCanvasReady }) => {
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
    containerRef.current.appendChild(renderer.domElement);
    onCanvasReady(renderer.domElement);
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
      if (state.isVideo && textureRef.current && videoElementRef.current) {
        if (videoElementRef.current.readyState >= videoElementRef.current.HAVE_CURRENT_DATA) {
          textureRef.current.needsUpdate = true;
        }
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

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current!);
      renderer.dispose();
      (material as THREE.Material).dispose();
      geometry.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Helper to adjust plane scale to match image aspect ratio within container
  const updatePlaneAspect = () => {
    if (!textureRef.current || !planeRef.current || !cameraRef.current || !containerRef.current) return;
    
    const imageAspect = textureRef.current.image.width / textureRef.current.image.height;
    const containerAspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    
    // Fit 'contain' logic for the plane
    // The camera covers height 2 (-1 to 1). Width is 2 * containerAspect.
    
    let scaleX = 1;
    let scaleY = 1;

    if (imageAspect > containerAspect) {
      // Image is wider than container: Fit to width
      scaleX = containerAspect;
      scaleY = containerAspect / imageAspect;
    } else {
      // Image is taller than container: Fit to height
      scaleX = imageAspect;
      scaleY = 1;
    }
    
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
  }, [state.steps, state.pixelation, state.coloringBookMode, state.edgeThreshold, state.chromaticAberration, state.invertColors, activePalette]);

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
      });
    }
  }, [state.imageSrc]);

  // Handle Video/Webcam Source
  useEffect(() => {
    if (state.isVideo) {
      // Create hidden video element
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      videoElementRef.current = video;

      navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        video.srcObject = stream;
        video.play();
        
        const tex = new THREE.VideoTexture(video);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        textureRef.current = tex;
        materialRef.current?.setTexture(tex);
        // Plane aspect will be updated in loop or we wait for metadata
        video.addEventListener('loadedmetadata', updatePlaneAspect);
      }).catch(err => console.error("Webcam error:", err));

      return () => {
        if (video.srcObject) {
          const tracks = (video.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
        }
      };
    }
  }, [state.isVideo]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black/40 flex items-center justify-center">
      {/* Three.js canvas appends here */}
      {!state.imageSrc && !state.isVideo && (
        <div className="absolute text-slate-500 flex flex-col items-center gap-2 pointer-events-none">
           <p>Upload an image or start camera to begin</p>
        </div>
      )}
    </div>
  );
};