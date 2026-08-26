import React, { useState } from 'react';
import { useBoardStore, PAGE_SIZES, type PageSizeType } from '../store/useBoardStore';
import { HexColorPicker } from 'react-colorful';
import { Settings, Palette, Grid, FileText, Check, Layout, Smartphone, Monitor } from 'lucide-react';

export const BackgroundSettings: React.FC = () => {
  const { 
    bgType, setBgType, 
    bgColor, setBgColor, 
    isRuled, setIsRuled, 
    ruleColor, setRuleColor,
    pageSize, setPageSize,
    pageOrientation, setPageOrientation,
    notebooks, activeNotebookId, renameNotebook,
    isDarkMode 
  } = useBoardStore();

  const activeNotebook = notebooks.find(n => n.id === activeNotebookId);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'size' | 'solid' | 'gradient' | 'ruled'>('size');
  const [nameInput, setNameInput] = useState(activeNotebook?.name || 'Untitled Notebook');
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (activeNotebook?.name) {
      setNameInput(activeNotebook.name);
    }
  }, [activeNotebook?.name]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNameChange = (val: string) => {
    setNameInput(val);
    if (activeNotebookId && val.trim()) {
      renameNotebook(activeNotebookId, val.trim());
    }
  };

  const solidColors = [
    { name: 'Pure White', value: '#ffffff' },
    { name: 'Warm Cream', value: '#fef3c7' },
    { name: 'Slate Gray', value: '#e2e8f0' },
    { name: 'Dark Slate', value: '#1e293b' },
    { name: 'Pure Black', value: '#000000' },
  ];

  const gradientPresets = [
    // Dark & Obsidian Themes
    { name: 'Navy & Obsidian', value: '#0b192c, #000000' },
    { name: 'Midnight Obsidian', value: '#1e1b4b, #030712' },
    { name: 'Abyss Slate', value: '#1e293b, #020617' },
    { name: 'Dark Emerald', value: '#064e3b, #022c22' },
    { name: 'Vampire Velvet', value: '#450a0a, #090101' },
    { name: 'Cyberpunk Obsidian', value: '#2e1065, #09090b' },
    { name: 'Deep Cosmic', value: '#0f0c29, #24243e' },
    { name: 'Titanium Graphite', value: '#334155, #090d16' },
    // Vibrant & Light Themes
    { name: 'Ocean', value: '#38bdf8, #1d4ed8' },
    { name: 'Sunrise', value: '#fde047, #f97316' },
    { name: 'Sunset', value: '#fbbf24, #ef4444' },
    { name: 'Forest', value: '#4ade80, #166534' },
    { name: 'Purple Dream', value: '#c084fc, #6b21a8' },
  ];

  const pageEntries = Object.entries(PAGE_SIZES) as [PageSizeType, (typeof PAGE_SIZES)[PageSizeType]][];

  return (
    <div ref={containerRef} className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3.5 py-2.5 rounded-xl shadow-md border backdrop-blur-md transition-all flex items-center gap-2 font-medium text-sm ${
          isDarkMode ? 'bg-gray-800/80 border-gray-700 text-white hover:bg-gray-700' : 'bg-white/80 border-gray-200 text-gray-800 hover:bg-gray-100'
        }`}
        title="Page Setup & Backgrounds"
      >
        <Settings size={18} />
        <span className="hidden sm:inline">Page Setup</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
          {PAGE_SIZES[pageSize]?.label || 'A4'}
        </span>
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 mt-2 p-4 rounded-2xl shadow-2xl border w-84 max-h-[82vh] overflow-y-auto custom-scrollbar backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
          isDarkMode ? 'bg-[#1a1c29]/95 border-gray-700 text-white' : 'bg-white/95 border-gray-200 text-gray-800'
        }`}>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold text-base">Page Setup</h3>
              <p className="text-[11px] text-gray-400">Title, dimensions & backgrounds</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-red-500 text-sm p-1">✕</button>
          </div>

          {/* Notebook Name Renaming Section */}
          <div className="mb-4 pb-3 border-b border-gray-200/10">
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-gray-400">
              Notebook Name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => {
                if (!nameInput.trim()) {
                  setNameInput(activeNotebook?.name || 'Untitled Notebook');
                }
              }}
              className={`w-full text-xs font-semibold px-3 py-2 rounded-xl border focus:outline-none ring-1 ring-indigo-500/50 ${
                isDarkMode ? 'bg-gray-800/80 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
              placeholder="Enter notebook title..."
            />
          </div>

          <div className="flex gap-1 mb-4 p-1 rounded-lg bg-gray-100 dark:bg-gray-800/80">
            <button 
              className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                activeTab === 'size' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')
              }`}
              onClick={() => setActiveTab('size')}
            >
              <Layout size={13} /> Size
            </button>
            <button 
              className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                activeTab === 'solid' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')
              }`}
              onClick={() => setActiveTab('solid')}
            >
              <Palette size={13} /> Solid
            </button>
            <button 
              className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                activeTab === 'gradient' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')
              }`}
              onClick={() => setActiveTab('gradient')}
            >
              <Grid size={13} /> Gradient
            </button>
            <button 
              className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                activeTab === 'ruled' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : (isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')
              }`}
              onClick={() => setActiveTab('ruled')}
            >
              <FileText size={13} /> Ruled
            </button>
          </div>

          {activeTab === 'size' && (
            <div className="space-y-4">
              {/* Orientation */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-gray-400">
                  Orientation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPageOrientation('portrait')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium transition-all ${
                      pageOrientation === 'portrait'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/30'
                        : isDarkMode
                        ? 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Smartphone size={14} className="rotate-0" />
                    <span>Portrait (Vertical)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPageOrientation('landscape')}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-medium transition-all ${
                      pageOrientation === 'landscape'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/30'
                        : isDarkMode
                        ? 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Monitor size={14} />
                    <span>Landscape (Horizontal)</span>
                  </button>
                </div>
              </div>

              {/* Standard Page Formats */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-gray-400">
                  Standard Sizes
                </label>
                <div className="space-y-2">
                  {pageEntries.map(([key, info]) => {
                    const isSelected = pageSize === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setPageSize(key)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30 shadow-sm'
                            : isDarkMode
                            ? 'border-gray-700/80 bg-gray-800/40 hover:bg-gray-800/80 hover:border-gray-600'
                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-white">{info.label}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-700/50 text-gray-300 font-mono">
                              {info.width} × {info.height}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">{info.description}</p>
                        </div>
                        {isSelected && <Check size={16} className="text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'solid' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => { setBgType('none'); setBgColor('transparent'); }}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                  bgType === 'none' || bgColor === 'transparent'
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30'
                    : isDarkMode
                    ? 'border-gray-700 bg-gray-800/40 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <span>🚫 No Background Page (Clean Document)</span>
                {(bgType === 'none' || bgColor === 'transparent') && <Check size={14} />}
              </button>

              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Preset Colors</p>
                <div className="grid grid-cols-5 gap-2">
                  {solidColors.map(c => {
                    const isSelected = bgType === 'solid' && bgColor.toLowerCase() === c.value.toLowerCase();
                    const isLight = c.value === '#ffffff' || c.value === '#fef3c7' || c.value === '#e2e8f0';
                    return (
                      <button 
                        key={c.value}
                        onClick={() => { setBgType('solid'); setBgColor(c.value); }}
                        title={c.name}
                        className={`h-11 rounded-xl border-2 transition-all flex flex-col items-center justify-center relative hover:scale-105 shadow-sm ${
                          isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/40 scale-105' : isDarkMode ? 'border-gray-700 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: c.value }}
                      >
                        {isSelected && <Check size={16} className={isLight ? 'text-black' : 'text-white'} />}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-5 gap-1 mt-1 text-center">
                  {solidColors.map(c => (
                    <span key={c.value} className="text-[10px] text-gray-400 truncate px-0.5">
                      {c.name.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 font-medium">Custom Color</p>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300">
                    {bgType === 'solid' ? bgColor : '#ffffff'}
                  </span>
                </div>
                <div className="custom-color-picker-wrapper mx-auto">
                  <HexColorPicker color={bgType === 'solid' ? bgColor : '#ffffff'} onChange={(c) => { setBgType('solid'); setBgColor(c); }} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gradient' && (
            <div className="space-y-2.5">
              <p className="text-xs text-gray-400 mb-1">Dark & Vibrant Presets</p>
              {gradientPresets.map(g => {
                const [c1, c2] = g.value.split(',');
                const isSelected = bgType === 'gradient' && bgColor === g.value;
                return (
                  <button
                    key={g.name}
                    onClick={() => { setBgType('gradient'); setBgColor(g.value); }}
                    className={`w-full h-11 rounded-xl border-2 flex items-center justify-between px-3.5 transition-all hover:scale-[1.02] shadow-sm ${
                      isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-white/10 hover:border-white/30'
                    }`}
                    style={{ background: `linear-gradient(to right, ${c1.trim()}, ${c2.trim()})` }}
                  >
                    <span className="text-white font-medium drop-shadow-md text-xs tracking-wide">{g.name}</span>
                    {isSelected && <Check size={16} className="text-white drop-shadow-md" />}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'ruled' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Enable Ruled Lines</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isRuled} onChange={(e) => setIsRuled(e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {isRuled && (
                <div className="pt-4 border-t border-gray-200/20">
                  <p className="text-xs font-medium mb-3 text-gray-400">Line Color</p>
                  <HexColorPicker color={ruleColor} onChange={setRuleColor} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
