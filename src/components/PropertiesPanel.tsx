import { useBoardStore } from '../store/useBoardStore';
import { HexColorPicker } from 'react-colorful';
import { Palette } from 'lucide-react';

export const PropertiesPanel: React.FC = () => {
  const { 
    currentTool, 
    strokeColor, setStrokeColor, 
    strokeWidth, setStrokeWidth, 
    fillColor, setFillColor,
    isDarkMode,
    activeTextFormat
  } = useBoardStore();

  // Only show when a drawing/shape tool is active and no text is selected
  if (activeTextFormat) return null;
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
