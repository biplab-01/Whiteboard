import React, { useState, useRef, useEffect } from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { BookOpen, Edit2, Check } from 'lucide-react';

export const NotebookTitle: React.FC = () => {
  const { notebooks, activeNotebookId, renameNotebook, isDarkMode } = useBoardStore();
  const activeNotebook = notebooks.find(n => n.id === activeNotebookId);
  const currentTitle = activeNotebook?.name || 'Untitled Notebook';

  const [isEditing, setIsEditing] = useState(false);
  const [titleInput, setTitleInput] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleInput(currentTitle);
  }, [currentTitle]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (activeNotebookId && titleInput.trim() && titleInput.trim() !== currentTitle) {
      renameNotebook(activeNotebookId, titleInput.trim());
    } else {
      setTitleInput(currentTitle);
    }
    setIsEditing(false);
  };

  return (
    <div className="relative">
      <div className={`px-3 py-2 rounded-xl shadow-md border backdrop-blur-md transition-all flex items-center gap-2 h-[38px] ${
        isDarkMode ? 'bg-gray-800/80 border-gray-700 text-white' : 'bg-white/80 border-gray-200 text-gray-800'
      }`}>
        <BookOpen size={16} className="text-indigo-400 shrink-0" />

        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setTitleInput(currentTitle);
                  setIsEditing(false);
                }
              }}
              onBlur={handleSave}
              className={`text-xs font-semibold px-2 py-0.5 rounded-md border focus:outline-none ring-1 ring-indigo-500 w-36 sm:w-44 ${
                isDarkMode ? 'bg-gray-900 border-indigo-500 text-white' : 'bg-white border-indigo-500 text-gray-900'
              }`}
              placeholder="Notebook title..."
            />
            <button
              onClick={handleSave}
              className="p-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              title="Save"
            >
              <Check size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="group flex items-center gap-1.5 hover:text-indigo-400 transition-colors max-w-[130px] sm:max-w-[170px]"
            title="Click to Rename Notebook"
          >
            <span className="font-semibold text-xs truncate">
              {currentTitle}
            </span>
            <Edit2 size={12} className="opacity-50 group-hover:opacity-100 text-indigo-400 transition-opacity shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};
