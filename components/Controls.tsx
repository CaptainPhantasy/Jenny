import React, { useRef } from 'react';
import { Upload, Camera, Download, Grid3X3, Palette as PaletteIcon, Eraser, FileDigit, Sliders, RefreshCcw, Maximize, Scan } from 'lucide-react';
import { Palette, AppState } from '../types';
import { PALETTES, PRESETS, Preset } from '../constants';

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

  // Helper to convert internal resolution (20-2048) to slider percentage (100-0)
  // We treat 2048 as 0% glitch, 20 as 100% glitch.
  const getGlitchPercent = (res: number) => {
    if (res >= 2048) return 0;
    // Map 500..20 to 1..100 roughly
    if (res > 500) return 0; // Buffer zone
    // Linear map from 500->1 to 20->100
    const p = (500 - res) / (500 - 20) * 100;
    return Math.max(0, Math.min(100, Math.round(p)));
  };

  const handleGlitchChange = (val: number) => {
    let newRes;
    if (val <= 0) {
      newRes = 2048; // Off
    } else {
      newRes = 500 - ((val) / 100) * (500 - 20);
    }
    setState(prev => ({ ...prev, pixelation: newRes }));
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

        {/* Levels / Steps */}
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
          </div>
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

          {/* Grid Toggle */}
          <div className="space-y-2">
            <span className="text-xs text-slate-400 block mb-1">Drawing Grid</span>
            <div className="grid grid-cols-4 gap-2">
              {[0, 3, 4, 5].map((size) => (
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
                  {size === 0 ? 'Off' : `${size}x${size}`}
                </button>
              ))}
            </div>
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