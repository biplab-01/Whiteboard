import React from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { HexColorPicker } from 'react-colorful';
import { Palette, Eraser, CircleDot, Trash2 } from 'lucide-react';

export const PropertiesPanel: React.FC = () => {
  const { 
    currentTool, 
    strokeColor, setStrokeColor, 
    strokeWidth, setStrokeWidth, 
    fillColor, setFillColor,
    isDarkMode,
    activeTextFormat,
    eraserMode, setEraserMode,
    eraserSize, setEraserSize
  } = useBoardStore();

  // If text is selected, let TextPropertiesPanel handle it
  if (activeTextFormat) return null;

  // Render Eraser Properties Panel
  if (currentTool === 'eraser') {
    return (
      <div className={`fixed top-1/2 right-6 transform -translate-y-1/2 p-4 rounded-xl shadow-lg border backdrop-blur-md w-64 max-h-[80vh] overflow-y-auto custom-scrollbar z-20 ${
        isDarkMode ? 'bg-gray-800/80 border-gray-700 text-white' : 'bg-white/80 border-gray-200 text-gray-800'
      }`}>
        <div className="flex items-center gap-2 mb-4">
          <Eraser size={18} className="text-indigo-500" />
          <h3 className="font-semibold text-sm uppercase tracking-wider opacity-80">Eraser Settings</h3>
        </div>

        {/* Mode selection */}
        <div className="mb-5">
          <label className="block text-[11px] font-medium uppercase tracking-wider opacity-70 mb-2">
            Eraser Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEraserMode('partial')}
              className={`p-2.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                eraserMode === 'partial'
                  ? (isDarkMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-indigo-100 border-indigo-300 text-indigo-700 font-semibold')
                  : (isDarkMode ? 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')
              }`}
            >
              <CircleDot size={16} />
              <span>Partial</span>
              <span className="text-[9px] opacity-70 text-center">Erase parts</span>
            </button>

            <button
              type="button"
              onClick={() => setEraserMode('whole')}
              className={`p-2.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                eraserMode === 'whole'
                  ? (isDarkMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-indigo-100 border-indigo-300 text-indigo-700 font-semibold')
                  : (isDarkMode ? 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')
              }`}
            >
              <Trash2 size={16} />
              <span>Whole</span>
              <span className="text-[9px] opacity-70 text-center">Erase stroke</span>
            </button>
          </div>
        </div>

        {/* Eraser Size (if partial mode) */}
        {eraserMode === 'partial' && (
          <div className="mb-5">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Eraser Size</span>
              <span className="text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 px-2 py-0.5 rounded-full font-mono font-bold">{eraserSize}px</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="80" 
              value={eraserSize}
              onChange={(e) => setEraserSize(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between gap-1 mt-2">
              {[10, 20, 35, 50, 70].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setEraserSize(sz)}
                  className={`text-[10px] px-2 py-1 rounded font-mono transition-colors ${
                    eraserSize === sz
                      ? 'bg-indigo-600 text-white font-bold'
                      : isDarkMode
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Clear Canvas */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('clear-canvas'))}
            className="w-full py-2 px-3 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 border border-red-500/30 flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 size={14} />
            <span>Erase All on Page</span>
          </button>
        </div>
      </div>
    );
  }

  const isDrawingTool = ['pen', 'highlighter', 'rectangle', 'circle', 'triangle', 'line', 'arrow', 'diamond', 'star'].includes(currentTool);

  if (!isDrawingTool) return null;

  const colors = ['#000000', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
  
  const hasFill = ['rectangle', 'circle', 'triangle', 'diamond', 'star'].includes(currentTool);

  return (
    <div className={`fixed top-1/2 right-6 transform -translate-y-1/2 p-4 rounded-xl shadow-lg border backdrop-blur-md w-64 max-h-[80vh] overflow-y-auto custom-scrollbar ${
      isDarkMode ? 'bg-gray-800/80 border-gray-700 text-white' : 'bg-white/80 border-gray-200 text-gray-800'
    }`}>
      <h3 className="font-semibold text-sm mb-4 uppercase tracking-wider text-gray-500">Properties</h3>
      
      {/* Stroke Color */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Palette size={16} />
          <span className="text-sm font-medium">Stroke Color</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {colors.map(c => (
            <button 
              key={c}
              onClick={() => setStrokeColor(c)}
              className={`w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-110 ${strokeColor === c ? 'border-gray-400 scale-110 ring-2 ring-blue-500/50' : 'border-gray-200/20'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="custom-color-picker-wrapper scale-90 origin-top-left w-full h-32">
          <HexColorPicker color={strokeColor} onChange={setStrokeColor} />
        </div>
      </div>

      {/* Stroke Width */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Stroke Width</span>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono">{strokeWidth}px</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="20" 
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Fill Color */}
      {hasFill && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Fill Color</span>
            <button 
              onClick={() => setFillColor('transparent')}
              className={`text-xs px-2 py-1 rounded ${fillColor === 'transparent' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}
            >
              No Fill
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {colors.map(c => (
              <button 
                key={c}
                onClick={() => setFillColor(c)}
                className={`w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-110 ${fillColor === c ? 'border-gray-400 scale-110 ring-2 ring-blue-500/50' : 'border-gray-200/20'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="custom-color-picker-wrapper scale-90 origin-top-left w-full h-32">
            <HexColorPicker color={fillColor === 'transparent' ? '#ffffff' : fillColor} onChange={setFillColor} />
          </div>
        </div>
      )}
    </div>
  );
};
