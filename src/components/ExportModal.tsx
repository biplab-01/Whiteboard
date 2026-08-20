import React, { useState } from 'react';
import { useBoardStore, getPageDimensions, getPageBackgroundSettings } from '../store/useBoardStore';
import { Download, FileText, Image as ImageIcon, CheckCircle, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import * as fabric from 'fabric';

export const ExportModal: React.FC = () => {
  const { isDarkMode, pages, notebooks, activeNotebookId, currentPageId, bgType, bgColor, isRuled, ruleColor, pageSize, pageOrientation } = useBoardStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeNotebook = notebooks.find(n => n.id === activeNotebookId);
  const notebookTitle = activeNotebook?.name || 'Nova_Canvas';

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getActiveCanvas = (): HTMLCanvasElement | null => {
    return document.getElementById('board-canvas') as HTMLCanvasElement | null;
  };

  // Render a specific page JSON to an offscreen image data URL with its own background settings
  const renderPageToDataUrl = async (pageData: string | null, targetPageId?: string): Promise<string> => {
    const pageSettings = getPageBackgroundSettings(targetPageId);

    const curPageSize = pageSettings.pageSize || pageSize || 'a4';
    const curOrientation = pageSettings.pageOrientation || pageOrientation || 'portrait';
    const curBgType = pageSettings.bgType || bgType || 'solid';
    const curBgColor = pageSettings.bgColor || bgColor || '#ffffff';
    const curIsRuled = pageSettings.isRuled !== undefined ? pageSettings.isRuled : isRuled;
    const curRuleColor = pageSettings.ruleColor || ruleColor || '#cbd5e1';

    const { width: pageW, height: pageH } = getPageDimensions(curPageSize, curOrientation);
    const origW = window.innerWidth;
    const origH = window.innerHeight;
    const origX = (origW - pageW) / 2;
    const origY = Math.max(50, (origH - pageH) / 2);

    const offscreenEl = document.createElement('canvas');
    offscreenEl.width = pageW * 2;
    offscreenEl.height = pageH * 2;
    
    const staticCanvas = new fabric.StaticCanvas(offscreenEl, {
      width: pageW * 2,
      height: pageH * 2,
    });

    if (pageData) {
      try {
        const parsed = typeof pageData === 'string' ? JSON.parse(pageData) : pageData;
        if (parsed.objects) {
          parsed.objects = parsed.objects.filter((o: any) => o.name !== 'a4-background' && o.name !== 'a4-ruled-line');
        }
        await staticCanvas.loadFromJSON(parsed);
      } catch (e) {
        console.warn('Error loading page JSON for export:', e);
      }
    }

    // Draw background rect
    let fillStyle: any = curBgColor;
    if (curBgType === 'gradient' && curBgColor.includes(',')) {
      const [c1, c2] = curBgColor.split(',');
      fillStyle = new fabric.Gradient({
        type: 'linear',
        coords: { x1: origX, y1: origY, x2: origX + pageW, y2: origY + pageH },
        colorStops: [
          { offset: 0, color: c1.trim() },
          { offset: 1, color: c2.trim() }
        ]
      });
    }

    const bgRect = new fabric.Rect({
      left: origX,
      top: origY,
      width: pageW,
      height: pageH,
      fill: fillStyle,
      selectable: false
    });
    staticCanvas.add(bgRect);
    staticCanvas.sendObjectToBack(bgRect);

    if (curIsRuled) {
      const lineSpacing = 30;
      for (let i = lineSpacing; i < pageH; i += lineSpacing) {
        const line = new fabric.Line([origX, origY + i, origX + pageW, origY + i], {
          stroke: curRuleColor,
          strokeWidth: 1,
          selectable: false,
          opacity: 0.5
        });
        staticCanvas.add(line);
        staticCanvas.sendObjectToBack(line);
      }
      staticCanvas.sendObjectToBack(bgRect);
    }

    // Map screen viewport coordinates directly to (0, 0, pageW*2, pageH*2)
    staticCanvas.setViewportTransform([2, 0, 0, 2, -origX * 2, -origY * 2]);
    staticCanvas.renderAll();
    const dataUrl = staticCanvas.toDataURL({ format: 'png', multiplier: 1 });
    staticCanvas.dispose();
    return dataUrl;
  };

  // Export current view as Image
  const exportCurrentAsImage = (format: 'png' | 'jpeg') => {
    setIsExporting(true);
    try {
      const canvasEl = getActiveCanvas();
      if (!canvasEl) return;

      const currentPage = pages.find(p => p.id === currentPageId);
      renderPageToDataUrl((currentPage?.canvas_data as string) || null, currentPageId || undefined).then((dataUrl) => {
        triggerDownload(dataUrl, `${notebookTitle}.${format === 'jpeg' ? 'jpg' : 'png'}`);
        showSuccess(`Exported as ${format.toUpperCase()}`);
      }).finally(() => setIsExporting(false));
    } catch (err) {
      console.error('Export error:', err);
      setIsExporting(false);
    }
  };

  // Export Single Page as PDF
  const exportSinglePagePdf = async () => {
    setIsExporting(true);
    try {
      const currentPage = pages.find(p => p.id === currentPageId);
      const dataUrl = await renderPageToDataUrl((currentPage?.canvas_data as string) || null, currentPageId || undefined);
      const { width: pageW, height: pageH } = getPageDimensions(pageSize, pageOrientation);
      
      const pdfFormat = pageSize === 'letter' ? 'letter' : pageSize === 'legal' ? 'legal' : pageSize === 'a3' ? 'a3' : pageSize === 'a5' ? 'a5' : pageSize === 'tabloid' ? 'ledger' : [pageW * 0.264583, pageH * 0.264583];

      const pdf = new jsPDF({
        orientation: pageOrientation,
        unit: 'mm',
        format: pdfFormat
      });

      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
      pdf.save(`${notebookTitle}.pdf`);
      showSuccess('PDF Downloaded');
    } catch (e) {
      console.error('PDF export error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // Export All Pages as Multi-Page PDF
  const exportAllPagesPdf = async () => {
    setIsExporting(true);
    try {
      const firstPageSettings = getPageBackgroundSettings(pages[0]?.id);
      const firstSize = firstPageSettings.pageSize || pageSize || 'a4';
      const firstOrient = firstPageSettings.pageOrientation || pageOrientation || 'portrait';
      const { width: firstW, height: firstH } = getPageDimensions(firstSize, firstOrient);
      const firstPdfFormat = firstSize === 'letter' ? 'letter' : firstSize === 'legal' ? 'legal' : firstSize === 'a3' ? 'a3' : firstSize === 'a5' ? 'a5' : firstSize === 'tabloid' ? 'ledger' : [firstW * 0.264583, firstH * 0.264583];

      const pdf = new jsPDF({
        orientation: firstOrient,
        unit: 'mm',
        format: firstPdfFormat
      });

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const pageSettings = getPageBackgroundSettings(page.id);
        const curPageSize = pageSettings.pageSize || pageSize || 'a4';
        const curOrientation = pageSettings.pageOrientation || pageOrientation || 'portrait';
        const { width: pageW, height: pageH } = getPageDimensions(curPageSize, curOrientation);
        const curPdfFormat = curPageSize === 'letter' ? 'letter' : curPageSize === 'legal' ? 'legal' : curPageSize === 'a3' ? 'a3' : curPageSize === 'a5' ? 'a5' : curPageSize === 'tabloid' ? 'ledger' : [pageW * 0.264583, pageH * 0.264583];

        if (i > 0) {
          pdf.addPage(curPdfFormat, curOrientation);
        }
        const dataUrl = await renderPageToDataUrl((page.canvas_data as string) || null, page.id);
        const curPdfW = pdf.internal.pageSize.getWidth();
        const curPdfH = pdf.internal.pageSize.getHeight();
        pdf.addImage(dataUrl, 'PNG', 0, 0, curPdfW, curPdfH, undefined, 'FAST');
      }

      pdf.save(`${notebookTitle}.pdf`);
      showSuccess(`Exported ${pages.length} Pages as PDF`);
    } catch (e) {
      console.error('All pages PDF error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
      setIsOpen(false);
    }, 1800);
  };

  return (
    <div className="fixed top-[76px] left-6 z-20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3.5 py-2.5 rounded-xl shadow-md border backdrop-blur-md transition-all flex items-center gap-2 font-medium text-sm ${
          isDarkMode 
            ? 'bg-gray-800/80 border-gray-700 text-gray-200 hover:bg-gray-700' 
            : 'bg-white/80 border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
        title="Export or Download"
      >
        <Download size={18} />
        <span>Export</span>
      </button>

      {isOpen && (
        <div className={`mt-2 p-4 rounded-2xl shadow-2xl border w-80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
          isDarkMode ? 'bg-[#1a1c29]/95 border-gray-700 text-white' : 'bg-white/95 border-gray-200 text-gray-800'
        }`}>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-semibold text-base">Export & Download</h3>
              <p className="text-xs text-gray-400">Save your whiteboard pages</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-red-500 text-sm p-1">✕</button>
          </div>

          {successMsg ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-green-500 animate-in fade-in">
              <CheckCircle size={36} />
              <p className="font-semibold text-sm">{successMsg}</p>
            </div>
          ) : isExporting ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-indigo-400 animate-in fade-in">
              <Loader2 size={32} className="animate-spin" />
              <p className="text-xs font-medium text-gray-300">Generating export file...</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1 pt-1">PDF Documents</div>
              
              <button
                onClick={exportSinglePagePdf}
                className={`w-full p-2.5 rounded-xl border flex items-center gap-3 transition-all hover:scale-[1.01] text-left ${
                  isDarkMode ? 'bg-gray-800/60 border-gray-700 hover:bg-gray-750' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="text-xs font-semibold">Current Page as PDF</div>
                  <div className="text-[10px] text-gray-400">Crisp high-res A4 document</div>
                </div>
              </button>

              <button
                onClick={exportAllPagesPdf}
                className={`w-full p-2.5 rounded-xl border flex items-center gap-3 transition-all hover:scale-[1.01] text-left ${
                  isDarkMode ? 'bg-gray-800/60 border-gray-700 hover:bg-gray-750' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="p-2 rounded-lg bg-red-600/10 text-red-600">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="text-xs font-semibold">Entire Notebook (All {pages.length} Pages)</div>
                  <div className="text-[10px] text-gray-400">Combined multi-page PDF</div>
                </div>
              </button>

              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1 pt-2">Image Files</div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => exportCurrentAsImage('png')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-[1.02] text-center ${
                    isDarkMode ? 'bg-gray-800/60 border-gray-700 hover:bg-gray-750' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <ImageIcon size={18} />
                  </div>
                  <div className="text-xs font-semibold">PNG Image</div>
                  <div className="text-[9px] text-gray-400">2x Retina Quality</div>
                </button>

                <button
                  onClick={() => exportCurrentAsImage('jpeg')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all hover:scale-[1.02] text-center ${
                    isDarkMode ? 'bg-gray-800/60 border-gray-700 hover:bg-gray-750' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <ImageIcon size={18} />
                  </div>
                  <div className="text-xs font-semibold">JPEG Image</div>
                  <div className="text-[9px] text-gray-400">Standard Image</div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
