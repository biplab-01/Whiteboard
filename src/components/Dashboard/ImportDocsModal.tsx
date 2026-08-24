import React, { useState, useRef, useCallback } from 'react';
import { useBoardStore, getPageDimensions } from '../../store/useBoardStore';
import { useAuthStore } from '../../store/useAuthStore';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { 
  X, 
  FileUp, 
  FileText, 
  CheckCircle2, 
  Folder, 
  Loader2, 
  ArrowRight,
  BookOpen
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface ImportDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFolderId?: string | null;
}

interface SelectedPdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

export const ImportDocsModal: React.FC<ImportDocsModalProps> = ({
  isOpen,
  onClose,
  initialFolderId = null,
}) => {
  const { folders, isDarkMode, createNotebookWithPages, openNotebook } = useBoardStore();
  const { user } = useAuthStore();

  const [files, setFiles] = useState<SelectedPdfFile[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialFolderId);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [totalFilePages, setTotalFilePages] = useState(0);
  const [importedNotebookIds, setImportedNotebookIds] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean filename for note title
  const cleanNotebookTitle = (fileName: string) => {
    return fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim() || 'Imported Document';
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newEntries: SelectedPdfFile[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        newEntries.push({
          id: `file_${Math.random().toString(36).substring(2, 9)}_${Date.now()}_${i}`,
          file,
          name: cleanNotebookTitle(file.name),
          size: file.size,
        });
      }
    }

    if (newEntries.length > 0) {
      setFiles(prev => [...prev, ...newEntries]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newTitle } : f));
  };

  const handleStartImport = async () => {
    if (files.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setIsCompleted(false);
    const createdIds: string[] = [];
    const userId = user?.id || localStorage.getItem('nova_guest_id') || 'guest';
    const targetFolder = (selectedFolderId === 'all' || selectedFolderId === 'unfiled') ? null : selectedFolderId;

    const { width: pageW, height: pageH } = getPageDimensions('a4', 'portrait');
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 960;
    const pageCenterX = (screenW - pageW) / 2;
    const pageCenterY = Math.max(50, (screenH - pageH) / 2);

    try {
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        setCurrentFileIndex(i + 1);

        const arrayBuffer = await item.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        setTotalFilePages(numPages);

        const pagesData: { canvasData: string; name: string }[] = [];

        for (let pNum = 1; pNum <= numPages; pNum++) {
          setCurrentPageIndex(pNum);
          const page = await pdf.getPage(pNum);
          const unscaledViewport = page.getViewport({ scale: 1 });

          // Constrain within document page with clean 24px padding
          const padding = 24;
          const availW = pageW - padding * 2;
          const availH = pageH - padding * 2;

          const fitScale = Math.min(availW / unscaledViewport.width, availH / unscaledViewport.height);
          const targetWidth = unscaledViewport.width * fitScale;
          const targetHeight = unscaledViewport.height * fitScale;

          // Render at ultra-high resolution (4.0x DPI) for vector-crisp text sharpness
          const renderScale = 4.0;
          const viewport = page.getViewport({ scale: renderScale });

          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.height = viewport.height;
          offscreenCanvas.width = viewport.width;

          const context = offscreenCanvas.getContext('2d', { alpha: false });
          if (context) {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
          }

          await page.render({
            canvasContext: context!,
            viewport,
            intent: 'print',
          } as any).promise;

          const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.98);

          const imgLeft = pageCenterX + (pageW - targetWidth) / 2;
          const imgTop = pageCenterY + (pageH - targetHeight) / 2;

          const imgObj = {
            type: 'image',
            name: 'pdf-page',
            version: '6.6.0',
            originX: 'left',
            originY: 'top',
            left: imgLeft,
            top: imgTop,
            width: viewport.width,
            height: viewport.height,
            scaleX: targetWidth / viewport.width,
            scaleY: targetHeight / viewport.height,
            src: dataUrl,
            selectable: true,
            evented: true,
            shadow: {
              color: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.18)',
              blur: 24,
              offsetX: 0,
              offsetY: 8,
            },
          };

          const pageJson = JSON.stringify({
            version: '6.6.0',
            objects: [imgObj],
          });

          pagesData.push({
            canvasData: pageJson,
            name: `Page ${pNum}`,
          });
        }

        // Create notebook with all its pages
        const newNotebookId = await createNotebookWithPages(
          item.name,
          targetFolder,
          userId,
          pagesData
        );

        createdIds.push(newNotebookId);
      }

      setImportedNotebookIds(createdIds);
      setIsCompleted(true);
    } catch (err) {
      console.error('Error importing batch PDFs:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenFirst = async () => {
    if (importedNotebookIds.length > 0) {
      onClose();
      await openNotebook(importedNotebookIds[0]);
    }
  };

  const handleResetAndClose = () => {
    setFiles([]);
    setIsProcessing(false);
    setIsCompleted(false);
    setImportedNotebookIds([]);
    onClose();
  };

  if (!isOpen) return null;

  const totalProgress = files.length > 0
    ? Math.round((((currentFileIndex - 1) + (totalFilePages > 0 ? (currentPageIndex / totalFilePages) : 0)) / files.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-xl rounded-3xl shadow-2xl border backdrop-blur-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isDarkMode 
            ? 'bg-[#181926]/95 border-gray-700/80 text-gray-100 shadow-black/70' 
            : 'bg-white/95 border-gray-200 text-gray-800 shadow-indigo-500/10'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/20">
              <FileUp size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Batch PDF to Notes Import</h2>
              <p className="text-xs opacity-60">Import multiple PDFs as separate interactive notebooks</p>
            </div>
          </div>
          {!isProcessing && (
            <button 
              onClick={handleResetAndClose}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
              }`}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[68vh] custom-scrollbar space-y-5">
          {isCompleted ? (
            /* Success Screen */
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10 animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Import Completed Successfully!</h3>
                <p className="text-sm opacity-60 mt-1">
                  Created {importedNotebookIds.length} new {importedNotebookIds.length === 1 ? 'notebook' : 'notebooks'} from your PDFs.
                </p>
              </div>
              <div className="pt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    isDarkMode ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  Back to Library
                </button>
                <button
                  type="button"
                  onClick={handleOpenFirst}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-lg shadow-teal-500/25 flex items-center gap-2 transition-transform hover:scale-[1.02]"
                >
                  <BookOpen size={16} /> Open First Notebook
                </button>
              </div>
            </div>
          ) : isProcessing ? (
            /* Processing Screen */
            <div className="py-8 space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/15 text-teal-400 flex items-center justify-center mx-auto animate-pulse">
                <Loader2 size={32} className="animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold">
                  Importing Document {currentFileIndex} of {files.length}
                </h3>
                <p className="text-xs opacity-60">
                  {files[currentFileIndex - 1]?.name} — Page {currentPageIndex} of {totalFilePages || 1}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700/60 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(5, totalProgress))}%` }}
                />
              </div>
              <div className="text-xs font-mono font-medium opacity-50">
                {totalProgress}% processed
              </div>
            </div>
          ) : (
            /* Normal Selection Screen */
            <>
              {/* Drag and drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-teal-500 bg-teal-500/10 scale-[1.01]' 
                    : isDarkMode 
                      ? 'border-gray-700 hover:border-teal-500/60 hover:bg-teal-500/5 bg-gray-800/30' 
                      : 'border-gray-300 hover:border-teal-500/60 hover:bg-teal-50/50 bg-gray-50'
                }`}
              >
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".pdf,application/pdf" 
                  multiple 
                  className="hidden" 
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
                <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-teal-500 flex items-center justify-center mx-auto mb-3">
                  <FileUp size={24} />
                </div>
                <h4 className="text-sm font-semibold mb-1">Click to select or drag & drop multiple PDF files</h4>
                <p className="text-xs opacity-50">Every selected PDF will be converted into its own notebook</p>
              </div>

              {/* Target Folder Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2 opacity-70">
                  Target Destination Folder
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Folder size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" />
                    <select
                      value={selectedFolderId || 'unfiled'}
                      onChange={(e) => setSelectedFolderId(e.target.value === 'unfiled' ? null : e.target.value)}
                      className={`w-full text-xs font-medium pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors cursor-pointer ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-gray-200' 
                          : 'bg-white border-gray-300 text-gray-800'
                      }`}
                    >
                      <option value="unfiled">📁 Unfiled (Root Library)</option>
                      {folders.map(f => (
                        <option key={f.id} value={f.id}>
                          📁 {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                      Selected Documents ({files.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {files.map((item) => (
                      <div 
                        key={item.id}
                        className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border text-xs transition-colors ${
                          isDarkMode ? 'bg-gray-800/60 border-gray-700/60' : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <FileText size={16} className="text-teal-400 shrink-0" />
                          <input 
                            type="text"
                            value={item.name}
                            onChange={(e) => handleTitleChange(item.id, e.target.value)}
                            className="bg-transparent font-medium focus:outline-none focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-0.5 w-full text-xs"
                            title="Click to rename note"
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] opacity-40 font-mono">
                            {(item.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(item.id)}
                            className="text-gray-400 hover:text-red-400 p-1 transition-colors"
                            title="Remove file"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isCompleted && !isProcessing && (
          <div className="px-6 py-4 border-t border-gray-200/20 flex justify-between items-center bg-gray-500/5">
            <span className="text-xs opacity-50">
              {files.length > 0 ? `${files.length} ${files.length === 1 ? 'notebook' : 'notebooks'} will be created` : 'No files selected yet'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className={`px-4 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  isDarkMode ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-200 hover:bg-gray-100 text-gray-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={files.length === 0}
                onClick={handleStartImport}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 disabled:opacity-40 disabled:pointer-events-none text-white shadow-md shadow-teal-500/20 transition-all hover:scale-[1.02]"
              >
                <span>Import All PDFs</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
