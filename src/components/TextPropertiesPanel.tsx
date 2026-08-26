import React, { useState } from 'react';
import { useBoardStore } from '../store/useBoardStore';
import type { TextFormat } from '../store/useBoardStore';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Type, 
  Palette, 
  Highlighter
} from 'lucide-react';
import { HexColorPicker } from 'react-colorful';

export const TextPropertiesPanel: React.FC = () => {
  const { 
    activeTextFormat, 
    isDarkMode, 
    setActiveTextFormat, 
    opacity, 
    setOpacity,
    setLastTextSize,
    setLastFontFamily,
    setLastTextColor 
  } = useBoardStore();
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  if (!activeTextFormat) return null;

  const handleFormatChange = (updates: Partial<TextFormat>) => {
    // 1. Optimistically update local zustand store for immediate UI reaction
    setActiveTextFormat({
      ...activeTextFormat,
      ...updates
    });

    // 2. Persist text preferences for future textboxes (excluding bold/italic/underline/linethrough)
    if (typeof updates.fontSize === 'number') {
      setLastTextSize(updates.fontSize);
    }
    if (typeof updates.fontFamily === 'string') {
      setLastFontFamily(updates.fontFamily);
    }
    if (typeof updates.fill === 'string') {
      setLastTextColor(updates.fill);
    }

    // 3. Dispatch custom event to let Board canvas apply changes to the Fabric text object
    window.dispatchEvent(new CustomEvent('format-text', { detail: updates }));
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    window.dispatchEvent(new CustomEvent('format-shape', { detail: { opacity: val } }));
  };

  const fonts = [
    { name: 'Inter', value: 'Inter' },
    { name: 'Roboto', value: 'Roboto' },
    { name: 'Outfit', value: 'Outfit' },
    { name: 'Caveat', value: 'Caveat' },
    { name: 'Playfair Display', value: 'Playfair Display' },
    { name: 'Fira Code', value: 'Fira Code' },
    { name: 'Arial', value: 'Arial' },
    { name: 'Georgia', value: 'Georgia' },
    { name: 'Courier New', value: 'Courier New' },
    { name: 'Comic Sans MS', value: 'Comic Sans MS' },
    { name: 'Algerian', value: 'Algerian' },
    { name: 'Times New Roman', value: 'Times New Roman' },
    { name: 'Hallington', value: 'Hallington' },
  ];

  const sizePresets = [14, 18, 24, 32, 48, 64, 96];

  const textColors = [
    '#ffffff', '#000000', '#64748b', '#ef4444', 
    '#f97316', '#f59e0b', '#84cc16', '#22c55e', 
    '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', 
    '#ec4899', '#f43f5e', '#14b8a6', '#eab308'
  ];

  const highlightColors = [
    '#fef08a', '#bbf7d0', '#bae6fd', '#fed7aa', 
    '#fbcfe8', '#ddd6fe', '#fca5a5', '#a7f3d0',
    '#ef4444', '#f97316', '#22c55e', '#3b82f6'
  ];

  return (
    <div className={`fixed top-1/2 right-6 transform -translate-y-1/2 p-4 rounded-2xl shadow-2xl border backdrop-blur-xl w-80 max-h-[88vh] overflow-y-auto custom-scrollbar z-40 transition-all duration-200 ${
      isDarkMode 
        ? 'bg-gray-900/90 border-gray-700/80 text-gray-100 shadow-black/50' 
        : 'bg-white/95 border-gray-200/90 text-gray-800 shadow-indigo-500/10'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 mb-3.5 border-b border-gray-200/20">
        <Type size={18} className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} />
        <h3 className="font-semibold text-xs tracking-wider uppercase opacity-80">Text Properties</h3>
      </div>

      {/* Text Opacity Slider */}
      <div className="mb-4 pb-3 border-b border-gray-200/20">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider opacity-70">Text Opacity</span>
          <span className="text-[11px] font-mono opacity-60 font-bold">{Math.round((opacity ?? 1) * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0.05" 
          max="1" 
          step="0.05"
          value={opacity ?? 1}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
      </div>

      {/* Font Family */}
      <div className="mb-4">
        <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5 opacity-70">
          Typography
        </label>
        <select 
          value={activeTextFormat.fontFamily}
          onChange={(e) => handleFormatChange({ fontFamily: e.target.value })}
          className={`w-full text-xs font-medium rounded-lg px-2.5 py-2 border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-750' 
              : 'bg-gray-50 border-gray-300 text-gray-800 hover:bg-gray-100'
          }`}
          style={{ fontFamily: activeTextFormat.fontFamily }}
        >
          {fonts.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wider opacity-70">Font Size</label>
          <div className="flex items-center gap-1">
            <input 
              type="number" 
              min="8" 
              max="240"
              value={activeTextFormat.fontSize}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val > 0) {
                  handleFormatChange({ fontSize: Math.min(240, Math.max(8, val)) });
                }
              }}
              className={`w-14 text-center text-xs font-mono font-semibold py-0.5 px-1 rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                isDarkMode ? 'bg-gray-800 border-gray-700 text-indigo-300' : 'bg-gray-50 border-gray-300 text-indigo-700'
              }`}
            />
            <span className="text-[11px] font-mono opacity-60">px</span>
          </div>
        </div>

        {/* Range Slider */}
        <input 
          type="range" 
          min="8" 
          max="160" 
          value={activeTextFormat.fontSize}
          onChange={(e) => handleFormatChange({ fontSize: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 mb-2"
        />

        {/* Quick Size Chips */}
        <div className="flex flex-wrap gap-1">
          {sizePresets.map(sz => (
            <button
              key={sz}
              type="button"
              onClick={() => handleFormatChange({ fontSize: sz })}
              className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                activeTextFormat.fontSize === sz
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

      {/* Style Toggles (Bold, Italic, Underline, Strikethrough, Superscript, Subscript) */}
      <div className="mb-4">
        <label className="block text-[11px] font-medium uppercase tracking-wider opacity-70 mb-1.5">
          Style & Formatting
        </label>
        
        <div className="grid grid-cols-6 gap-1.5">
          {/* Bold */}
          <button 
            type="button"
            title="Bold"
            onClick={() => handleFormatChange({ fontWeight: activeTextFormat.fontWeight === 'bold' ? 'normal' : 'bold' })}
            className={`p-2 rounded-lg border transition-all flex items-center justify-center ${
              activeTextFormat.fontWeight === 'bold' 
                ? (isDarkMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : 'bg-indigo-100 border-indigo-300 text-indigo-700 font-bold')
                : (isDarkMode ? 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')
            }`}
          >
            <Bold size={15} />
          </button>

          {/* Italic */}
          <button 
            type="button"
            title="Italic"
            onClick={() => handleFormatChange({ fontStyle: activeTextFormat.fontStyle === 'italic' ? 'normal' : 'italic' })}
            className={`p-2 rounded-lg border transition-all flex items-center justify-center ${
              activeTextFormat.fontStyle === 'italic'
                ? (isDarkMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : 'bg-indigo-100 border-indigo-300 text-indigo-700')
                : (isDarkMode ? 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')
            }`}
          >
            <Italic size={15} />
          </button>

          {/* Underline */}
          <button 
            type="button"
            title="Underline"
            onClick={() => handleFormatChange({ underline: !activeTextFormat.underline })}
            className={`p-2 rounded-lg border transition-all flex items-center justify-center ${
              activeTextFormat.underline
                ? (isDarkMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : 'bg-indigo-100 border-indigo-300 text-indigo-700')
                : (isDarkMode ? 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')
            }`}
          >
            <Underline size={15} />
          </button>

          {/* Strikethrough */}
          <button 
            type="button"
            title="Strikethrough"
            onClick={() => handleFormatChange({ linethrough: !activeTextFormat.linethrough })}
            className={`p-2 rounded-lg border transition-all flex items-center justify-center ${
              activeTextFormat.linethrough
                ? (isDarkMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : 'bg-indigo-100 border-indigo-300 text-indigo-700')
                : (isDarkMode ? 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')
            }`}
          >
            <Strikethrough size={15} />
          </button>

          {/* Superscript */}
          <button 
            type="button"
            title="Superscript (X²)"
            onClick={() => handleFormatChange({ 
              superscript: !activeTextFormat.superscript, 
              subscript: false 
            })}
            className={`p-2 rounded-lg border transition-all flex items-center justify-center text-xs font-serif font-bold ${
              activeTextFormat.superscript
                ? (isDarkMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : 'bg-indigo-100 border-indigo-300 text-indigo-700')
                : (isDarkMode ? 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')
            }`}
          >
            <span>X<sup className="text-[10px] font-sans font-bold">2</sup></span>
          </button>

          {/* Subscript */}
          <button 
            type="button"
            title="Subscript (X₂)"
            onClick={() => handleFormatChange({ 
              subscript: !activeTextFormat.subscript, 
              superscript: false 
            })}
            className={`p-2 rounded-lg border transition-all flex items-center justify-center text-xs font-serif font-bold ${
              activeTextFormat.subscript
                ? (isDarkMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' : 'bg-indigo-100 border-indigo-300 text-indigo-700')
                : (isDarkMode ? 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')
            }`}
          >
            <span>X<sub className="text-[10px] font-sans font-bold">2</sub></span>
          </button>
        </div>
      </div>

      {/* Text Color Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Palette size={13} className="opacity-70" />
            <label className="text-[11px] font-medium uppercase tracking-wider opacity-70">Text Color</label>
          </div>
          <button
            type="button"
            onClick={() => setShowTextColorPicker(!showTextColorPicker)}
            className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span 
              className="w-2.5 h-2.5 rounded-full border border-black/20" 
              style={{ backgroundColor: activeTextFormat.fill }} 
            />
            {activeTextFormat.fill}
          </button>
        </div>

        {/* Color Palette Grid */}
        <div className="grid grid-cols-8 gap-1.5 mb-2">
          {textColors.map(c => (
            <button 
              key={c}
              type="button"
              onClick={() => handleFormatChange({ fill: c })}
              className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 flex items-center justify-center ${
                activeTextFormat.fill.toLowerCase() === c.toLowerCase() 
                  ? 'ring-2 ring-indigo-500 ring-offset-2 scale-105 border-indigo-500' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        {/* Color Picker Toggle */}
        {showTextColorPicker && (
          <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 mb-2">
            <div className="custom-color-picker-wrapper w-full h-32 mb-2">
              <HexColorPicker 
                color={activeTextFormat.fill} 
                onChange={(c) => handleFormatChange({ fill: c })} 
              />
            </div>
            <input 
              type="text"
              value={activeTextFormat.fill}
              onChange={(e) => handleFormatChange({ fill: e.target.value })}
              placeholder="#000000"
              className="w-full text-xs font-mono text-center py-1 px-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Highlight Color Section */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Highlighter size={13} className="opacity-70" />
            <label className="text-[11px] font-medium uppercase tracking-wider opacity-70">Highlight</label>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => handleFormatChange({ textBackgroundColor: '' })}
              className="text-[10px] uppercase font-semibold text-gray-500 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setShowHighlightPicker(!showHighlightPicker)}
              className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span 
                className="w-2.5 h-2.5 rounded-full border border-black/20" 
                style={{ backgroundColor: activeTextFormat.textBackgroundColor || 'transparent' }} 
              />
              {activeTextFormat.textBackgroundColor ? 'Custom' : 'None'}
            </button>
          </div>
        </div>

        {/* Highlight Palette Grid */}
        <div className="grid grid-cols-6 gap-1.5 mb-2">
          {highlightColors.map(c => (
            <button 
              key={c}
              type="button"
              onClick={() => handleFormatChange({ textBackgroundColor: c })}
              className={`h-5 rounded-md border transition-transform hover:scale-105 ${
                activeTextFormat.textBackgroundColor?.toLowerCase() === c.toLowerCase() 
                  ? 'ring-2 ring-indigo-500 ring-offset-1 border-indigo-500' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        {showHighlightPicker && (
          <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700">
            <div className="custom-color-picker-wrapper w-full h-32 mb-2">
              <HexColorPicker 
                color={activeTextFormat.textBackgroundColor || '#fef08a'} 
                onChange={(c) => handleFormatChange({ textBackgroundColor: c })} 
              />
            </div>
            <button 
              type="button"
              onClick={() => handleFormatChange({ textBackgroundColor: '' })}
              className="w-full text-xs py-1 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-medium hover:bg-red-200 transition-colors"
            >
              Remove Highlight
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
