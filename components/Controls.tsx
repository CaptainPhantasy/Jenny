import React, { useRef } from 'react';
import { Upload, Camera, Download, Grid3X3, Palette as PaletteIcon, Eraser, FileDigit, Sliders, RefreshCcw, Maximize, Scan, Layers } from 'lucide-react';
import { Palette, AppState } from '../types';
import { PALETTES, PRESETS, Preset } from '../constants';
import { resToGlitchPercent, glitchPercentToRes } from '../lib/glitch';
import { clampShadowThreshold, clampHighlightThreshold } from '../lib/tone';

interface ControlsProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCamera: () => void;
  onDownload: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  state,
  setState,
  onUpload,
  onCamera,
  onDownload
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaletteSelect = (p: Palette) => {
    setState(prev => ({ ...prev, activePaletteId: p.id }));
  };

  // Switch to custom colors. Seed the pickers from the currently active palette
  // so the teacher can tweak from a known-good starting point.
  const handleCustomSelect = () => {
    setState(prev => {
      if (prev.activePaletteId === 'custom') return prev;
      const current = PALETTES.find(p => p.id === prev.activePaletteId);
      return {
        ...prev,
        activePaletteId: 'custom',
        customColors: current ? [...current.colors] as [string, string, string] : prev.customColors,
      };
    });
  };

  const handleCustomColorChange = (index: 0 | 1 | 2, value: string) => {
    setState(prev => {
      const next = [...prev.customColors] as [string, string, string];
      next[index] = value;
      return { ...prev, customColors: next };
    });
  };

  // Convert internal resolution (20-2048) to slider percentage (0-100) and back.
  // Logic lives in lib/glitch.ts so its round-trip is locked under tests.
  const getGlitchPercent = resToGlitchPercent;

  const handleGlitchChange = (val: number) => {
    setState(prev => ({ ...prev, pixelation: glitchPercentToRes(val) }));
  };

  const handlePresetSelect = (preset: Preset) => {
    setState(prev => ({ ...prev, ...preset.settings }));
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50 backdrop-blur-xl border-r border-slate-700 overflow-y-auto">
      <div className="p-6 space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-1 leading-tight">
            Miss Day’s Art Class<br/>Posterization App
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">by Legacy AI</p>
        </div>

        {/* Input Source */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Source
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-violet-500 hover:bg-slate-700 transition-all group"
            >
              <Upload className="w-5 h-5 text-slate-400 group-hover:text-violet-400 mb-1" />
              <span className="text-xs text-slate-400 group-hover:text-slate-200">Upload Image</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onUpload}
              accept="image/*"
              className="hidden"
            />
            
            <button
              onClick={onCamera}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-cyan-500 hover:bg-slate-700 transition-all group"
            >
              <Camera className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 mb-1" />
              <span className="text-xs text-slate-400 group-hover:text-slate-200">Selfie Station</span>
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Scan className="w-4 h-4" /> Quick Presets
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className="p-2 rounded-lg text-xs font-bold border transition-all bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Finish Style: Three-Tone vs Gradient */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4" /> Finish Style
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setState(prev => ({ ...prev, threeToneMode: true }))}
              className={`p-2 rounded-lg text-xs font-bold border transition-all ${state.threeToneMode ? 'bg-violet-500/20 text-violet-300 border-violet-500 ring-1 ring-violet-500/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              3-Color Poster
            </button>
            <button
              onClick={() => setState(prev => ({ ...prev, threeToneMode: false }))}
              className={`p-2 rounded-lg text-xs font-bold border transition-all ${!state.threeToneMode ? 'bg-violet-500/20 text-violet-300 border-violet-500 ring-1 ring-violet-500/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              Gradient
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            {state.threeToneMode
              ? 'Clean 3-color finished piece — every pixel becomes exactly dark, midtone, or light. No blended undertones.'
              : 'Smooth stepped gradient that blends between the three palette colors.'}
          </p>

          {/* Tone Balance (only relevant in 3-color mode) */}
          {state.threeToneMode && (
            <div className="space-y-3 p-3 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-300">Dark ↔ Midtone split</span>
                <span className="text-[10px] text-cyan-400 font-mono">{state.shadowThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.6"
                step="0.01"
                value={state.shadowThreshold}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setState(prev => ({ ...prev, shadowThreshold: clampShadowThreshold(v, prev.highlightThreshold) }));
                }}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-300">Midtone ↔ Light split</span>
                <span className="text-[10px] text-cyan-400 font-mono">{state.highlightThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="0.95"
                step="0.01"
                value={state.highlightThreshold}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setState(prev => ({ ...prev, highlightThreshold: clampHighlightThreshold(v, prev.shadowThreshold) }));
                }}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <p className="text-[10px] text-slate-500">Slide to control how much of the image reads as dark, midtone, and light.</p>
            </div>
          )}
        </div>

        {/* Levels / Steps (Gradient mode only) */}
        {!state.threeToneMode && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <PaletteIcon className="w-4 h-4" /> Detail Levels
              </h3>
              <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-cyan-400">{state.steps} Steps</span>
            </div>
            <input
              type="range"
              min="2"
              max="16"
              step="1"
              value={state.steps}
              onChange={(e) => setState(prev => ({ ...prev, steps: parseInt(e.target.value) }))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>
        )}

         {/* Glitch / Pixelate */}
         <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <FileDigit className="w-4 h-4" /> Retro Glitch
            </h3>
            <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-pink-400">
              {getGlitchPercent(state.pixelation)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={getGlitchPercent(state.pixelation)}
            onChange={(e) => handleGlitchChange(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
          />
          <p className="text-[10px] text-slate-500">Drag right to pixelate (8-bit style).</p>
        </div>

        {/* Palettes */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Color Palette</h3>
          <div className="grid grid-cols-2 gap-2">
            {PALETTES.map((palette) => (
              <button
                key={palette.id}
                onClick={() => handlePaletteSelect(palette)}
                className={`
                  relative p-2 rounded-lg border transition-all text-left group
                  ${state.activePaletteId === palette.id 
                    ? 'bg-slate-700 border-violet-500 ring-1 ring-violet-500/50' 
                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700'}
                `}
              >
                <div className="flex h-6 w-full rounded-md overflow-hidden mb-2">
                  {palette.colors.map((c, i) => (
                    <div key={i} style={{ backgroundColor: c }} className="flex-1 h-full" />
                  ))}
                </div>
                <span className={`text-xs font-medium block truncate ${state.activePaletteId === palette.id ? 'text-white' : 'text-slate-400'}`}>
                  {palette.name}
                </span>
              </button>
            ))}

            {/* Custom colors tile */}
            <button
              onClick={handleCustomSelect}
              className={`
                relative p-2 rounded-lg border transition-all text-left group
                ${state.activePaletteId === 'custom'
                  ? 'bg-slate-700 border-violet-500 ring-1 ring-violet-500/50'
                  : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700'}
              `}
            >
              <div className="flex h-6 w-full rounded-md overflow-hidden mb-2">
                {state.customColors.map((c, i) => (
                  <div key={i} style={{ backgroundColor: c }} className="flex-1 h-full" />
                ))}
              </div>
              <span className={`text-xs font-medium block truncate ${state.activePaletteId === 'custom' ? 'text-white' : 'text-slate-400'}`}>
                Custom
              </span>
            </button>
          </div>

          {/* Custom color pickers */}
          {state.activePaletteId === 'custom' && (
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-800 rounded-xl border border-slate-700">
              {([['Dark', 0], ['Midtone', 1], ['Light', 2]] as const).map(([label, idx]) => (
                <label key={label} className="flex flex-col items-center gap-1 cursor-pointer">
                  <input
                    type="color"
                    value={state.customColors[idx]}
                    onChange={(e) => handleCustomColorChange(idx, e.target.value)}
                    className="w-full h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                  />
                  <span className="text-[10px] text-slate-400">{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Educational Tools */}
        <div className="space-y-3 pt-4 border-t border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300">Classroom Tools</h3>
          
          {/* Edge Threshold Slider (Latent) */}
          {state.coloringBookMode && (
            <div className="space-y-2 p-3 bg-slate-800 rounded-xl border border-slate-700">
               <div className="flex justify-between items-center">
                 <span className="text-xs text-slate-300">Line Thickness</span>
                 <span className="text-[10px] text-cyan-400 font-mono">{state.edgeThreshold.toFixed(2)}</span>
               </div>
               <input
                 type="range"
                 min="0.05"
                 max="0.4"
                 step="0.01"
                 value={state.edgeThreshold}
                 onChange={(e) => setState(prev => ({ ...prev, edgeThreshold: parseFloat(e.target.value) }))}
                 className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
               />
            </div>
          )}

          {/* Coloring Book Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-800 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2">
              <Eraser className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-200">Coloring Page</span>
            </div>
            <button
              onClick={() => setState(prev => ({ ...prev, coloringBookMode: !prev.coloringBookMode }))}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${state.coloringBookMode ? 'bg-cyan-500' : 'bg-slate-600'}
              `}
            >
              <span className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ml-1
                ${state.coloringBookMode ? 'translate-x-5' : 'translate-x-0'}
              `} />
            </button>
          </div>

          {/* Grid Toggle (physical inches) */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-2">
              <Grid3X3 className="w-3.5 h-3.5" /> Drawing Grid
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[0, 0.5, 1, 2].map((size) => (
                <button
                  key={size}
                  onClick={() => setState(prev => ({ ...prev, gridSize: size }))}
                  className={`
                    p-2 rounded-lg text-xs font-bold border transition-all
                    ${state.gridSize === size 
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500' 
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}
                  `}
                >
                  {size === 0 ? 'Off' : `${size}"`}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">Overlays a physical inch grid on the artwork for scaling drawings.</p>
          </div>
        </div>

        {/* Pro / Advanced Tools (Latent) */}
        <div className="space-y-3 pt-4 border-t border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Pro Adjustments
          </h3>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setState(prev => ({ ...prev, invertColors: !prev.invertColors }))}
              className={`p-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${state.invertColors ? 'bg-pink-500/20 text-pink-300 border-pink-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              <RefreshCcw className="w-3 h-3" /> Invert Colors
            </button>
            <button
              onClick={() => setState(prev => ({ ...prev, flipX: !prev.flipX }))}
              className={`p-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${state.flipX ? 'bg-pink-500/20 text-pink-300 border-pink-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              Flip X
            </button>
            <button
              onClick={() => setState(prev => ({ ...prev, flipY: !prev.flipY }))}
              className={`p-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-2 ${state.flipY ? 'bg-pink-500/20 text-pink-300 border-pink-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              Flip Y
            </button>
          </div>

          {/* Chromatic Aberration Slider */}
          <div className="space-y-2 mt-4 p-3 bg-slate-800 rounded-xl border border-slate-700">
             <div className="flex justify-between items-center">
               <span className="text-xs text-slate-300">Chromatic Aberration</span>
             </div>
             <input
               type="range"
               min="0"
               max="0.05"
               step="0.001"
               value={state.chromaticAberration}
               onChange={(e) => setState(prev => ({ ...prev, chromaticAberration: parseFloat(e.target.value) }))}
               className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
             />
          </div>
        </div>

        {/* Action */}
        <button
          onClick={onDownload}
          className="w-full py-4 mt-auto rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold shadow-lg hover:shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download Art
        </button>

      </div>
    </div>
  );
};