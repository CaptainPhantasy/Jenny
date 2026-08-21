import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Controls } from './components/Controls';
import { CanvasArea, ExportFn, CaptureFn } from './components/CanvasArea';
import { GridOverlay } from './components/GridOverlay';
import { Tooltip } from './components/Tooltip';
import { AppState, DEFAULT_IMAGE, Palette } from './types';
import { PALETTES } from './constants';
import { fileToDataUri } from './services/imageService';
import { useHistory } from './components/HistoryHook';
import { Maximize, Minimize, Copy, Code, EyeOff, Undo, Redo, Shuffle, Settings2, Menu, Download, SwitchCamera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const INITIAL_STATE: AppState = {
  imageSrc: DEFAULT_IMAGE,
  isVideo: false,
  steps: 6,
  pixelation: 2048,
  activePaletteId: 'grayscale',
  coloringBookMode: false,
  gridSize: 0,
  threeToneMode: true,
  shadowThreshold: 0.33,
  highlightThreshold: 0.66,
  customColors: ['#1a1a2e', '#e94560', '#f5f5f5'],
  invertColors: false,
  flipX: false,
  flipY: false,
  edgeThreshold: 0.15,
  chromaticAberration: 0.0,
  zenMode: false,
};

const App: React.FC = () => {
  // Global State with History
  const { state, setState, undo, redo, canUndo, canRedo } = useHistory(INITIAL_STATE);

  // UI State
  const [showTooltip, setShowTooltip] = useState(false);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageAspect, setImageAspect] = useState<number | null>(null);

  // Imperative handle to the high-fidelity export function owned by CanvasArea.
  const exportRef = useRef<ExportFn | null>(null);
  // Imperative handle to snap a still frame from the live camera.
  const captureRef = useRef<CaptureFn | null>(null);
  // Which camera the live feed uses. Not part of undo history — it's a device
  // choice, not an edit. Defaults to the front camera for selfies.
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Responsive layout state. On small screens the control panel becomes a
  // slide-in drawer; on md+ it is docked. `mobileOpen` tracks the drawer.
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Close the mobile drawer whenever the viewport grows to desktop width so
  // state stays consistent (avoids the drawer reopening on mobile→desktop→mobile).
  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  // Derived active palette. When 'custom' is selected we build a palette from the
  // user-chosen colors so they can pick their own Dark / Midtone / Light.
  const activePalette = useMemo<Palette>(() => {
    if (state.activePaletteId === 'custom') {
      return {
        id: 'custom',
        name: 'Custom Colors',
        colors: state.customColors,
        description: 'Your own three colors: choose a dark, a midtone, and a light color to build a clean three-tone piece.',
      };
    }
    return PALETTES.find(p => p.id === state.activePaletteId) || PALETTES[0];
  }, [state.activePaletteId, state.customColors]);

  // Handlers
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const uri = await fileToDataUri(e.target.files[0]);
      setState(prev => ({ ...prev, imageSrc: uri, isVideo: false }));
    }
  };

  const handleCamera = () => {
    setState(prev => ({ ...prev, isVideo: true, imageSrc: null }));
  };

  // Take the photo: freeze the current camera frame into a still and load it as
  // the editable image, then turn the camera off. If the frame isn't ready yet
  // we simply leave the camera running so the student can try again.
  const handleTakePhoto = () => {
    const uri = captureRef.current?.();
    if (uri) {
      setState(prev => ({ ...prev, imageSrc: uri, isVideo: false }));
    }
  };

  // Produce the high-res, WYSIWYG PNG blob from the offscreen export pipeline.
  // Falls back to the on-screen canvas only if the export API is unavailable.
  const getArtBlob = async (): Promise<Blob | null> => {
    if (exportRef.current) {
      try {
        const blob = await exportRef.current();
        if (blob) return blob;
      } catch (err) {
        console.error('High-res export failed, falling back to canvas', err);
      }
    }
    if (canvasRef) {
      return await new Promise<Blob | null>((resolve) =>
        canvasRef.toBlob((b) => resolve(b), 'image/png')
      );
    }
    return null;
  };

  // Bulletproof multi-device save. Uses the Web Share API (native share sheet /
  // "Save Image" → Camera Roll or Files) when the device supports sharing files;
  // otherwise falls back to an object-URL download link. Works on iOS/Android
  // Safari & Chrome as well as desktop browsers.
  const handleExportAndSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const blob = await getArtBlob();
      if (!blob) {
        alert('Could not generate the image. Please load an image first.');
        return;
      }
      const fileName = 'art-project.png';
      const file = new File([blob], fileName, { type: 'image/png' });

      // Prefer the native share sheet on capable (mostly mobile) devices.
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
        share?: (data?: ShareData) => Promise<void>;
      };
      if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: 'My Poster Art' });
          return;
        } catch (err) {
          // User cancelled or share failed — fall through to download.
          if ((err as DOMException)?.name === 'AbortError') return;
          console.warn('Share failed, falling back to download', err);
        }
      }

      // Universal download fallback.
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = url;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadSVG = async () => {
    const blob = await getArtBlob();
    if (!blob) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    // Recover the PNG's intrinsic size so the SVG wrapper matches it exactly.
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => resolve({ w: 1024, h: 1024 });
      im.src = dataUrl;
    });
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${dims.h}">
      <image href="${dataUrl}" width="${dims.w}" height="${dims.h}" />
    </svg>`;
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.download = 'art-project.svg';
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopyClipboard = async () => {
    const blob = await getArtBlob();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    // `isFullscreen` is synced by the fullscreenchange listener below rather than
    // set optimistically here, so exiting via the Esc key keeps the icon correct.
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const randomizeSettings = () => {
    const randomPalette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    setState(prev => ({
      ...prev,
      steps: Math.floor(Math.random() * 14) + 2,
      pixelation: Math.random() > 0.5 ? 2048 : Math.floor(Math.random() * 480) + 20,
      activePaletteId: randomPalette.id,
      coloringBookMode: Math.random() > 0.8,
      gridSize: Math.random() > 0.5 ? 0 : [0.5, 1, 2][Math.floor(Math.random() * 3)],
      invertColors: Math.random() > 0.8,
      chromaticAberration: Math.random() > 0.7 ? Math.random() * 0.05 : 0.0,
    }));
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
        e.preventDefault();
      }
      
      // Shortcuts
      switch(e.key.toLowerCase()) {
        case 'h':
          setState(prev => ({ ...prev, zenMode: !prev.zenMode }));
          break;
        case 'r':
          randomizeSettings();
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) handleCopyClipboard();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, setState]);

  // Educational Tooltip Logic
  useEffect(() => {
    setShowTooltip(true);
    const timer = setTimeout(() => setShowTooltip(false), 8000);
    return () => clearTimeout(timer);
  }, [state.activePaletteId]);

  // The docked sidebar shows on desktop (md+) unless Zen mode; on mobile it is a
  // slide-in drawer toggled by the hamburger. Close the drawer whenever we grow
  // to a desktop width so state stays consistent.
  const sidebarVisible = !state.zenMode && (isDesktop || mobileOpen);

  return (
    <div
      ref={containerRef}
      className="flex h-[100dvh] w-[100vw] bg-[#0f172a] overflow-hidden relative"
    >
      {/* Mobile drawer backdrop */}
      <AnimatePresence>
        {mobileOpen && !isDesktop && !state.zenMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Controls (docked on desktop, drawer on mobile) */}
      <AnimatePresence>
        {sidebarVisible && (
          <motion.div
            initial={{ x: -340 }}
            animate={{ x: 0 }}
            exit={{ x: -340 }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="w-[85vw] max-w-xs md:w-80 h-full shrink-0 z-40 shadow-2xl fixed md:relative left-0 top-0 pb-[env(safe-area-inset-bottom)]"
          >
            <Controls
              state={state}
              setState={setState}
              onUpload={handleUpload}
              onCamera={handleCamera}
              onDownload={handleExportAndSave}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 relative h-full flex flex-col w-full min-w-0">

        {/* Top Bar / Canvas Header */}
        <div className="shrink-0 bg-slate-900/50 backdrop-blur-md border-b border-slate-700 flex items-center justify-between gap-2 z-10 w-full pt-[env(safe-area-inset-top)] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
          <div className="flex items-center gap-2 sm:gap-4 h-16 min-w-0">
             {/* Mobile hamburger to open the controls drawer */}
             {!state.zenMode && (
               <button
                 onClick={() => setMobileOpen(true)}
                 className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors shrink-0"
                 title="Open controls"
                 aria-label="Open controls"
               >
                 <Menu className="w-5 h-5" />
               </button>
             )}
             {state.zenMode && (
               <button onClick={() => setState(prev => ({...prev, zenMode: false}))} className="text-slate-400 hover:text-white mr-1 shrink-0" title="Exit Zen mode">
                 <Settings2 className="w-5 h-5" />
               </button>
             )}
             <div className="h-8 w-8 rounded bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/20 shrink-0">
               P
             </div>
             <span className="text-slate-200 font-medium truncate hidden sm:inline">{activePalette.name}</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 h-16 shrink-0">
             {/* Undo / Redo */}
             <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
               <button onClick={undo} disabled={!canUndo} className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-30 transition-colors text-slate-300" title="Undo (Ctrl+Z)">
                  <Undo className="w-4 h-4" />
               </button>
               <button onClick={redo} disabled={!canRedo} className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-30 transition-colors text-slate-300" title="Redo (Ctrl+Y)">
                  <Redo className="w-4 h-4" />
               </button>
             </div>

             {/* Quick Actions (desktop) */}
             <button onClick={randomizeSettings} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors hidden sm:block" title="Randomize (R)">
               <Shuffle className="w-4 h-4" />
             </button>
             <button onClick={handleCopyClipboard} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors hidden sm:block" title="Copy to Clipboard (Ctrl+C)">
               <Copy className="w-4 h-4" />
             </button>
             <button onClick={handleDownloadSVG} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors hidden sm:block" title="Export as SVG">
               <Code className="w-4 h-4" />
             </button>

             {/* Mobile save button — always reachable without opening the drawer */}
             <button
               onClick={handleExportAndSave}
               disabled={isSaving}
               className="md:hidden p-2 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/20 disabled:opacity-50 transition-colors"
               title="Save / Share art"
               aria-label="Save art"
             >
               <Download className="w-5 h-5" />
             </button>

             <button onClick={() => setState(prev => ({...prev, zenMode: !prev.zenMode}))} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors" title="Zen Mode (H)">
               <EyeOff className="w-4 h-4" />
             </button>
             <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors hidden sm:block" title="Fullscreen">
               {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
             </button>
          </div>
        </div>

        {/* Canvas Container — fills remaining height, centers & contains the art */}
        <div className="flex-1 relative min-h-0 overflow-hidden bg-slate-900">
            <GridOverlay inches={state.gridSize} imageAspect={imageAspect} />

            <CanvasArea
              state={state}
              activePalette={activePalette}
              onCanvasReady={setCanvasRef}
              onImageLoaded={setImageAspect}
              exportApiRef={exportRef}
              captureApiRef={captureRef}
              facingMode={facingMode}
              onRequestSave={handleExportAndSave}
            />

            {/* Camera controls — only while the live camera is running. The
                shutter freezes the current frame into an editable still; the
                flip button swaps between front and rear cameras. */}
            {state.isVideo && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] z-20 pointer-events-none">
                <button
                  onClick={handleTakePhoto}
                  className="pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full bg-white text-slate-900 font-bold shadow-2xl ring-4 ring-white/30 hover:scale-105 active:scale-95 transition-transform"
                  title="Take photo"
                  aria-label="Take photo"
                >
                  <span className="inline-block w-5 h-5 rounded-full border-4 border-slate-900" />
                  Take Photo
                </button>
                <button
                  onClick={() => setFacingMode(f => (f === 'user' ? 'environment' : 'user'))}
                  className="pointer-events-auto p-3 rounded-full bg-slate-900/70 text-white shadow-2xl ring-2 ring-white/30 hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all backdrop-blur-sm"
                  title="Switch camera (front/back)"
                  aria-label="Switch camera"
                >
                  <SwitchCamera className="w-6 h-6" />
                </button>
              </div>
            )}

            {/* Tooltip Popup */}
            <Tooltip
              visible={showTooltip}
              content={activePalette.description}
              onClose={() => setShowTooltip(false)}
            />
        </div>
      </div>
    </div>
  );
};

export default App;