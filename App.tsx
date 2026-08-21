import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Controls } from './components/Controls';
import { CanvasArea } from './components/CanvasArea';
import { GridOverlay } from './components/GridOverlay';
import { Tooltip } from './components/Tooltip';
import { AppState, DEFAULT_IMAGE, Palette } from './types';
import { PALETTES } from './constants';
import { fileToDataUri } from './services/imageService';
import { useHistory } from './components/HistoryHook';
import { Maximize, Minimize, Copy, Image as ImageIcon, Code, EyeOff, Undo, Redo, Shuffle, Settings2 } from 'lucide-react';
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

  const handleDownloadPNG = () => {
    if (canvasRef) {
      const link = document.createElement('a');
      link.download = `posterized-art-${Date.now()}.png`;
      link.href = canvasRef.toDataURL('image/png', 1.0);
      link.click();
    }
  };

  const handleDownloadSVG = () => {
    if (canvasRef) {
      const dataUrl = canvasRef.toDataURL('image/png', 1.0);
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasRef.width}" height="${canvasRef.height}">
        <image href="${dataUrl}" width="${canvasRef.width}" height="${canvasRef.height}" />
      </svg>`;
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `posterized-art-${Date.now()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleCopyClipboard = async () => {
    if (canvasRef) {
      canvasRef.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            alert('Copied to clipboard!');
          } catch (err) {
            console.error('Failed to copy', err);
          }
        }
      });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

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

  return (
    <div ref={containerRef} className="flex h-screen w-screen bg-[#0f172a] overflow-hidden">
      {/* Sidebar Controls */}
      <AnimatePresence>
        {!state.zenMode && (
          <motion.div 
            initial={{ x: -320 }} 
            animate={{ x: 0 }} 
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-80 h-full shrink-0 z-20 shadow-2xl absolute md:relative"
          >
            <Controls 
              state={state} 
              setState={setState} 
              onUpload={handleUpload}
              onCamera={handleCamera}
              onDownload={handleDownloadPNG}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 relative h-full flex flex-col w-full">
        
        {/* Top Bar / Canvas Header */}
        <div className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-slate-700 flex items-center justify-between px-6 z-10 w-full shrink-0">
            <div className="flex items-center gap-4">
               {state.zenMode && (
                 <button onClick={() => setState(prev => ({...prev, zenMode: false}))} className="text-slate-400 hover:text-white mr-2">
                   <Settings2 className="w-5 h-5" />
                 </button>
               )}
               <div className="h-8 w-8 rounded bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/20">
                 P
               </div>
               <span className="text-slate-200 font-medium hidden sm:inline">{activePalette.name}</span>
            </div>
            
            <div className="flex items-center gap-2">
               {/* Undo / Redo */}
               <div className="flex items-center bg-slate-800 rounded-lg p-1 mr-2 border border-slate-700">
                 <button onClick={undo} disabled={!canUndo} className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-30 transition-colors text-slate-300" title="Undo (Ctrl+Z)">
                    <Undo className="w-4 h-4" />
                 </button>
                 <button onClick={redo} disabled={!canRedo} className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-30 transition-colors text-slate-300" title="Redo (Ctrl+Y)">
                    <Redo className="w-4 h-4" />
                 </button>
               </div>

               {/* Quick Actions */}
               <button onClick={randomizeSettings} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors hidden sm:block" title="Randomize (R)">
                 <Shuffle className="w-4 h-4" />
               </button>
               <button onClick={handleCopyClipboard} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors hidden sm:block" title="Copy to Clipboard (Ctrl+C)">
                 <Copy className="w-4 h-4" />
               </button>
               <button onClick={handleDownloadSVG} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors" title="Export as SVG">
                 <Code className="w-4 h-4" />
               </button>
               <button onClick={() => setState(prev => ({...prev, zenMode: !prev.zenMode}))} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors" title="Zen Mode (H)">
                 <EyeOff className="w-4 h-4" />
               </button>
               <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-colors hidden sm:block" title="Fullscreen">
                 {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
               </button>
            </div>
        </div>

        {/* Canvas Container */}
        <div className="flex-1 relative bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
            <GridOverlay inches={state.gridSize} imageAspect={imageAspect} />
            
            <CanvasArea 
              state={state} 
              activePalette={activePalette}
              onCanvasReady={setCanvasRef}
              onImageLoaded={setImageAspect}
            />

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