import React from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { HexColorPicker } from 'react-colorful';
import { Palette, BringToFront, SendToBack, ChevronUp, ChevronDown, Copy, Trash2, Layers } from 'lucide-react';

export const PropertiesPanel: React.FC = () => {
  const { 
    currentTool, 
    strokeColor, setStrokeColor, 
    strokeWidth, setStrokeWidth, 
    fillColor, setFillColor,
    opacity, setOpacity,
    isDarkMode,
    activeTextFormat,
    activeShapeFormat
  } = useBoardStore();

  // If text is selected or eraser is active, don't show generic shape properties panel
  if (activeTextFormat || currentTool === 'eraser') return null;

  const isDrawingTool = ['pen', 'highlighter', 'rectangle', 'circle', 'triangle', 'line', 'arrow', 'diamond', 'star'].includes(currentTool);
  const isShapeSelected = !!activeShapeFormat;

  // Show panel if a shape/media is selected OR if a drawing tool is active
  if (!isDrawingTool && !isShapeSelected) return null;

  const colors = ['#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899'];
  
  // Determine if current shape / tool supports fill
  const shapeType = activeShapeFormat?.type || currentTool;
  const isImage = shapeType === 'image';
  const hasFill = !isImage && ['rectangle', 'circle', 'triangle', 'diamond', 'star', 'rect', 'ellipse', 'polygon'].includes(shapeType);
  const hasStroke = !isImage;

  const handleUpdate = (updates: Record<string, any>) => {
    if (updates.stroke !== undefined) setStrokeColor(updates.stroke);
    if (updates.strokeWidth !== undefined) setStrokeWidth(updates.strokeWidth);
    if (updates.fill !== undefined) setFillColor(updates.fill);
    if (updates.opacity !== undefined) setOpacity(updates.opacity);
    if (isShapeSelected) {
      window.dispatchEvent(new CustomEvent('format-shape', { detail: updates }));
    }
  };

  const handleArrange = (action: 'bring-to-front' | 'send-to-back' | 'bring-forward' | 'send-backward') => {
    window.dispatchEvent(new CustomEvent('arrange-object', { detail: { action } }));
  };

  const handleDuplicate = () => {
    window.dispatchEvent(new CustomEvent('duplicate-object'));
  };

  const handleDelete = () => {
    window.dispatchEvent(new CustomEvent('delete-object'));
  };

  return (
    <div className={`fixed top-1/2 right-6 transform -translate-y-1/2 p-4 rounded-2xl shadow-xl border backdrop-blur-xl w-72 max-h-[85vh] overflow-y-auto custom-scrollbar z-30 transition-all ${
      isDarkMode ? 'bg-gray-900/90 border-gray-700/80 text-white shadow-black/50' : 'bg-white/95 border-gray-200 text-gray-800 shadow-indigo-500/10'
    }`}>
      <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-gray-200/20">
        <h3 className="font-semibold text-xs uppercase tracking-wider opacity-80">
          {isShapeSelected ? (isImage ? 'Selected Image' : 'Selected Shape') : 'Shape Properties'}
        </h3>
        {isShapeSelected && (
          <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 px-2 py-0.5 rounded font-medium capitalize">
            {shapeType}
          </span>
        )}
      </div>

      {/* Layer Arrangement Order Section (When an object is selected) */}
      {isShapeSelected && (
        <div className="mb-4 pb-3 border-b border-gray-200/20">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers size={14} className="text-indigo-400" />
            <span className="text-xs font-medium">Layer Order</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => handleArrange('bring-to-front')}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                isDarkMode ? 'bg-gray-800 hover:bg-gray-750 border-gray-700 text-gray-200' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
              }`}
              title="Bring to Front (Ctrl+Shift+])"
            >
              <BringToFront size={14} className="text-indigo-400" />
              <span>To Front</span>
            </button>
            <button
              type="button"
              onClick={() => handleArrange('bring-forward')}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                isDarkMode ? 'bg-gray-800 hover:bg-gray-750 border-gray-700 text-gray-200' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
              }`}
              title="Bring Forward (Alt+])"
            >
              <ChevronUp size={14} className="text-indigo-400" />
              <span>Forward</span>
            </button>
            <button
              type="button"
              onClick={() => handleArrange('send-backward')}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                isDarkMode ? 'bg-gray-800 hover:bg-gray-750 border-gray-700 text-gray-200' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
              }`}
              title="Send Backward (Alt+[)"
            >
              <ChevronDown size={14} className="text-indigo-400" />
              <span>Backward</span>
            </button>
            <button
              type="button"
              onClick={() => handleArrange('send-to-back')}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                isDarkMode ? 'bg-gray-800 hover:bg-gray-750 border-gray-700 text-gray-200' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
              }`}
              title="Send to Back (Ctrl+Shift+[)"
            >
              <SendToBack size={14} className="text-indigo-400" />
              <span>To Back</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleDuplicate}
              className={`p-1.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                isDarkMode ? 'bg-gray-800 hover:bg-gray-750 border-gray-700 text-gray-200' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
              }`}
              title="Duplicate (Ctrl+D)"
            >
              <Copy size={13} className="text-indigo-400" />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="p-1.5 rounded-lg border border-red-500/30 text-xs font-medium flex items-center justify-center gap-1.5 text-red-400 hover:bg-red-500/15 transition-all"
              title="Delete (Del)"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Opacity Slider for image and shapes */}
      {isShapeSelected && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-medium opacity-80">Opacity</span>
            <span className="text-[11px] font-mono opacity-60">{Math.round((activeShapeFormat?.opacity ?? opacity) * 100)}%</span>
          </div>
          <input 
            type="range" 
            min="0.05" 
            max="1" 
            step="0.05"
            value={activeShapeFormat?.opacity ?? opacity}
            onChange={(e) => handleUpdate({ opacity: parseFloat(e.target.value) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
      )}
      
      {/* Stroke Color */}
      {hasStroke && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Palette size={14} className="text-indigo-400" />
            <span className="text-xs font-medium">Stroke Color</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {colors.map(c => (
              <button 
                key={c}
                type="button"
                onClick={() => handleUpdate({ stroke: c })}
                className={`w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-110 ${strokeColor === c ? 'border-gray-400 scale-110 ring-2 ring-indigo-500/50' : 'border-gray-400/20'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="custom-color-picker-wrapper scale-90 origin-top-left w-full h-28">
            <HexColorPicker color={strokeColor} onChange={(c) => handleUpdate({ stroke: c })} />
          </div>
        </div>
      )}

      {/* Stroke Width */}
      {hasStroke && (
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-xs font-medium">Stroke Width</span>
            <span className="text-[11px] bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 px-2 py-0.5 rounded-full font-mono font-bold">{strokeWidth}px</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="30" 
            value={strokeWidth}
            onChange={(e) => handleUpdate({ strokeWidth: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between gap-1 mt-2">
            {[1, 2, 4, 8, 14, 20].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => handleUpdate({ strokeWidth: sz })}
                className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                  strokeWidth === sz
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

      {/* Fill Color */}
      {hasFill && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Fill Color</span>
            <button 
              type="button"
              onClick={() => handleUpdate({ fill: 'transparent' })}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${fillColor === 'transparent' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-300 dark:border-indigo-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
            >
              No Fill
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {colors.map(c => (
              <button 
                key={c}
                type="button"
                onClick={() => handleUpdate({ fill: c })}
                className={`w-6 h-6 rounded-full border shadow-sm transition-transform hover:scale-110 ${fillColor === c ? 'border-gray-400 scale-110 ring-2 ring-indigo-500/50' : 'border-gray-400/20'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="custom-color-picker-wrapper scale-90 origin-top-left w-full h-28">
            <HexColorPicker color={fillColor === 'transparent' ? '#ffffff' : fillColor} onChange={(c) => handleUpdate({ fill: c })} />
          </div>
        </div>
      )}
    </div>
  );
};
