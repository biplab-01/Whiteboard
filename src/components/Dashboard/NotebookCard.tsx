import { useState, useRef, useEffect } from 'react';
import { BookOpen, FolderInput, Trash2, Folder as FolderIcon, Inbox, Check, Edit2 } from 'lucide-react';
import { useBoardStore } from '../../store/useBoardStore';

interface NotebookCardProps {
  notebook: any;
}

export const NotebookCard = ({ notebook }: NotebookCardProps) => {
  const { openNotebook, deleteNotebook, isDarkMode, folders, moveNotebook, renameNotebook } = useBoardStore();
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(notebook.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNewName(notebook.name);
  }, [notebook.name]);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [isEditing]);

  const handleSaveName = () => {
    if (newName.trim() && newName.trim() !== notebook.name) {
      renameNotebook(notebook.id, newName.trim());
    } else {
      setNewName(notebook.name);
    }
    setIsEditing(false);
  };

  const formattedDate = new Date(notebook.created_at || Date.now()).toLocaleDateString();
  const currentFolder = folders.find(f => f.id === notebook.folder_id);

  // Close folder menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowFolderMenu(false);
      }
    };

    if (showFolderMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFolderMenu]);

  const handleMove = (folderId: string | null) => {
    moveNotebook(notebook.id, folderId);
    setShowFolderMenu(false);
  };

  return (
    <div className={`relative group flex flex-col rounded-2xl border aspect-[4/3] transition-all hover:-translate-y-1 hover:shadow-xl ${
      isDarkMode ? 'bg-[#1a1c29]/60 border-white/5' : 'bg-white border-gray-200 shadow-sm'
    }`}>
      
      {/* Thumbnail Area */}
      <div 
        className="flex-1 flex flex-col items-center justify-center cursor-pointer p-4 select-none relative overflow-hidden"
        onClick={() => openNotebook(notebook.id)}
      >
        <BookOpen size={48} className={`transition-transform duration-200 group-hover:scale-110 opacity-20 group-hover:opacity-30 ${
          isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
        }`} />
        
        {currentFolder && (
          <span className={`absolute top-3 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 border ${
            isDarkMode ? 'bg-indigo-950/60 border-indigo-500/30 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
          }`}>
            <FolderIcon size={10} /> {currentFolder.name}
          </span>
        )}
      </div>

      {/* Footer Area */}
      <div className={`p-3 px-3.5 border-t flex items-center justify-between relative rounded-b-2xl ${
        isDarkMode ? 'border-white/5 bg-[#141520]/80' : 'border-gray-100 bg-gray-50/80'
      }`}>
        <div className="flex-1 min-w-0 pr-2">
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={editInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setNewName(notebook.name);
                    setIsEditing(false);
                  }
                }}
                onBlur={handleSaveName}
                className={`w-full text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none ring-1 ring-indigo-500 ${
                  isDarkMode ? 'bg-gray-800 border-indigo-500 text-white' : 'bg-white border-indigo-500 text-gray-900'
                }`}
              />
            </div>
          ) : (
            <div className="group/title flex items-center gap-1.5">
              <h3 
                className="font-semibold text-sm truncate cursor-pointer hover:text-indigo-400 transition-colors" 
                title={notebook.name}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
              >
                {notebook.name}
              </h3>
              <button
                title="Rename Notebook"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="opacity-0 group-hover/title:opacity-100 p-0.5 rounded text-gray-400 hover:text-indigo-400 transition-opacity"
              >
                <Edit2 size={12} />
              </button>
            </div>
          )}
          <p className="text-[11px] opacity-50 mt-0.5">{formattedDate}</p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Rename Button in Action Bar */}
          {!isEditing && (
            <button
              title="Rename Notebook"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className={`p-1.5 rounded-lg transition-all ${
                isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              <Edit2 size={14} />
            </button>
          )}

          {/* Move to Folder Button */}
          <div className="relative" ref={menuRef}>
            <button 
              title="Move to Folder"
              onClick={(e) => {
                e.stopPropagation();
                setShowFolderMenu(!showFolderMenu);
              }}
              className={`p-1.5 rounded-lg transition-all ${
                showFolderMenu 
                  ? 'bg-indigo-600 text-white' 
                  : (isDarkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900')
              }`}
            >
              <FolderInput size={15} />
            </button>

            {/* Folder Selection Dropdown */}
            {showFolderMenu && (
              <div 
                className={`absolute bottom-full right-0 mb-2 w-56 p-1.5 rounded-xl shadow-2xl border z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl ${
                  isDarkMode ? 'bg-[#1e2030] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800 shadow-xl'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-200/10 mb-1">
                  Move to Folder
                </div>

                {/* Unfiled option */}
                <button
                  onClick={() => handleMove(null)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    !notebook.folder_id 
                      ? (isDarkMode ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600') 
                      : (isDarkMode ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-100 text-gray-700')
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Inbox size={14} className="opacity-70" /> Unfiled
                  </span>
                  {!notebook.folder_id && <Check size={14} />}
                </button>

                {/* List of user folders */}
                {folders.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto custom-scrollbar my-1">
                    {folders.map(folder => {
                      const isCurrent = notebook.folder_id === folder.id;
                      return (
                        <button
                          key={folder.id}
                          onClick={() => handleMove(folder.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isCurrent 
                              ? (isDarkMode ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600') 
                              : (isDarkMode ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-100 text-gray-700')
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <FolderIcon size={14} className="text-yellow-500 flex-shrink-0" /> 
                            <span className="truncate">{folder.name}</span>
                          </span>
                          {isCurrent && <Check size={14} className="flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-2.5 py-2 text-[11px] text-gray-400 italic">
                    No folders created yet. Click '+' next to Folders on the sidebar.
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Delete Button */}
          <button 
            title="Delete Notebook"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Are you sure you want to delete "${notebook.name}"?`)) {
                deleteNotebook(notebook.id);
              }
            }}
            className={`p-1.5 rounded-lg transition-all text-red-400 hover:text-red-500 ${
              isDarkMode ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
            }`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
