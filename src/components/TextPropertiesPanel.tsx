import { useBoardStore } from '../store/useBoardStore';
import { Bold, Italic, Underline } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';

export const TextPropertiesPanel = () => {
  const { activeTextFormat, isDarkMode } = useBoardStore();

  if (!activeTextFormat) return null;

  const handleFormatChange = (updates: Partial<typeof activeTextFormat>) => {
    window.dispatchEvent(new CustomEvent('format-text', { detail: updates }));
  };

  const fonts = ['sans-serif', 'serif', 'monospace', 'Inter', 'Comic Sans MS'];
  const colors = ['#000000', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#ffffff'];

  return (
    <div className={`fixed top-1/2 right-6 transform -translate-y-1/2 p-4 rounded-xl shadow-lg border backdrop-blur-md w-72 max-h-[85vh] overflow-y-auto custom-scrollbar z-50 ${
      isDarkMode ? 'bg-gray-800/90 border-gray-700 text-white' : 'bg-white/90 border-gray-200 text-gray-800'
    }`}>
      <h3 className="font-semibold text-sm mb-4 uppercase tracking-wider text-gray-500">Text Properties</h3>

      {/* Font Family */}
      <div className="mb-4">
        <label className="block text-xs font-medium mb-1">Font Family</label>
        <select 
          value={activeTextFormat.fontFamily}
          onChange={(e) => handleFormatChange({ fontFamily: e.target.value })}
          className={`w-full text-sm rounded px-2 py-1.5 border focus:outline-none ${
            isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'
          }`}
        >
          {fonts.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Font Size */}
      <div className="mb-4">
        <label className="block text-xs font-medium mb-1">Font Size: {activeTextFormat.fontSize}px</label>
        <input 
          type="range" 
          min="8" max="144" 
          value={activeTextFormat.fontSize}
          onChange={(e) => handleFormatChange({ fontSize: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Styles (Bold, Italic, Underline) */}
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => handleFormatChange({ fontWeight: activeTextFormat.fontWeight === 'bold' ? 'normal' : 'bold' })}
          className={`p-1.5 rounded border transition-colors flex-1 flex justify-center ${
            activeTextFormat.fontWeight === 'bold' 
              ? (isDarkMode ? 'bg-indigo-600 border-indigo-500' : 'bg-indigo-100 border-indigo-300 text-indigo-700')
              : (isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50')
          }`}
        >
          <Bold size={16} />
        </button>
        <button 
          onClick={() => handleFormatChange({ fontStyle: activeTextFormat.fontStyle === 'italic' ? 'normal' : 'italic' })}
          className={`p-1.5 rounded border transition-colors flex-1 flex justify-center ${
            activeTextFormat.fontStyle === 'italic'
              ? (isDarkMode ? 'bg-indigo-600 border-indigo-500' : 'bg-indigo-100 border-indigo-300 text-indigo-700')
              : (isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50')
          }`}
        >
          <Italic size={16} />
        </button>
        <button 
          onClick={() => handleFormatChange({ underline: !activeTextFormat.underline })}
          className={`p-1.5 rounded border transition-colors flex-1 flex justify-center ${
            activeTextFormat.underline
              ? (isDarkMode ? 'bg-indigo-600 border-indigo-500' : 'bg-indigo-100 border-indigo-300 text-indigo-700')
              : (isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50')
          }`}
        >
          <Underline size={16} />
        </button>
      </div>

      {/* Text Color */}
      <div className="mb-4">
        <label className="block text-xs font-medium mb-1">Text Color</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {colors.map(c => (
            <button 
              key={c}
              onClick={() => handleFormatChange({ fill: c })}
              className={`w-5 h-5 rounded-full border shadow-sm ${activeTextFormat.fill === c ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="custom-color-picker-wrapper scale-90 origin-top-left w-full h-32">
          <HexColorPicker color={activeTextFormat.fill} onChange={(c) => handleFormatChange({ fill: c })} />
        </div>
      </div>

      {/* Highlight Color */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
           <label className="block text-xs font-medium">Highlight</label>
           <button 
             onClick={() => handleFormatChange({ textBackgroundColor: '' })}
             className="text-[10px] uppercase text-gray-500 hover:text-red-500"
           >
             Clear
           </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {colors.map(c => (
            <button 
              key={c}
              onClick={() => handleFormatChange({ textBackgroundColor: c })}
              className={`w-5 h-5 rounded-full border shadow-sm ${activeTextFormat.textBackgroundColor === c ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

    </div>
  );
};
