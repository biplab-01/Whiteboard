import React, { useState, useEffect } from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export const ZoomControls: React.FC = () => {
  const { isDarkMode } = useBoardStore();
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    const handleZoomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ zoom: number }>;
      if (customEvent.detail && typeof customEvent.detail.zoom === 'number') {
        setZoomPercent(Math.round(customEvent.detail.zoom * 100));
      }
    };

    window.addEventListener('zoom-change', handleZoomChange);
    return () => window.removeEventListener('zoom-change', handleZoomChange);
  }, []);

  const triggerZoom = (action: 'in' | 'out' | 'reset') => {
    window.dispatchEvent(new CustomEvent('zoom-action', { detail: { action } }));
  };

  return (
    <div className={`fixed bottom-6 left-6 z-20 flex items-center gap-1 p-1.5 rounded-xl shadow-lg border backdrop-blur-md transition-colors ${
      isDarkMode ? 'bg-gray-800/80 border-gray-700 text-white' : 'bg-white/80 border-gray-200 text-gray-800'
    }`}>
      <button
        onClick={() => triggerZoom('out')}
        title="Zoom Out (Scroll Down)"
        className={`p-2 rounded-lg transition-all ${
          isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
        }`}
      >
        <ZoomOut size={16} />
      </button>

      <button
        onClick={() => triggerZoom('reset')}
        title="Reset Zoom to 100%"
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold min-w-[50px] text-center transition-all ${
          isDarkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-800'
        }`}
      >
        {zoomPercent}%
      </button>

      <button
        onClick={() => triggerZoom('in')}
        title="Zoom In (Scroll Up)"
        className={`p-2 rounded-lg transition-all ${
          isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
        }`}
      >
        <ZoomIn size={16} />
      </button>

      <div className={`w-px h-4 mx-0.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />

      <button
        onClick={() => triggerZoom('reset')}
        title="Fit / Reset View"
        className={`p-2 rounded-lg transition-all ${
          isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-black'
        }`}
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
};
