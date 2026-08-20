import React, { useState, useRef, useEffect } from 'react';
import { useBoardStore } from '../store/useBoardStore';
import type { ToolType } from '../store/useBoardStore';
import { 
  MousePointer2, 
  Hand, 
  PenTool, 
  Highlighter, 
  Eraser, 
  Square, 
  Circle, 
  Triangle, 
  Minus, 
  Type, 
  Image as ImageIcon,
  Calculator,
  Trash2
} from 'lucide-react';

export const Toolbar: React.FC = () => {
  const { currentTool, setCurrentTool, isDarkMode } = useBoardStore();
  const [showEraserMenu, setShowEraserMenu] = useState(false);
  const eraserMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (eraserMenuRef.current && !eraserMenuRef.current.contains(e.target as Node)) {
        setShowEraserMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEraseAll = () => {
    window.dispatchEvent(new CustomEvent('clear-canvas'));
    setShowEraserMenu(false);
  };

  const tools: { id: ToolType; icon: React.ReactNode; tooltip: string }[] = [
    { id: 'select', icon: <MousePointer2 size={20} />, tooltip: 'Select (V)' },
    { id: 'pan', icon: <Hand size={20} />, tooltip: 'Pan (Space)' },
    { id: 'pen', icon: <PenTool size={20} />, tooltip: 'Pen (P)' },
    { id: 'highlighter', icon: <Highlighter size={20} />, tooltip: 'Highlighter' },
    { id: 'eraser', icon: <Eraser size={20} />, tooltip: 'Eraser (E) • Right-click for options' },
    { id: 'rectangle', icon: <Square size={20} />, tooltip: 'Rectangle (R)' },
    { id: 'circle', icon: <Circle size={20} />, tooltip: 'Circle (C)' },
    { id: 'triangle', icon: <Triangle size={20} />, tooltip: 'Triangle' },
    { id: 'line', icon: <Minus size={20} />, tooltip: 'Line (L)' },
    { id: 'text', icon: <Type size={20} />, tooltip: 'Text (T)' },
  ];

  return (
    <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2 p-2 rounded-xl shadow-lg border backdrop-blur-md transition-colors z-30 ${
      isDarkMode ? 'bg-gray-800/80 border-gray-700 text-white' : 'bg-white/80 border-gray-200 text-gray-800'
    }`}>
      {tools.map((tool) => {
        const isEraser = tool.id === 'eraser';

        return (
          <div key={tool.id} className="relative">
            <button
              onClick={() => setCurrentTool(tool.id)}
              onContextMenu={(e) => {
                if (isEraser) {
                  e.preventDefault();
                  setShowEraserMenu((prev) => !prev);
                }
              }}
              title={tool.tooltip}
              className={`p-3 rounded-lg flex items-center justify-center transition-all ${
                currentTool === tool.id 
                  ? (isDarkMode ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md')
                  : (isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700')
              }`}
            >
              {tool.icon}
            </button>

            {/* Right-click menu for Eraser */}
            {isEraser && showEraserMenu && (
              <div
                ref={eraserMenuRef}
                className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 p-1.5 rounded-xl shadow-2xl border backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 z-50 ${
                  isDarkMode ? 'bg-[#1a1c29]/95 border-gray-700 text-white' : 'bg-white/95 border-gray-200 text-gray-800'
                }`}
              >
                <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-gray-400 tracking-wider">
                  Eraser Options
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentTool('eraser');
                    setShowEraserMenu(false);
                  }}
                  className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                    isDarkMode ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Eraser size={14} className="text-indigo-400" />
                  <span>Eraser Tool (E)</span>
                </button>

                <button
                  type="button"
                  onClick={handleEraseAll}
                  className="w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 text-red-400 hover:bg-red-500/15 transition-colors"
                >
                  <Trash2 size={14} className="text-red-400" />
                  <span>Erase All (Clear Page)</span>
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Vertical separator */}
      <div className={`w-px mx-1 my-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
      
      {/* 2D/3D Graphing Calculator */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('open-calculator'))}
        className={`p-3 rounded-lg flex items-center justify-center transition-all ${
          isDarkMode ? 'hover:bg-indigo-600/30 text-indigo-400' : 'hover:bg-indigo-50 text-indigo-600'
        }`}
        title="2D & 3D Graphing Calculator (Desmos)"
      >
        <Calculator size={20} />
      </button>

      {/* File Import */}
      <label 
        className={`p-3 rounded-lg flex items-center justify-center cursor-pointer transition-all ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
        title="Import Image/PDF"
      >
        <ImageIcon size={20} />
        <input 
          type="file" 
          accept="image/*,application/pdf"
          className="hidden" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const url = URL.createObjectURL(file);
              window.dispatchEvent(new CustomEvent('insert-media', { 
                detail: { 
                  url, 
                  type: file.type.startsWith('image/') ? 'image' : 'pdf',
                  file
                }
              }));
              e.target.value = ''; // reset input
            }
          }}
        />
      </label>
    </div>
  );
};
