import { useEffect, useRef, useCallback, useState } from 'react';
import * as fabric from 'fabric';
import { useBoardStore, getPageDimensions } from '../store/useBoardStore';
import * as pdfjsLib from 'pdfjs-dist';
// For Vite we can import the worker as a URL
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { 
  BringToFront, 
  SendToBack, 
  ChevronUp, 
  ChevronDown, 
  Copy, 
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Maximize2,
  FlipHorizontal,
  FlipVertical,
  Layers
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Ensure scaling shapes does not enlarge their stroke width
fabric.FabricObject.prototype.strokeUniform = true;
// Select objects strictly when clicking on their visible stroke / pixels
fabric.FabricObject.prototype.perPixelTargetFind = true;
(fabric.Canvas.prototype as any).targetFindTolerance = 6;

// Textbox & IText scaling behavior: prevent flip
fabric.Textbox.prototype.lockScalingFlip = true;
fabric.IText.prototype.lockScalingFlip = true;

// Helper: Normalize Textbox dimensions, scale, and controls to prevent distortion
const normalizeTextObject = (obj: fabric.FabricObject) => {
  if (obj.type === 'textbox' || obj.type === 'i-text') {
    const textObj = obj as fabric.Textbox;
    textObj.setControlsVisibility({
      mt: false,
      mb: false,
    });
    textObj.lockScalingFlip = true;
    textObj.splitByGrapheme = false; // Always wrap full words, not individual characters

    const sx = textObj.scaleX ?? 1;
    const sy = textObj.scaleY ?? 1;
    if (sx !== 1 || sy !== 1) {
      const scale = sy !== 1 ? sy : sx;
      const curFontSize = textObj.fontSize ?? 24;
      const newFontSize = Math.max(8, Math.round(curFontSize * scale));
      const curWidth = textObj.width ?? 200;
      const newWidth = Math.max(40, Math.round((curWidth * sx) / scale));
      textObj.set({
        fontSize: newFontSize,
        width: newWidth,
        scaleX: 1,
        scaleY: 1,
      });
      (textObj as any)._forceClearCache = true;
      textObj.dirty = true;
      if (typeof textObj.initDimensions === 'function') {
        textObj.initDimensions();
      }
      textObj.setCoords();
    }
  }
};

// Helper: Thoroughly clear per-character override styles from a Textbox
const clearStylePropertyFromAllChars = (textObj: fabric.Textbox, property: string) => {
  if (!textObj.styles) return;
  const styles = textObj.styles as any;
  for (const lineIndex of Object.keys(styles)) {
    const line = styles[lineIndex];
    if (line) {
      for (const charIndex of Object.keys(line)) {
        if (line[charIndex]) {
          delete line[charIndex][property];
          if (Object.keys(line[charIndex]).length === 0) {
            delete line[charIndex];
          }
        }
      }
      if (Object.keys(line).length === 0) {
        delete styles[lineIndex];
      }
    }
  }
  if (typeof (textObj as any).removeStyle === 'function') {
    (textObj as any).removeStyle(property);
  }
};

// Helper: Calculate distance from a point to a line segment
const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
};

// Helper: Extract sampled points in scene coordinates along any object's perimeter/path/stroke
interface SampledScenePoint {
  x: number;
  y: number;
}

const getObjectSampledPoints = (obj: any): SampledScenePoint[] => {
  const matrix = obj.calcTransformMatrix();
  const points: SampledScenePoint[] = [];

  if (obj.type === 'path' && Array.isArray(obj.path)) {
    const offX = obj.pathOffset?.x || 0;
    const offY = obj.pathOffset?.y || 0;
    let lastLocal: { x: number; y: number } | null = null;

    for (const cmd of obj.path) {
      const type = cmd[0];
      if (type === 'M' || type === 'L') {
        const curLocal = { x: Number(cmd[1]) - offX, y: Number(cmd[2]) - offY };
        if (!lastLocal || type === 'M') {
          const scenePt = fabric.util.transformPoint(new fabric.Point(curLocal.x, curLocal.y), matrix);
          points.push({ x: scenePt.x, y: scenePt.y });
        } else {
          const d = Math.hypot(curLocal.x - lastLocal.x, curLocal.y - lastLocal.y);
          const steps = Math.max(1, Math.ceil(d / 3));
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const lx = lastLocal.x + (curLocal.x - lastLocal.x) * t;
            const ly = lastLocal.y + (curLocal.y - lastLocal.y) * t;
            const scenePt = fabric.util.transformPoint(new fabric.Point(lx, ly), matrix);
            points.push({ x: scenePt.x, y: scenePt.y });
          }
        }
        lastLocal = curLocal;
      } else if (type === 'Q') {
        const cpLocal = { x: Number(cmd[1]) - offX, y: Number(cmd[2]) - offY };
        const endLocal = { x: Number(cmd[3]) - offX, y: Number(cmd[4]) - offY };
        const startLocal = lastLocal || cpLocal;
        const d = Math.hypot(endLocal.x - startLocal.x, endLocal.y - startLocal.y);
        const steps = Math.max(2, Math.ceil(d / 3));

        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const oneMinusT = 1 - t;
          const lx = oneMinusT * oneMinusT * startLocal.x + 2 * oneMinusT * t * cpLocal.x + t * t * endLocal.x;
          const ly = oneMinusT * oneMinusT * startLocal.y + 2 * oneMinusT * t * cpLocal.y + t * t * endLocal.y;
          const scenePt = fabric.util.transformPoint(new fabric.Point(lx, ly), matrix);
          points.push({ x: scenePt.x, y: scenePt.y });
        }
        lastLocal = endLocal;
      } else if (type === 'C') {
        const endLocal = { x: Number(cmd[5]) - offX, y: Number(cmd[6]) - offY };
        const scenePt = fabric.util.transformPoint(new fabric.Point(endLocal.x, endLocal.y), matrix);
        points.push({ x: scenePt.x, y: scenePt.y });
        lastLocal = endLocal;
      }
    }
  } else if (obj.type === 'line') {
    const start = fabric.util.transformPoint(new fabric.Point(obj.x1 || 0, obj.y1 || 0), matrix);
    const end = fabric.util.transformPoint(new fabric.Point(obj.x2 || 0, obj.y2 || 0), matrix);
    const totalLen = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(2, Math.ceil(totalLen / 3));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      points.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
    }
  } else if (obj.type === 'rect') {
    const w = obj.width || 0;
    const h = obj.height || 0;
    const corners = [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
      { x: -w / 2, y: -h / 2 }
    ];
    for (let i = 0; i < 4; i++) {
      const c1 = corners[i];
      const c2 = corners[i + 1];
      const edgeLen = Math.hypot(c2.x - c1.x, c2.y - c1.y);
      const steps = Math.max(2, Math.ceil(edgeLen / 3));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const lx = c1.x + (c2.x - c1.x) * t;
        const ly = c1.y + (c2.y - c1.y) * t;
        const scenePt = fabric.util.transformPoint(new fabric.Point(lx, ly), matrix);
        points.push({ x: scenePt.x, y: scenePt.y });
      }
    }
  } else if (obj.type === 'triangle') {
    const w = obj.width || 0;
    const h = obj.height || 0;
    const corners = [
      { x: 0, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
      { x: 0, y: -h / 2 }
    ];
    for (let i = 0; i < 3; i++) {
      const c1 = corners[i];
      const c2 = corners[i + 1];
      const edgeLen = Math.hypot(c2.x - c1.x, c2.y - c1.y);
      const steps = Math.max(2, Math.ceil(edgeLen / 3));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const lx = c1.x + (c2.x - c1.x) * t;
        const ly = c1.y + (c2.y - c1.y) * t;
        const scenePt = fabric.util.transformPoint(new fabric.Point(lx, ly), matrix);
        points.push({ x: scenePt.x, y: scenePt.y });
      }
    }
  } else if (obj.type === 'ellipse' || obj.type === 'circle') {
    const rx = obj.rx || (obj.radius || 0);
    const ry = obj.ry || (obj.radius || 0);
    const perimeterApprox = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    const steps = Math.max(16, Math.ceil(perimeterApprox / 3));
    for (let s = 0; s < steps; s++) {
      const theta = (s / steps) * 2 * Math.PI;
      const lx = rx * Math.cos(theta);
      const ly = ry * Math.sin(theta);
      const scenePt = fabric.util.transformPoint(new fabric.Point(lx, ly), matrix);
      points.push({ x: scenePt.x, y: scenePt.y });
    }
  } else if (obj.type === 'polygon' && Array.isArray(obj.points) && obj.points.length > 1) {
    const offX = obj.pathOffset?.x || 0;
    const offY = obj.pathOffset?.y || 0;
    const polyPts = obj.points.map((p: any) => ({ x: p.x - offX, y: p.y - offY }));
    const count = polyPts.length;
    for (let i = 0; i < count; i++) {
      const c1 = polyPts[i];
      const c2 = polyPts[(i + 1) % count];
      const edgeLen = Math.hypot(c2.x - c1.x, c2.y - c1.y);
      const steps = Math.max(2, Math.ceil(edgeLen / 3));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const lx = c1.x + (c2.x - c1.x) * t;
        const ly = c1.y + (c2.y - c1.y) * t;
        const scenePt = fabric.util.transformPoint(new fabric.Point(lx, ly), matrix);
        points.push({ x: scenePt.x, y: scenePt.y });
      }
    }
  }

  return points;
};

// Helper: Universally slice any vector object (shape, path, line) when cut by partial eraser
const sliceObjectWithEraser = (
  obj: any,
  p1: fabric.Point,
  p2: fabric.Point,
  radius: number
): { modified: boolean; remainingPaths: fabric.Path[] } => {
  if (!obj || (obj as any).name === 'a4-background' || (obj as any).name === 'a4-ruled-line') {
    return { modified: false, remainingPaths: [] };
  }

  const supportedTypes = ['path', 'line', 'rect', 'triangle', 'ellipse', 'circle', 'polygon'];
  if (!supportedTypes.includes(obj.type)) {
    return { modified: false, remainingPaths: [] };
  }

  const sampledPoints = getObjectSampledPoints(obj);
  if (sampledPoints.length === 0) {
    return { modified: false, remainingPaths: [] };
  }

  const strokeW = (obj.strokeWidth || 1) * Math.max(obj.scaleX || 1, obj.scaleY || 1);
  const effectiveRadius = radius + strokeW / 2;

  let anyErased = false;
  const isPointErased = sampledPoints.map((pt) => {
    const dist = distToSegment(pt.x, pt.y, p1.x, p1.y, p2.x, p2.y);
    if (dist <= effectiveRadius) {
      anyErased = true;
      return true;
    }
    return false;
  });

  if (!anyErased) {
    return { modified: false, remainingPaths: [] };
  }

  const isClosedLoop = ['rect', 'triangle', 'ellipse', 'circle', 'polygon'].includes(obj.type);
  
  const chains: SampledScenePoint[][] = [];
  let currentChain: SampledScenePoint[] = [];

  for (let i = 0; i < sampledPoints.length; i++) {
    if (!isPointErased[i]) {
      currentChain.push(sampledPoints[i]);
    } else {
      if (currentChain.length >= 2) {
        chains.push(currentChain);
      }
      currentChain = [];
    }
  }
  if (currentChain.length >= 2) {
    chains.push(currentChain);
  }

  // If it was a closed shape and neither start nor end point was erased,
  // connect the chain wrapping around the loop so it remains one continuous open stroke
  if (isClosedLoop && chains.length >= 2 && !isPointErased[0] && !isPointErased[sampledPoints.length - 1]) {
    const lastChain = chains.pop()!;
    const firstChain = chains[0];
    chains[0] = [...lastChain, ...firstChain];
  }

  const strokeColor = obj.stroke || (useBoardStore.getState().isDarkMode ? '#ffffff' : '#000000');
  const remainingPaths: fabric.Path[] = chains.map((chain) => {
    let d = `M ${chain[0].x.toFixed(2)} ${chain[0].y.toFixed(2)}`;
    for (let i = 1; i < chain.length; i++) {
      d += ` L ${chain[i].x.toFixed(2)} ${chain[i].y.toFixed(2)}`;
    }
    return new fabric.Path(d, {
      stroke: strokeColor,
      strokeWidth: obj.strokeWidth || 3,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      strokeUniform: true,
      opacity: obj.opacity ?? 1,
      fill: undefined,
      selectable: false,
      evented: false,
    });
  });

  return { modified: true, remainingPaths };
};

export const Board: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const activePageIdRef = useRef<string | null>(null);
  const clipboardRef = useRef<fabric.FabricObject | null>(null);
  const historyMapRef = useRef<Map<string, { undoStack: string[]; redoStack: string[] }>>(new Map());
  const isHistoryOperationRef = useRef<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  
  const { 
    currentPageId, 
    pages,
    currentTool, 
    strokeColor, 
    strokeWidth, 
    fillColor,
    isRuled,
    ruleColor,
    bgType,
    bgColor,
    pageSize,
    pageOrientation,
    opacity,
    setCurrentTool,
    isDarkMode,
    setActiveTextFormat,
    eraserMode,
    eraserSize
  } = useBoardStore();

  const currentPage = pages.find(p => p.id === currentPageId);

  const renderBackground = useCallback((canvas: fabric.Canvas) => {
    const { width: pageW, height: pageH } = getPageDimensions(pageSize, pageOrientation);
    const x = (canvas.width! - pageW) / 2;
    const y = Math.max(50, (canvas.height! - pageH) / 2); // 50px top padding

    // For the actual canvas background (the infinite space outside page)
    canvas.backgroundColor = isDarkMode ? '#121212' : '#e5e7eb'; 

    // Remove old page background and ruled lines if exists
    const oldBgs = canvas.getObjects().filter((o: any) => o.name === 'a4-background' || o.name === 'a4-ruled-line');
    oldBgs.forEach(o => canvas.remove(o));

    // Determine Page background fill
    let pageBg: string | fabric.Gradient<any> = bgColor;
    if (bgType === 'none' || bgColor === 'transparent') {
      pageBg = isDarkMode ? '#1a1c29' : '#ffffff';
    } else if (bgType === 'gradient') {
      if (bgColor.includes(',')) {
        const [c1, c2] = bgColor.split(',');
        pageBg = new fabric.Gradient({
          type: 'linear',
          coords: { x1: 0, y1: 0, x2: pageW, y2: pageH },
          colorStops: [
            { offset: 0, color: c1.trim() },
            { offset: 1, color: c2.trim() }
          ]
        });
      } else {
        pageBg = bgColor;
      }
    } else {
      pageBg = bgColor || (isDarkMode ? '#1a1c29' : '#ffffff');
    }

    const pageRect: any = new fabric.Rect({
      left: x,
      top: y,
      width: pageW,
      height: pageH,
      fill: pageBg,
      stroke: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
      strokeWidth: 1,
      strokeUniform: true,
      selectable: false,
      evented: false, // Don't block interactions
      excludeFromExport: true,
      shadow: new fabric.Shadow({
        color: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.14)',
        blur: 24,
        offsetX: 0,
        offsetY: 8
      })
    });

    pageRect.name = 'a4-background';
    canvas.add(pageRect);
    canvas.sendObjectToBack(pageRect);

    // Draw Ruled Lines
    if (isRuled) {
      const lineSpacing = 30; // standard ruled line spacing
      const ruledLines: fabric.Line[] = [];
      for (let i = lineSpacing; i < pageH; i += lineSpacing) {
        const line: any = new fabric.Line([x, y + i, x + pageW, y + i], {
          stroke: ruleColor || (isDarkMode ? '#374151' : '#cbd5e1'),
          strokeWidth: 1,
          selectable: false,
          evented: false,
          opacity: 0.5,
          excludeFromExport: true,
        });
        line.name = 'a4-ruled-line';
        ruledLines.push(line);
        canvas.add(line);
      }
      // Send lines to back right above pageRect (lines first, then pageRect to very back)
      ruledLines.forEach(l => canvas.sendObjectToBack(l));
      canvas.sendObjectToBack(pageRect);
    }

    canvas.requestRenderAll();
  }, [pageSize, pageOrientation, isDarkMode, bgColor, bgType, isRuled, ruleColor]);

  const getCanvasSnapshot = useCallback((canvas: fabric.Canvas): string => {
    const json = (canvas as any).toJSON(['name', 'excludeFromExport']);
    if (json && Array.isArray(json.objects)) {
      json.objects = json.objects.filter((o: any) => o.name !== 'a4-background' && o.name !== 'a4-ruled-line');
    }
    return JSON.stringify(json);
  }, []);

  const saveState = useCallback((snapshot?: string) => {
    const targetPageId = activePageIdRef.current || useBoardStore.getState().currentPageId;
    const { updatePageData: liveUpdate } = useBoardStore.getState();
    const canvas = fabricRef.current;
    if (canvas && targetPageId) {
      const data = snapshot ?? getCanvasSnapshot(canvas);
      liveUpdate(targetPageId, data);
    }
  }, [getCanvasSnapshot]);

  const recordState = useCallback(() => {
    if (isHistoryOperationRef.current) return;
    const canvas = fabricRef.current;
    const targetPageId = activePageIdRef.current || useBoardStore.getState().currentPageId;
    if (!canvas || !targetPageId) return;

    const snapshot = getCanvasSnapshot(canvas);
    let history = historyMapRef.current.get(targetPageId);
    if (!history) {
      history = { undoStack: [], redoStack: [] };
      historyMapRef.current.set(targetPageId, history);
    }

    const top = history.undoStack[history.undoStack.length - 1];
    if (top === snapshot) return;

    history.undoStack.push(snapshot);
    if (history.undoStack.length > 60) {
      history.undoStack.shift();
    }
    history.redoStack = [];

    useBoardStore.getState().setCanUndo(history.undoStack.length > 1);
    useBoardStore.getState().setCanRedo(false);

    saveState(snapshot);
  }, [getCanvasSnapshot, saveState]);

  const initPageHistory = useCallback((pageId: string, initialSnapshot: string) => {
    let history = historyMapRef.current.get(pageId);
    if (!history) {
      history = { undoStack: [initialSnapshot], redoStack: [] };
      historyMapRef.current.set(pageId, history);
    } else if (history.undoStack.length === 0) {
      history.undoStack = [initialSnapshot];
      history.redoStack = [];
    }
    useBoardStore.getState().setCanUndo(history.undoStack.length > 1);
    useBoardStore.getState().setCanRedo(history.redoStack.length > 0);
  }, []);

  const handleUndo = useCallback(async () => {
    if (isHistoryOperationRef.current) return;
    const canvas = fabricRef.current;
    const livePageId = useBoardStore.getState().currentPageId;
    if (!canvas || !livePageId) return;

    const history = historyMapRef.current.get(livePageId);
    if (!history || history.undoStack.length <= 1) {
      useBoardStore.getState().setCanUndo(false);
      return;
    }

    isHistoryOperationRef.current = true;

    try {
      const currentState = history.undoStack.pop()!;
      history.redoStack.push(currentState);

      const prevState = history.undoStack[history.undoStack.length - 1];
      canvas.discardActiveObject();

      const parsed = JSON.parse(prevState);

      await canvas.loadFromJSON(parsed);

      const liveTool = useBoardStore.getState().currentTool;
      const isSelect = liveTool === 'select';
      canvas.forEachObject((obj) => {
        if ((obj as any).name !== 'a4-background' && (obj as any).name !== 'a4-ruled-line') {
          obj.selectable = isSelect;
          obj.evented = true;
          obj.strokeUniform = true;
        }
      });

      renderBackground(canvas);
      canvas.requestRenderAll();

      useBoardStore.getState().setCanUndo(history.undoStack.length > 1);
      useBoardStore.getState().setCanRedo(history.redoStack.length > 0);

      saveState(prevState);
    } catch (err) {
      console.error('Error during undo:', err);
    } finally {
      isHistoryOperationRef.current = false;
    }
  }, [renderBackground, saveState]);

  const handleRedo = useCallback(async () => {
    if (isHistoryOperationRef.current) return;
    const canvas = fabricRef.current;
    const livePageId = useBoardStore.getState().currentPageId;
    if (!canvas || !livePageId) return;

    const history = historyMapRef.current.get(livePageId);
    if (!history || history.redoStack.length === 0) {
      useBoardStore.getState().setCanRedo(false);
      return;
    }

    isHistoryOperationRef.current = true;

    try {
      const nextState = history.redoStack.pop()!;
      history.undoStack.push(nextState);

      canvas.discardActiveObject();

      const parsed = JSON.parse(nextState);

      await canvas.loadFromJSON(parsed);

      const liveTool = useBoardStore.getState().currentTool;
      const isSelect = liveTool === 'select';
      canvas.forEachObject((obj) => {
        if ((obj as any).name !== 'a4-background' && (obj as any).name !== 'a4-ruled-line') {
          obj.selectable = isSelect;
          obj.evented = true;
          obj.strokeUniform = true;
        }
      });

      renderBackground(canvas);
      canvas.requestRenderAll();

      useBoardStore.getState().setCanUndo(history.undoStack.length > 1);
      useBoardStore.getState().setCanRedo(history.redoStack.length > 0);

      saveState(nextState);
    } catch (err) {
      console.error('Error during redo:', err);
    } finally {
      isHistoryOperationRef.current = false;
    }
  }, [renderBackground, saveState]);

  // Initialize Fabric Canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Create canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      selection: true,
      preserveObjectStacking: true, // Keep objects in their z-index
      perPixelTargetFind: true,
      targetFindTolerance: 6,
    });
    
    // Override findTarget so active shapes are immediately draggable from anywhere inside their boundary
    const originalFindTarget = canvas.findTarget.bind(canvas);
    (canvas as any).findTarget = function(e: MouseEvent | fabric.TPointerEvent) {
      const active = canvas.getActiveObject();
      if (active && (active as any).name !== 'a4-background' && (active as any).name !== 'a4-ruled-line') {
        const scenePoint = canvas.getScenePoint(e);
        let isInside = false;
        if (typeof active.containsPoint === 'function') {
          isInside = active.containsPoint(scenePoint);
        }
        if (!isInside) {
          const b = active.getBoundingRect();
          isInside = (
            scenePoint.x >= b.left &&
            scenePoint.x <= b.left + b.width &&
            scenePoint.y >= b.top &&
            scenePoint.y <= b.top + b.height
          );
        }
        if (isInside) {
          return active;
        }
      }
      return originalFindTarget(e);
    };

    fabricRef.current = canvas;

    // Handle Resize
    const handleResize = () => {
      canvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      renderBackground(canvas);
    };
    window.addEventListener('resize', handleResize);

    // Initial render
    renderBackground(canvas);

    // Load current page data if exists
    if (currentPage?.canvas_data) {
      const parsed = typeof currentPage.canvas_data === 'string'
        ? JSON.parse(currentPage.canvas_data)
        : currentPage.canvas_data;
      canvas.loadFromJSON(parsed).then(() => {
        const { width: pageW, height: pageH } = getPageDimensions(pageSize, pageOrientation);
        const pageCenterX = (canvas.width! - pageW) / 2;
        const pageCenterY = Math.max(50, (canvas.height! - pageH) / 2);

        const userObjects = canvas.getObjects().filter((o: any) => o.name !== 'a4-background' && o.name !== 'a4-ruled-line');
        if (userObjects.length > 0) {
          const minX = Math.min(...userObjects.map(o => o.left || 0));
          if (minX < 150 && pageCenterX > 200) {
            const shiftX = pageCenterX;
            const shiftY = pageCenterY > 50 ? pageCenterY - 20 : 0;
            userObjects.forEach(obj => {
              obj.set({
                left: (obj.left || 0) + shiftX,
                top: (obj.top || 0) + shiftY,
              });
              obj.setCoords();
            });
          }
        }

        renderBackground(canvas);
        canvas.requestRenderAll();
        if (currentPageId) {
          initPageHistory(currentPageId, getCanvasSnapshot(canvas));
        }
      });
    } else {
      if (currentPageId) {
        initPageHistory(currentPageId, getCanvasSnapshot(canvas));
      }
    }

    // Selection formatting listeners (for both Text and Shapes)
    const handleSelectionUpdate = () => {
      const activeObj = canvas.getActiveObject();
      if (activeObj && (activeObj as any).name !== 'a4-background' && (activeObj as any).name !== 'a4-ruled-line') {
        if (activeObj.type === 'i-text' || activeObj.type === 'textbox') {
          const textObj = activeObj as fabric.Textbox;
          let styles: any = {};
          if (textObj.isEditing && typeof textObj.getSelectionStyles === 'function') {
            const start = textObj.selectionStart || 0;
            const end = textObj.selectionEnd || start;
            if (start !== end) {
              const stylesList = textObj.getSelectionStyles(start, end);
              if (stylesList && stylesList.length > 0) {
                styles = stylesList[0] || {};
              }
            }
          }

          useBoardStore.getState().setActiveShapeFormat(null);
          useBoardStore.getState().setActiveTextFormat({
            fontFamily: styles.fontFamily ?? textObj.fontFamily ?? 'Inter',
            fontSize: typeof styles.fontSize === 'number' ? styles.fontSize : (textObj.fontSize ?? 24),
            fill: (styles.fill ?? textObj.fill ?? (useBoardStore.getState().isDarkMode ? '#ffffff' : '#000000')) as string,
            textBackgroundColor: (styles.textBackgroundColor ?? textObj.textBackgroundColor ?? '') as string,
            fontWeight: (styles.fontWeight ?? textObj.fontWeight ?? 'normal') as string,
            fontStyle: (styles.fontStyle ?? textObj.fontStyle ?? 'normal') as string,
            underline: styles.underline !== undefined ? !!styles.underline : !!textObj.underline,
            linethrough: styles.linethrough !== undefined ? !!styles.linethrough : !!textObj.linethrough,
            textAlign: (textObj.textAlign as any) || 'left',
          });
        } else {
          // Selected Shape / Path / Line / ActiveSelection
          useBoardStore.getState().setActiveTextFormat(null);
          
          const stroke = (activeObj.stroke as string) || useBoardStore.getState().strokeColor;
          const strokeWidth = typeof activeObj.strokeWidth === 'number' ? activeObj.strokeWidth : useBoardStore.getState().strokeWidth;
          const fill = (activeObj.fill as string) || 'transparent';
          const opacity = typeof activeObj.opacity === 'number' ? activeObj.opacity : 1;

          useBoardStore.getState().setActiveShapeFormat({
            type: activeObj.type,
            stroke,
            strokeWidth,
            fill,
            opacity
          });

          // Sync stroke & fill color in store so color pickers immediately match
          useBoardStore.getState().setStrokeColor(stroke);
          useBoardStore.getState().setStrokeWidth(strokeWidth);
          useBoardStore.getState().setFillColor(fill);
          useBoardStore.getState().setOpacity(opacity);
        }
      } else {
        useBoardStore.getState().setActiveTextFormat(null);
        useBoardStore.getState().setActiveShapeFormat(null);
      }
    };

    const onSelectionCreated = (e: any) => {
      if (e.selected) {
        e.selected.forEach((obj: any) => {
          obj.perPixelTargetFind = false;
          normalizeTextObject(obj);
        });
      }
      handleSelectionUpdate();
    };

    const onSelectionUpdated = (e: any) => {
      if (e.deselected) {
        e.deselected.forEach((obj: any) => {
          obj.perPixelTargetFind = true;
        });
      }
      if (e.selected) {
        e.selected.forEach((obj: any) => {
          obj.perPixelTargetFind = false;
          normalizeTextObject(obj);
        });
      }
      handleSelectionUpdate();
    };

    const onSelectionCleared = (e: any) => {
      useBoardStore.getState().setActiveTextFormat(null);
      useBoardStore.getState().setActiveShapeFormat(null);
      if (e.deselected) {
        e.deselected.forEach((obj: any) => {
          obj.perPixelTargetFind = true;
        });
      }
    };

    canvas.on('selection:created', onSelectionCreated);
    canvas.on('selection:updated', onSelectionUpdated);
    canvas.on('selection:cleared', onSelectionCleared);
    canvas.on('text:selection:changed', handleSelectionUpdate);
    canvas.on('text:changed', handleSelectionUpdate);

    // If existing text has placeholder, select all so typing overwrites it
    canvas.on('text:editing:entered', (e: any) => {
      const target = e.target as fabric.IText;
      if (target && (target.text === 'Click to edit' || target.text === 'Type text here')) {
        target.selectAll();
      }
    });

    // Clean up empty text boxes if left blank on blur
    canvas.on('text:editing:exited', (e: any) => {
      const target = e.target as fabric.Textbox;
      if (target && typeof target.text === 'string' && target.text.trim() === '') {
        canvas.remove(target);
        canvas.requestRenderAll();
      }
      recordState();
    });

    // Dedicated Mouse Wheel Zoom Operator
    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e as WheelEvent;
      const delta = e.deltaY;
      let zoom = canvas.getZoom();
      
      // Calculate smooth zoom
      const zoomFactor = delta > 0 ? 0.92 : 1.08;
      zoom = zoom * zoomFactor;
      
      // Limit zoom range from 10% to 500%
      if (zoom > 5) zoom = 5;
      if (zoom < 0.1) zoom = 0.1;
      
      const point = new fabric.Point(e.offsetX, e.offsetY);
      canvas.zoomToPoint(point, zoom);
      canvas.requestRenderAll();
      
      window.dispatchEvent(new CustomEvent('zoom-change', { detail: { zoom } }));
      
      e.preventDefault();
      e.stopPropagation();
    });

    // Zoom Action listener from UI
    const zoomActionHandler = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: 'in' | 'out' | 'reset' }>;
      const { action } = customEvent.detail;
      const center = new fabric.Point(canvas.width! / 2, canvas.height! / 2);
      let zoom = canvas.getZoom();

      if (action === 'in') {
        zoom = Math.min(5, zoom * 1.25);
        canvas.zoomToPoint(center, zoom);
      } else if (action === 'out') {
        zoom = Math.max(0.1, zoom / 1.25);
        canvas.zoomToPoint(center, zoom);
      } else if (action === 'reset') {
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        zoom = 1;
      }

      window.dispatchEvent(new CustomEvent('zoom-change', { detail: { zoom } }));
      canvas.requestRenderAll();
    };

    window.addEventListener('zoom-action', zoomActionHandler);

    const formatTextHandler = (e: Event) => {
      const customEvent = e as CustomEvent;
      const updates = customEvent.detail;
      if (!updates) return;
      const activeObj = canvas.getActiveObject();
      
      if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox')) {
        const textObj = activeObj as fabric.Textbox;
        const isEditing = textObj.isEditing;
        const start = textObj.selectionStart ?? 0;
        const end = textObj.selectionEnd ?? 0;
        const hasSelectionRange = isEditing && start !== end;

        if (hasSelectionRange) {
          // 1. Partial selection range inside editing mode: Apply styles ONLY to highlighted characters
          textObj.setSelectionStyles(updates, start, end);

          // If the user highlighted the entire text, also sync object-level defaults
          if (start === 0 && end >= (textObj.text?.length || 0)) {
            textObj.set(updates);
            for (const key of Object.keys(updates)) {
              clearStylePropertyFromAllChars(textObj, key);
            }
          }
        } else {
          // 2. Whole text box selected (or cursor with no range):
          // Alter the ENTIRE text box all at once by updating the object and purging individual character overrides
          textObj.set(updates);

          for (const key of Object.keys(updates)) {
            clearStylePropertyFromAllChars(textObj, key);
          }
        }

        // Persist formatting preferences for future text boxes (size, family, color)
        if (typeof updates.fontSize === 'number') {
          useBoardStore.getState().setLastTextSize(updates.fontSize);
        }
        if (typeof updates.fontFamily === 'string') {
          useBoardStore.getState().setLastFontFamily(updates.fontFamily);
        }
        if (typeof updates.fill === 'string') {
          useBoardStore.getState().setLastTextColor(updates.fill);
        }

        // Force clear cache, re-wrap lines, recalculate dimensions and coordinate handles
        (textObj as any)._forceClearCache = true;
        textObj.dirty = true;
        if (typeof textObj.initDimensions === 'function') {
          textObj.initDimensions();
        }
        textObj.setCoords();
        canvas.requestRenderAll();

        // If font family was changed, ensure webfont is loaded and canvas re-renders immediately
        if (updates.fontFamily && typeof document !== 'undefined' && document.fonts) {
          const fontString = `${textObj.fontSize || 24}px "${updates.fontFamily}"`;
          document.fonts.load(fontString).then(() => {
            (textObj as any)._forceClearCache = true;
            textObj.dirty = true;
            if (typeof textObj.initDimensions === 'function') {
              textObj.initDimensions();
            }
            textObj.setCoords();
            canvas.requestRenderAll();
          }).catch(() => {});
        }

        recordState();
        handleSelectionUpdate();
      }
    };

    const formatShapeHandler = (e: Event) => {
      const customEvent = e as CustomEvent;
      const updates = customEvent.detail;
      if (!updates) return;
      const activeObj = canvas.getActiveObject();
      if (activeObj && (activeObj as any).name !== 'a4-background' && (activeObj as any).name !== 'a4-ruled-line') {
        if (activeObj.type === 'activeselection') {
          (activeObj as fabric.ActiveSelection).forEachObject((obj) => {
            obj.set(updates);
          });
        } else {
          activeObj.set(updates);
        }
        canvas.requestRenderAll();
        recordState();
      }
    };

    const arrangeObjectHandler = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: 'bring-to-front' | 'send-to-back' | 'bring-forward' | 'send-backward' }>;
      if (customEvent.detail?.action) {
        arrangeActiveObject(customEvent.detail.action);
      }
    };

    const alignObjectHandler = (e: Event) => {
      const customEvent = e as CustomEvent<{ alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'center-page' }>;
      if (customEvent.detail?.alignment) {
        alignActiveObject(customEvent.detail.alignment);
      }
    };

    const flipObjectHandler = (e: Event) => {
      const customEvent = e as CustomEvent<{ direction: 'horizontal' | 'vertical' }>;
      if (customEvent.detail?.direction) {
        flipActiveObject(customEvent.detail.direction);
      }
    };

    const duplicateObjectHandler = () => {
      duplicateActiveObject();
    };

    const deleteObjectHandler = () => {
      deleteActiveObjects();
    };

    window.addEventListener('format-text', formatTextHandler);
    window.addEventListener('format-shape', formatShapeHandler);
    window.addEventListener('arrange-object', arrangeObjectHandler);
    window.addEventListener('align-object', alignObjectHandler);
    window.addEventListener('flip-object', flipObjectHandler);
    window.addEventListener('duplicate-object', duplicateObjectHandler);
    window.addEventListener('delete-object', deleteObjectHandler);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('format-text', formatTextHandler);
      window.removeEventListener('format-shape', formatShapeHandler);
      window.removeEventListener('arrange-object', arrangeObjectHandler);
      window.removeEventListener('align-object', alignObjectHandler);
      window.removeEventListener('flip-object', flipObjectHandler);
      window.removeEventListener('duplicate-object', duplicateObjectHandler);
      window.removeEventListener('delete-object', deleteObjectHandler);
      window.removeEventListener('zoom-action', zoomActionHandler);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []); // Only run once to initialize

  // Delete active objects
  const deleteActiveObjects = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    if ((activeObj as any).isEditing) {
      return;
    }

    const activeObjects = canvas.getActiveObjects();
    if (activeObjects && activeObjects.length > 0) {
      const toDelete = activeObjects.filter((o: any) => o.name !== 'a4-background' && o.name !== 'a4-ruled-line');
      if (toDelete.length > 0) {
        canvas.discardActiveObject();
        canvas.remove(...toDelete);
        canvas.requestRenderAll();
        recordState();
      }
    }
  }, [recordState]);

  // Align active object or selection relative to the page
  const alignActiveObject = useCallback((alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'center-page') => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj || (activeObj as any).name === 'a4-background' || (activeObj as any).name === 'a4-ruled-line') return;

    const { width: pageW, height: pageH } = getPageDimensions(pageSize, pageOrientation);
    const pageX = (canvas.width! - pageW) / 2;
    const pageY = Math.max(50, (canvas.height! - pageH) / 2);

    const objW = activeObj.getScaledWidth();
    const objH = activeObj.getScaledHeight();

    switch (alignment) {
      case 'left':
        activeObj.set({ left: pageX + 24 });
        break;
      case 'center':
        activeObj.set({ left: pageX + (pageW - objW) / 2 });
        break;
      case 'right':
        activeObj.set({ left: pageX + pageW - objW - 24 });
        break;
      case 'top':
        activeObj.set({ top: pageY + 24 });
        break;
      case 'middle':
        activeObj.set({ top: pageY + (pageH - objH) / 2 });
        break;
      case 'bottom':
        activeObj.set({ top: pageY + pageH - objH - 24 });
        break;
      case 'center-page':
        activeObj.set({
          left: pageX + (pageW - objW) / 2,
          top: pageY + (pageH - objH) / 2
        });
        break;
    }

    activeObj.setCoords();
    canvas.requestRenderAll();
    recordState();
  }, [pageSize, pageOrientation, recordState]);

  // Flip active object
  const flipActiveObject = useCallback((direction: 'horizontal' | 'vertical') => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj || (activeObj as any).name === 'a4-background' || (activeObj as any).name === 'a4-ruled-line') return;

    if (direction === 'horizontal') {
      activeObj.set('flipX', !activeObj.flipX);
    } else {
      activeObj.set('flipY', !activeObj.flipY);
    }
    activeObj.setCoords();
    canvas.requestRenderAll();
    recordState();
  }, [recordState]);

  // Set opacity on active object and synchronize with store
  const setObjectOpacity = useCallback((newOpacity: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj || (activeObj as any).name === 'a4-background' || (activeObj as any).name === 'a4-ruled-line') return;

    if (activeObj.type === 'activeselection') {
      (activeObj as fabric.ActiveSelection).forEachObject(obj => {
        obj.set({ opacity: newOpacity });
      });
    } else {
      activeObj.set({ opacity: newOpacity });
    }

    // Synchronize store
    useBoardStore.getState().setOpacity(newOpacity);
    const shapeFormat = useBoardStore.getState().activeShapeFormat;
    if (shapeFormat) {
      useBoardStore.getState().setActiveShapeFormat({ ...shapeFormat, opacity: newOpacity });
    }

    canvas.requestRenderAll();
    recordState();
  }, [recordState]);

  // Arrange object layer order (Bring to Front, Send to Back, Bring Forward, Send Backward)
  const arrangeActiveObject = useCallback((action: 'bring-to-front' | 'send-to-back' | 'bring-forward' | 'send-backward') => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj || (activeObj as any).name === 'a4-background' || (activeObj as any).name === 'a4-ruled-line') {
      return;
    }

    // Background objects count (which must remain at the very bottom)
    const bgObjs = canvas.getObjects().filter((o: any) => o.name === 'a4-background' || o.name === 'a4-ruled-line');
    const bgCount = bgObjs.length;

    if (activeObj.type === 'activeselection') {
      const sel = activeObj as fabric.ActiveSelection;
      const objects = sel.getObjects();
      if (action === 'bring-to-front') {
        objects.forEach(obj => canvas.bringObjectToFront(obj));
      } else if (action === 'send-to-back') {
        objects.forEach((obj, idx) => {
          canvas.moveObjectTo(obj, bgCount + idx);
        });
      } else if (action === 'bring-forward') {
        objects.forEach(obj => canvas.bringObjectForward(obj));
      } else if (action === 'send-backward') {
        objects.forEach(obj => {
          const curIdx = canvas.getObjects().indexOf(obj);
          if (curIdx > bgCount) {
            canvas.sendObjectBackwards(obj);
          }
        });
      }
    } else {
      if (action === 'bring-to-front') {
        canvas.bringObjectToFront(activeObj);
      } else if (action === 'send-to-back') {
        canvas.moveObjectTo(activeObj, bgCount);
      } else if (action === 'bring-forward') {
        canvas.bringObjectForward(activeObj);
      } else if (action === 'send-backward') {
        const curIdx = canvas.getObjects().indexOf(activeObj);
        if (curIdx > bgCount) {
          canvas.sendObjectBackwards(activeObj);
        }
      }
    }

    // Ensure background objects remain at the absolute bottom
    const bgRect = bgObjs.find((o: any) => o.name === 'a4-background');
    const ruledLines = bgObjs.filter((o: any) => o.name === 'a4-ruled-line');
    if (bgRect) canvas.sendObjectToBack(bgRect);
    ruledLines.forEach(line => canvas.sendObjectToBack(line));
    if (bgRect) canvas.sendObjectToBack(bgRect);

    canvas.requestRenderAll();
    recordState();
  }, [recordState]);

  // Duplicate active object
  const duplicateActiveObject = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active || (active as any).name === 'a4-background' || (active as any).name === 'a4-ruled-line') return;

    const cloned = await active.clone();
    canvas.discardActiveObject();
    cloned.set({
      left: (cloned.left || 0) + 24,
      top: (cloned.top || 0) + 24,
      evented: true,
    });

    if (cloned.type === 'activeselection') {
      const activeSelection = cloned as fabric.ActiveSelection;
      activeSelection.canvas = canvas;
      activeSelection.forEachObject((obj) => {
        canvas.add(obj);
      });
      activeSelection.setCoords();
    } else {
      canvas.add(cloned);
    }

    canvas.setActiveObject(cloned);
    canvas.requestRenderAll();
    recordState();
  }, [recordState]);

  // Undo & Redo custom event listeners
  useEffect(() => {
    const onUndoEvent = () => {
      handleUndo();
    };
    const onRedoEvent = () => {
      handleRedo();
    };

    window.addEventListener('board-undo', onUndoEvent);
    window.addEventListener('board-redo', onRedoEvent);

    return () => {
      window.removeEventListener('board-undo', onUndoEvent);
      window.removeEventListener('board-redo', onRedoEvent);
    };
  }, [handleUndo, handleRedo]);

  // Handle Clear Canvas / Erase All
  useEffect(() => {
    const handleClearCanvas = () => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      canvas.discardActiveObject();
      const allObjects = [...canvas.getObjects()];
      let hasRemoved = false;
      for (const obj of allObjects) {
        if ((obj as any).name !== 'a4-background' && (obj as any).name !== 'a4-ruled-line') {
          canvas.remove(obj);
          hasRemoved = true;
        }
      }
      renderBackground(canvas);
      canvas.requestRenderAll();
      if (hasRemoved) {
        recordState();
      }
    };

    window.addEventListener('clear-canvas', handleClearCanvas);
    return () => window.removeEventListener('clear-canvas', handleClearCanvas);
  }, [renderBackground, recordState]);

  // Copy, Cut, Paste, Duplicate, Delete, Layer Ordering, Undo & Redo keyboard shortcuts
  useEffect(() => {
    const handleCopy = async () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) return;
      
      if (active.type === 'i-text' && (active as fabric.IText).isEditing) {
        return; // let native browser copy handle highlighted text
      }

      const cloned = await active.clone();
      clipboardRef.current = cloned;
    };

    const handleCut = async () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active || (active as any).isEditing) return;

      const cloned = await active.clone();
      clipboardRef.current = cloned;

      const activeObjects = canvas.getActiveObjects();
      const toDelete = activeObjects.filter((o: any) => o.name !== 'a4-background' && o.name !== 'a4-ruled-line');
      if (toDelete.length > 0) {
        canvas.discardActiveObject();
        canvas.remove(...toDelete);
        canvas.requestRenderAll();
        recordState();
      }
    };

    const handlePaste = async () => {
      const canvas = fabricRef.current;
      if (!canvas || !clipboardRef.current) return;

      const clonedObj = await clipboardRef.current.clone();
      canvas.discardActiveObject();

      clonedObj.set({
        left: clonedObj.left + 24,
        top: clonedObj.top + 24,
        evented: true,
      });

      if (clonedObj.type === 'activeSelection') {
        const activeSelection = clonedObj as fabric.ActiveSelection;
        activeSelection.canvas = canvas;
        activeSelection.forEachObject((obj) => {
          canvas.add(obj);
        });
        activeSelection.setCoords();
      } else {
        canvas.add(clonedObj);
      }

      // Offset clipboard for consecutive pastes
      clipboardRef.current.top += 24;
      clipboardRef.current.left += 24;

      canvas.setActiveObject(clonedObj);
      canvas.requestRenderAll();
      recordState();
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing inside standard HTML inputs / textareas
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (isCtrlOrMeta) {
        if (key === 'z') {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          
          e.preventDefault();
          if (e.shiftKey) {
            await handleRedo();
          } else {
            await handleUndo();
          }
        } else if (key === 'y') {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;

          e.preventDefault();
          await handleRedo();
        } else if (key === 'c') {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          e.preventDefault();
          await handleCopy();
        } else if (key === 'v') {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          e.preventDefault();
          await handlePaste();
        } else if (key === 'x') {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          e.preventDefault();
          await handleCut();
        } else if (key === 'd') {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          e.preventDefault();
          await duplicateActiveObject();
        } else if (e.shiftKey && (e.key === ']' || e.key === '}')) {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          e.preventDefault();
          arrangeActiveObject('bring-to-front');
        } else if (e.shiftKey && (e.key === '[' || e.key === '{')) {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          e.preventDefault();
          arrangeActiveObject('send-to-back');
        } else if (e.key === ']' || e.key === '}') {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          e.preventDefault();
          arrangeActiveObject('bring-forward');
        } else if (e.key === '[' || e.key === '{') {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          e.preventDefault();
          arrangeActiveObject('send-backward');
        }
      } else if (e.altKey) {
        if (e.key === ']' || e.key === '}') {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          e.preventDefault();
          arrangeActiveObject('bring-forward');
        } else if (e.key === '[' || e.key === '{') {
          const active = fabricRef.current?.getActiveObject();
          if (active && (active as any).isEditing) return;
          e.preventDefault();
          arrangeActiveObject('send-backward');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = fabricRef.current?.getActiveObject();
        // If actively typing text inside Textbox, do not delete the entire object
        if (active && (active as any).isEditing) return;
        
        if (active) {
          e.preventDefault();
          deleteActiveObjects();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, recordState, arrangeActiveObject, duplicateActiveObject, deleteActiveObjects]);

  useEffect(() => {
    const handleInsertMedia = async (e: Event) => {
      const customEvent = e as CustomEvent<{ url: string, type: 'image' | 'pdf', file: File }>;
      const { url, type } = customEvent.detail;
      const canvas = fabricRef.current;
      if (!canvas) return;

      const { width: currentW } = getPageDimensions(pageSize, pageOrientation);

      if (type === 'image') {
        const img = await fabric.FabricImage.fromURL(url);
        // Scale down if it's too big
        if (img.width! > currentW - 100) {
          img.scaleToWidth(currentW - 100);
        }
        img.set({
          left: (canvas.width! - img.getScaledWidth()) / 2,
          top: (canvas.height! - img.getScaledHeight()) / 2,
          selectable: true,
          evented: true,
        });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        recordState();
      } else if (type === 'pdf') {
        try {
          const loadingTask = pdfjsLib.getDocument({ url });
          const pdf = await loadingTask.promise;
          const { width: pageW, height: pageH } = getPageDimensions(pageSize, pageOrientation);
          const userId = localStorage.getItem('nova_guest_id') || 'guest';
          const currentPid = useBoardStore.getState().currentPageId;

          // First, save current page state so nothing on current page is lost
          saveState();

          const pdfPagesData: { canvasData: string; name: string }[] = [];

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const unscaledViewport = page.getViewport({ scale: 1 });
            
            // Calculate best fit scale for the document page with 24px padding
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

            const renderContext: any = {
              canvasContext: context!,
              viewport: viewport,
              intent: 'print',
            };

            await page.render(renderContext).promise;
            
            const dataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.98);
            const img = await fabric.FabricImage.fromURL(dataUrl);
            
            const pageCenterX = (canvas.width! - pageW) / 2;
            const pageCenterY = Math.max(50, (canvas.height! - pageH) / 2);
            
            const imgLeft = pageCenterX + (pageW - targetWidth) / 2;
            const imgTop = pageCenterY + (pageH - targetHeight) / 2;

            img.set({
              name: 'pdf-page',
              left: imgLeft,
              top: imgTop,
              scaleX: targetWidth / viewport.width,
              scaleY: targetHeight / viewport.height,
              selectable: true,
              evented: true,
              shadow: new fabric.Shadow({
                color: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.18)',
                blur: 24,
                offsetX: 0,
                offsetY: 8,
              }),
            });

            const imgObj = (img as any).toObject(['name', 'excludeFromExport', 'shadow']);
            if (!imgObj.src) {
              imgObj.src = dataUrl;
            }
            imgObj.name = 'pdf-page';

            // Construct JSON data for this new page
            const pageJson = JSON.stringify({
              version: '6.6.0',
              objects: [imgObj],
            });

            pdfPagesData.push({
              canvasData: pageJson,
              name: `Page ${pageNum}`,
            });
          }

          if (pdfPagesData.length > 0) {
            await useBoardStore.getState().importPdfPages(pdfPagesData, currentPid, userId);
          }
        } catch (error) {
          console.error("Error loading PDF:", error);
        }
      }
    };

    window.addEventListener('insert-media', handleInsertMedia);
    return () => window.removeEventListener('insert-media', handleInsertMedia);
  }, [pageSize, pageOrientation, recordState, saveState, isDarkMode]);

  useEffect(() => {
    const handleSaveRequest = () => {
      saveState();
    };
    window.addEventListener('save-canvas-state', handleSaveRequest);
    return () => window.removeEventListener('save-canvas-state', handleSaveRequest);
  }, [saveState]);

  // Handle page switch
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !currentPageId) return;

    // 1. If switching from an existing page, save that previous page's snapshot FIRST
    const previousPageId = activePageIdRef.current;
    if (previousPageId && previousPageId !== currentPageId) {
      const prevSnapshot = getCanvasSnapshot(canvas);
      useBoardStore.getState().updatePageData(previousPageId, prevSnapshot);
    }
    activePageIdRef.current = currentPageId;

    canvas.discardActiveObject();

    const currentPages = useBoardStore.getState().pages;
    const pageToLoad = currentPages.find(p => p.id === currentPageId);

    // Sync canUndo/canRedo with active page history
    const existingHistory = historyMapRef.current.get(currentPageId);
    if (existingHistory) {
      useBoardStore.getState().setCanUndo(existingHistory.undoStack.length > 1);
      useBoardStore.getState().setCanRedo(existingHistory.redoStack.length > 0);
    } else {
      useBoardStore.getState().setCanUndo(false);
      useBoardStore.getState().setCanRedo(false);
    }

    if (pageToLoad?.canvas_data) {
      try {
        const parsed = typeof pageToLoad.canvas_data === 'string'
          ? JSON.parse(pageToLoad.canvas_data)
          : pageToLoad.canvas_data;

        canvas.loadFromJSON(parsed).then(() => {
          const { width: pageW, height: pageH } = getPageDimensions(pageSize, pageOrientation);
          const pageCenterX = (canvas.width! - pageW) / 2;
          const pageCenterY = Math.max(50, (canvas.height! - pageH) / 2);

          const userObjects = canvas.getObjects().filter((o: any) => o.name !== 'a4-background' && o.name !== 'a4-ruled-line');
          if (userObjects.length > 0) {
            const minX = Math.min(...userObjects.map(o => o.left || 0));
            if (minX < 150 && pageCenterX > 200) {
              const shiftX = pageCenterX;
              const shiftY = pageCenterY > 50 ? pageCenterY - 20 : 0;
              userObjects.forEach(obj => {
                obj.set({
                  left: (obj.left || 0) + shiftX,
                  top: (obj.top || 0) + shiftY,
                });
                obj.setCoords();
              });
            }
          }

          canvas.forEachObject((obj) => {
            if (obj.type === 'textbox' || obj.type === 'i-text') {
              normalizeTextObject(obj);
            }
          });
          renderBackground(canvas);
          canvas.requestRenderAll();
          initPageHistory(currentPageId, getCanvasSnapshot(canvas));
        });
      } catch (err) {
        console.error('Error loading page JSON:', err);
        renderBackground(canvas);
        canvas.requestRenderAll();
        initPageHistory(currentPageId, getCanvasSnapshot(canvas));
      }
    } else {
      const oldObjs = canvas.getObjects().filter((o: any) => o.name !== 'a4-background' && o.name !== 'a4-ruled-line');
      canvas.remove(...oldObjs);
      renderBackground(canvas);
      canvas.requestRenderAll();
      initPageHistory(currentPageId, getCanvasSnapshot(canvas));
    }
  }, [currentPageId, renderBackground, initPageHistory, getCanvasSnapshot, pageSize, pageOrientation]);


  // Handle Background & Page Dimension changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    renderBackground(canvas);
  }, [renderBackground]);

  // Handle Remote Realtime Page Updates from another device
  useEffect(() => {
    const handleRemotePageUpdate = async (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const remotePage = customEvent.detail;
      const canvas = fabricRef.current;
      const livePageId = useBoardStore.getState().currentPageId;

      if (!canvas || !remotePage || remotePage.id !== livePageId) return;

      // If user is currently editing text, don't interrupt
      const active = canvas.getActiveObject();
      if (active && (active as any).isEditing) return;

      if (remotePage.canvas_data) {
        try {
          const parsed = typeof remotePage.canvas_data === 'string'
            ? JSON.parse(remotePage.canvas_data)
            : remotePage.canvas_data;

          await canvas.loadFromJSON(parsed);

          const liveTool = useBoardStore.getState().currentTool;
          const isSelect = liveTool === 'select';
          canvas.forEachObject((obj) => {
            if ((obj as any).name !== 'a4-background' && (obj as any).name !== 'a4-ruled-line') {
              obj.selectable = isSelect;
              obj.evented = true;
              obj.strokeUniform = true;
              if (obj.type === 'textbox' || obj.type === 'i-text') {
                normalizeTextObject(obj);
              }
            }
          });

          renderBackground(canvas);
          canvas.requestRenderAll();
        } catch (err) {
          console.warn('Error applying remote page update:', err);
        }
      }
    };

    window.addEventListener('remote-page-update', handleRemotePageUpdate);
    return () => window.removeEventListener('remote-page-update', handleRemotePageUpdate);
  }, [renderBackground]);


  // Tool setup (Pan, Pen, Shapes, Text, etc)
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.defaultCursor = 'default';

    // Remove existing event listeners to prevent duplicate triggers
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');
    canvas.off('path:created');
    canvas.off('object:modified');
    
    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;

    let isDrawingShape = false;
    let shapeRef: fabric.Object | null = null;
    let origX = 0;
    let origY = 0;

    let isErasing = false;
    let hasErasedInGesture = false;

    const isPointTouchingObject = (obj: fabric.FabricObject, point: fabric.Point): boolean => {
      const strokeW = (obj.strokeWidth || 1) * Math.max(obj.scaleX || 1, obj.scaleY || 1);
      const hitTolerance = Math.max(strokeW / 2 + 6, 8);
      const hasSolidFill = !!(
        obj.fill && 
        obj.fill !== 'transparent' && 
        obj.fill !== '' && 
        obj.fill !== 'rgba(0,0,0,0)'
      );

      // If text or image, standard area hit is natural
      if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'image') {
        return obj.containsPoint(point);
      }

      // If solid filled (not hollow), touches if inside the shape
      if (hasSolidFill && obj.type !== 'path' && obj.type !== 'line') {
        if (obj.containsPoint(point)) {
          return true;
        }
      }

      // Line / Arrow stroke hit test
      if (obj.type === 'line') {
        const line = obj as fabric.Line;
        const matrix = obj.calcTransformMatrix();
        const p1 = fabric.util.transformPoint(new fabric.Point(line.x1 || 0, line.y1 || 0), matrix);
        const p2 = fabric.util.transformPoint(new fabric.Point(line.x2 || 0, line.y2 || 0), matrix);
        return distToSegment(point.x, point.y, p1.x, p1.y, p2.x, p2.y) <= hitTolerance;
      }

      // Rect / Triangle / Polygon perimeter stroke hit test
      if (obj.type === 'rect' || obj.type === 'triangle' || obj.type === 'polygon') {
        const coords = obj.getCoords();
        for (let i = 0; i < coords.length; i++) {
          const p1 = coords[i];
          const p2 = coords[(i + 1) % coords.length];
          if (distToSegment(point.x, point.y, p1.x, p1.y, p2.x, p2.y) <= hitTolerance) {
            return true;
          }
        }
        return false;
      }

      // Circle / Ellipse perimeter stroke hit test
      if (obj.type === 'ellipse' || obj.type === 'circle') {
        const center = obj.getCenterPoint();
        const angle = -(obj.angle || 0) * (Math.PI / 180);
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

        const rx = ((obj as fabric.Ellipse).rx || (obj.width || 0) / 2) * (obj.scaleX || 1);
        const ry = ((obj as fabric.Ellipse).ry || (obj.height || 0) / 2) * (obj.scaleY || 1);

        if (rx <= 0 || ry <= 0) return false;

        const normalizedDist = Math.sqrt(Math.pow(localX / rx, 2) + Math.pow(localY / ry, 2));

        if (hasSolidFill && normalizedDist <= 1.05) return true;

        const radialDist = Math.abs(normalizedDist - 1) * Math.min(rx, ry);
        return radialDist <= hitTolerance;
      }

      // Freehand Pen / Highlighter Path segments
      if (obj.type === 'path') {
        const path = obj as any;
        const offX = (path.pathOffset?.x || 0);
        const offY = (path.pathOffset?.y || 0);
        const matrix = obj.calcTransformMatrix();
        const pathTolerance = Math.max(strokeW / 2 + 8, 10);

        if (Array.isArray(path.path)) {
          let prevPt: fabric.Point | null = null;

          for (const cmd of path.path) {
            if (cmd[0] === 'M' || cmd[0] === 'L') {
              const localPt = new fabric.Point(Number(cmd[1]) - offX, Number(cmd[2]) - offY);
              const currentPt = fabric.util.transformPoint(localPt, matrix);
              if (prevPt && distToSegment(point.x, point.y, prevPt.x, prevPt.y, currentPt.x, currentPt.y) <= pathTolerance) {
                return true;
              }
              prevPt = currentPt;
            } else if (cmd[0] === 'Q' || cmd[0] === 'C') {
              const endX = Number(cmd[cmd.length - 2]) - offX;
              const endY = Number(cmd[cmd.length - 1]) - offY;
              const currentPt = fabric.util.transformPoint(new fabric.Point(endX, endY), matrix);
              if (prevPt && distToSegment(point.x, point.y, prevPt.x, prevPt.y, currentPt.x, currentPt.y) <= pathTolerance) {
                return true;
              }
              prevPt = currentPt;
            }
          }
        }

        return false;
      }

      // Default
      return false;
    };

    const eraseObjectAtPoint = (pointerEvent: MouseEvent | fabric.TPointerEvent) => {
      const scenePoint = canvas.getScenePoint(pointerEvent);
      const objects = [...canvas.getObjects()].reverse();
      for (const obj of objects) {
        if ((obj as any).name === 'a4-background' || (obj as any).name === 'a4-ruled-line') continue;
        
        if (isPointTouchingObject(obj, scenePoint)) {
          canvas.remove(obj);
          canvas.requestRenderAll();
          return true;
        }
      }
      return false;
    };

    if (currentTool === 'select') {
      canvas.selection = true;
      canvas.skipTargetFind = false;
      canvas.forEachObject((obj) => {
        if ((obj as any).name !== 'a4-background' && (obj as any).name !== 'a4-ruled-line') {
          obj.selectable = true;
          obj.evented = true;
        }
      });

      canvas.on('mouse:down', (opt) => {
        const active = canvas.getActiveObject();
        const scenePoint = canvas.getScenePoint(opt.e);

        // If an object is already selected and user clicks inside its boundary/handles, keep active for easy dragging
        if (active) {
          if ((active as any).__corner) {
            return;
          }

          let isInsideActive = false;
          if (typeof active.containsPoint === 'function' && active.containsPoint(scenePoint)) {
            isInsideActive = true;
          }
          if (!isInsideActive) {
            const b = active.getBoundingRect();
            if (
              scenePoint.x >= b.left &&
              scenePoint.x <= b.left + b.width &&
              scenePoint.y >= b.top &&
              scenePoint.y <= b.top + b.height
            ) {
              isInsideActive = true;
            }
          }

          if (isInsideActive) {
            return;
          }
        }

        // Otherwise check if touching another object's stroke
        const objects = [...canvas.getObjects()].reverse();
        let clickedTarget: fabric.FabricObject | null = null;
        for (const obj of objects) {
          if ((obj as any).name === 'a4-background' || (obj as any).name === 'a4-ruled-line') continue;
          if (isPointTouchingObject(obj, scenePoint)) {
            clickedTarget = obj;
            break;
          }
        }

        if (clickedTarget) {
          if (active !== clickedTarget) {
            canvas.setActiveObject(clickedTarget);
            canvas.requestRenderAll();
          }
        } else {
          // Clicked on empty space completely outside any stroke
          if (active && !opt.e.shiftKey) {
            canvas.discardActiveObject();
            canvas.requestRenderAll();
          }
        }
      });
    } else {
      canvas.selection = false;
      canvas.discardActiveObject();
      canvas.forEachObject((obj) => {
        if ((obj as any).name !== 'a4-background' && (obj as any).name !== 'a4-ruled-line') {
          obj.selectable = false;
        }
      });
      canvas.requestRenderAll();
    }

    if (currentTool === 'pan') {
      canvas.defaultCursor = 'grab';
    } else if (currentTool === 'eraser') {
      canvas.isDrawingMode = false;

      // Custom circular eraser cursor matching eraserSize
      const cursorD = Math.max(14, Math.min(96, eraserSize || 20));
      const cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorD}" height="${cursorD}" viewBox="0 0 ${cursorD} ${cursorD}"><circle cx="${cursorD/2}" cy="${cursorD/2}" r="${cursorD/2 - 1}" fill="rgba(99,102,241,0.25)" stroke="#6366f1" stroke-width="1.5"/></svg>`;
      canvas.defaultCursor = `url("data:image/svg+xml;utf8,${encodeURIComponent(cursorSvg)}") ${cursorD/2} ${cursorD/2}, crosshair`;

      let lastEraserPt: fabric.Point | null = null;

      const performPartialErase = (pointerEvent: MouseEvent | fabric.TPointerEvent) => {
        const scenePt = canvas.getScenePoint(pointerEvent);
        if (!lastEraserPt) {
          lastEraserPt = scenePt;
        }
        const p1 = lastEraserPt;
        const p2 = scenePt;
        const radius = (eraserSize || 20) / 2;

        let hasModifiedAny = false;
        const objects = [...canvas.getObjects()];

        for (const obj of objects) {
          if ((obj as any).name === 'a4-background' || (obj as any).name === 'a4-ruled-line') continue;

          const { modified, remainingPaths } = sliceObjectWithEraser(obj, p1, p2, radius);
          if (modified) {
            hasModifiedAny = true;
            canvas.remove(obj);
            for (const np of remainingPaths) {
              canvas.add(np);
            }
          }
        }

        lastEraserPt = scenePt;
        if (hasModifiedAny) {
          canvas.requestRenderAll();
          return true;
        }
        return false;
      };

      canvas.on('mouse:down', (opt) => {
        isErasing = true;
        hasErasedInGesture = false;
        lastEraserPt = canvas.getScenePoint(opt.e);

        if (eraserMode === 'partial') {
          const modified = performPartialErase(opt.e);
          if (modified) {
            hasErasedInGesture = true;
          }
        } else {
          const erased = eraseObjectAtPoint(opt.e);
          if (erased) {
            hasErasedInGesture = true;
          }
        }
      });

      canvas.on('mouse:move', (opt) => {
        if (isErasing) {
          if (eraserMode === 'partial') {
            const modified = performPartialErase(opt.e);
            if (modified) {
              hasErasedInGesture = true;
            }
          } else {
            const erased = eraseObjectAtPoint(opt.e);
            if (erased) {
              hasErasedInGesture = true;
            }
          }
        }
      });

      canvas.on('mouse:up', () => {
        if (isErasing) {
          isErasing = false;
          lastEraserPt = null;
          if (hasErasedInGesture) {
            recordState();
          }
        }
      });
    } else if (currentTool === 'pen' || currentTool === 'highlighter') {
      canvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(canvas);
      brush.color = currentTool === 'highlighter' ? `${strokeColor}80` : strokeColor;
      brush.width = strokeWidth;
      canvas.freeDrawingBrush = brush;
      
      canvas.on('path:created', (opt: any) => {
        if (opt.path) {
          opt.path.strokeUniform = true;
          opt.path.selectable = false;
        }
        recordState();
      });
    } else {
      // Shapes & Text Mode
      canvas.defaultCursor = 'crosshair';

      canvas.on('mouse:down', (o) => {
        isDrawingShape = true;
        const scenePoint = canvas.getScenePoint(o.e);
        origX = scenePoint.x;
        origY = scenePoint.y;

        const commonProps = {
          left: origX,
          top: origY,
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          opacity: opacity,
          strokeUniform: true,
          perPixelTargetFind: true,
          transparentCorners: false
        };

        if (currentTool === 'text') {
          const { lastTextSize, lastFontFamily, lastTextColor } = useBoardStore.getState();
          const defaultSize = lastTextSize || 24;
          const defaultFont = lastFontFamily || 'Inter';
          const textColor = lastTextColor || strokeColor || (isDarkMode ? '#ffffff' : '#1e293b');

          // Create a properly styled Textbox using last selected size/font/color and activate editing
          const textbox = new fabric.Textbox('Type text here', {
            left: origX,
            top: origY,
            width: Math.max(220, defaultSize * 8),
            fontSize: defaultSize,
            fontFamily: defaultFont,
            fill: textColor,
            fontWeight: 'normal',
            fontStyle: 'normal',
            underline: false,
            linethrough: false,
            transparentCorners: false,
            borderColor: '#6366f1',
            cornerColor: '#6366f1',
            cornerSize: 8,
            padding: 6,
            splitByGrapheme: false, // Wrap by whole words on spaces
            cursorColor: textColor,
            editable: true,
            lockUniScaling: true,
            lockScalingFlip: true,
          });
          textbox.setControlsVisibility({
            mt: false,
            mb: false,
          });

          canvas.add(textbox);
          canvas.setActiveObject(textbox);
          textbox.enterEditing();
          textbox.selectAll();
          canvas.requestRenderAll();

          setActiveTextFormat({
            fontFamily: defaultFont,
            fontSize: defaultSize,
            fill: textColor,
            textBackgroundColor: '',
            fontWeight: 'normal',
            fontStyle: 'normal',
            underline: false,
            linethrough: false,
            textAlign: 'left'
          });
          setCurrentTool('select');
          return;
        }

        if (currentTool === 'rectangle') {
          shapeRef = new fabric.Rect({ ...commonProps, width: 0, height: 0 });
        } else if (currentTool === 'circle') {
          shapeRef = new fabric.Ellipse({ ...commonProps, rx: 0, ry: 0 });
        } else if (currentTool === 'triangle') {
          shapeRef = new fabric.Triangle({ ...commonProps, width: 0, height: 0 });
        } else if (currentTool === 'line' || currentTool === 'arrow') {
          shapeRef = new fabric.Line([origX, origY, origX, origY], {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: fillColor,
            opacity: opacity
          });
        }

        if (shapeRef) {
          canvas.add(shapeRef);
        }
      });

      canvas.on('mouse:move', (o) => {
        if (!isDrawingShape || !shapeRef || !o.e) return;
        const scenePoint = canvas.getScenePoint(o.e);

        if (currentTool === 'rectangle' || currentTool === 'triangle') {
          (shapeRef as any).set({ width: Math.abs(origX - scenePoint.x) });
          (shapeRef as any).set({ height: Math.abs(origY - scenePoint.y) });
          (shapeRef as any).set({ left: Math.min(scenePoint.x, origX) });
          (shapeRef as any).set({ top: Math.min(scenePoint.y, origY) });
        } else if (currentTool === 'circle') {
          (shapeRef as any).set({ rx: Math.abs(origX - scenePoint.x) / 2 });
          (shapeRef as any).set({ ry: Math.abs(origY - scenePoint.y) / 2 });
          (shapeRef as any).set({ left: Math.min(scenePoint.x, origX) });
          (shapeRef as any).set({ top: Math.min(scenePoint.y, origY) });
        } else if (currentTool === 'line') {
          (shapeRef as fabric.Line).set({ x2: scenePoint.x, y2: scenePoint.y });
        }

        canvas.requestRenderAll();
      });

      canvas.on('mouse:up', () => {
        if (!isDrawingShape) return;
        isDrawingShape = false;
        if (shapeRef) {
          shapeRef.setCoords();

          let isTiny = false;
          if (currentTool === 'rectangle' || currentTool === 'triangle') {
            isTiny = ((shapeRef as any).width || 0) < 6 || ((shapeRef as any).height || 0) < 6;
          } else if (currentTool === 'circle') {
            isTiny = ((shapeRef as any).rx || 0) < 3 || ((shapeRef as any).ry || 0) < 3;
          } else if (currentTool === 'line' || currentTool === 'arrow') {
            const line = shapeRef as fabric.Line;
            isTiny = Math.hypot(line.x2 - line.x1, line.y2 - line.y1) < 6;
          }

          if (isTiny) {
            canvas.remove(shapeRef);
          } else {
            shapeRef.perPixelTargetFind = false;
            canvas.setActiveObject(shapeRef);
            setCurrentTool('select');
            recordState();
          }
          canvas.requestRenderAll();
        }
        shapeRef = null;
      });
    }

    // Panning implementation
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e as MouseEvent;
      if (currentTool === 'pan' || evt.altKey || evt.button === 1) {
        isPanning = true;
        canvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isPanning && opt.e) {
        const e = opt.e as MouseEvent;
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += e.clientX - lastPosX;
          vpt[5] += e.clientY - lastPosY;
          canvas.requestRenderAll();
          lastPosX = e.clientX;
          lastPosY = e.clientY;
        }
      }
    });

    canvas.on('mouse:up', () => {
      if (isPanning) {
        isPanning = false;
        canvas.setViewportTransform(canvas.viewportTransform!);
        if (currentTool === 'select') canvas.selection = true;
      }
    });

    // Ensure proportional scaling during resize
    canvas.on('object:scaling', (e) => {
      if (e.target && (e.target.type === 'textbox' || e.target.type === 'i-text')) {
        const textObj = e.target as fabric.Textbox;
        const s = Math.max(textObj.scaleX || 1, textObj.scaleY || 1);
        textObj.scaleX = s;
        textObj.scaleY = s;
      }
    });

    // Object modification hook to normalize text scale into fontSize and record history state
    canvas.on('object:modified', (e) => {
      if (e.target) {
        normalizeTextObject(e.target);
        if (e.target.type === 'textbox' || e.target.type === 'i-text') {
          const t = e.target as fabric.Textbox;
          setActiveTextFormat({
            fontFamily: t.fontFamily || 'Inter',
            fontSize: t.fontSize || 24,
            fill: (t.fill || (isDarkMode ? '#ffffff' : '#000000')) as string,
            textBackgroundColor: (t.textBackgroundColor || '') as string,
            fontWeight: (t.fontWeight || 'normal') as string,
            fontStyle: (t.fontStyle || 'normal') as string,
            underline: !!t.underline,
            linethrough: !!t.linethrough,
            textAlign: (t.textAlign as any) || 'left',
          });
        }
        canvas.requestRenderAll();
      }
      recordState();
    });

  }, [currentTool, strokeColor, strokeWidth, fillColor, opacity, setCurrentTool, isDarkMode, recordState, eraserMode, eraserSize, bgColor, bgType, setActiveTextFormat]);

  // Dismiss context menu on click or escape
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const canvas = fabricRef.current;
    if (!canvas) return;

    const target = (canvas as any).findTarget(e.nativeEvent);
    if (target && target.name !== 'a4-background' && target.name !== 'a4-ruled-line') {
      canvas.setActiveObject(target);
      canvas.requestRenderAll();
      setContextMenu({ x: e.clientX, y: e.clientY });
    } else {
      const active = canvas.getActiveObject();
      if (active && (active as any).name !== 'a4-background' && (active as any).name !== 'a4-ruled-line') {
        setContextMenu({ x: e.clientX, y: e.clientY });
      } else {
        setContextMenu(null);
      }
    }
  };

  return (
    <div 
      className={`w-full h-screen overflow-hidden ${isDarkMode ? 'bg-[#121212]' : 'bg-gray-100'}`}
      onContextMenu={handleCanvasContextMenu}
    >
      <canvas ref={canvasRef} id="board-canvas" />

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div 
          className={`fixed z-50 py-2 px-1.5 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 w-56 max-h-[90vh] overflow-y-auto custom-scrollbar ${
            isDarkMode ? 'bg-[#1a1c29]/95 border-gray-700 text-gray-200 shadow-black/60' : 'bg-white/95 border-gray-200 text-gray-800 shadow-xl shadow-black/10'
          }`}
          style={{ 
            left: Math.min(contextMenu.x, window.innerWidth - 240), 
            top: Math.min(contextMenu.y, window.innerHeight - 440) 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Layer Order Section */}
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider opacity-60">
            <span>Layer Order</span>
            <Layers size={12} className="text-indigo-400" />
          </div>

          <button
            type="button"
            onClick={() => {
              arrangeActiveObject('bring-to-front');
              setContextMenu(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <BringToFront size={14} className="text-indigo-400" /> Bring to Front
            </span>
            <span className="text-[10px] opacity-50 font-mono">Ctrl+]</span>
          </button>
          <button
            type="button"
            onClick={() => {
              arrangeActiveObject('bring-forward');
              setContextMenu(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <ChevronUp size={14} className="text-indigo-400" /> Bring Forward
            </span>
            <span className="text-[10px] opacity-50 font-mono">Alt+]</span>
          </button>
          <button
            type="button"
            onClick={() => {
              arrangeActiveObject('send-backward');
              setContextMenu(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <ChevronDown size={14} className="text-indigo-400" /> Send Backward
            </span>
            <span className="text-[10px] opacity-50 font-mono">Alt+[</span>
          </button>
          <button
            type="button"
            onClick={() => {
              arrangeActiveObject('send-to-back');
              setContextMenu(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <SendToBack size={14} className="text-indigo-400" /> Send to Back
            </span>
            <span className="text-[10px] opacity-50 font-mono">Ctrl+[</span>
          </button>

          {/* Alignment Section */}
          <div className={`my-1.5 border-t ${isDarkMode ? 'border-gray-700/60' : 'border-gray-200'}`} />
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider opacity-60">
            <span>Alignment</span>
          </div>

          <div className="grid grid-cols-4 gap-1 px-1.5 mb-1.5">
            <button
              type="button"
              onClick={() => {
                alignActiveObject('left');
                setContextMenu(null);
              }}
              className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-colors ${
                isDarkMode ? 'bg-white/5 hover:bg-white/10 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}
              title="Align Left"
            >
              <AlignLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                alignActiveObject('center');
                setContextMenu(null);
              }}
              className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-colors ${
                isDarkMode ? 'bg-white/5 hover:bg-white/10 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}
              title="Align Horizontal Center"
            >
              <AlignCenter size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                alignActiveObject('right');
                setContextMenu(null);
              }}
              className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-colors ${
                isDarkMode ? 'bg-white/5 hover:bg-white/10 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}
              title="Align Right"
            >
              <AlignRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                alignActiveObject('center-page');
                setContextMenu(null);
              }}
              className={`p-1.5 rounded-lg border text-xs flex items-center justify-center text-indigo-400 transition-colors ${
                isDarkMode ? 'bg-white/5 hover:bg-white/10 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}
              title="Center on Page"
            >
              <Maximize2 size={13} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 px-1.5 mb-1.5">
            <button
              type="button"
              onClick={() => {
                alignActiveObject('top');
                setContextMenu(null);
              }}
              className={`p-1.5 rounded-lg border text-xs flex items-center justify-center gap-1 transition-colors ${
                isDarkMode ? 'bg-white/5 hover:bg-white/10 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}
              title="Align Top"
            >
              <AlignStartVertical size={13} />
              <span className="text-[10px]">Top</span>
            </button>
            <button
              type="button"
              onClick={() => {
                alignActiveObject('middle');
                setContextMenu(null);
              }}
              className={`p-1.5 rounded-lg border text-xs flex items-center justify-center gap-1 transition-colors ${
                isDarkMode ? 'bg-white/5 hover:bg-white/10 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}
              title="Align Middle"
            >
              <AlignCenterVertical size={13} />
              <span className="text-[10px]">Mid</span>
            </button>
            <button
              type="button"
              onClick={() => {
                alignActiveObject('bottom');
                setContextMenu(null);
              }}
              className={`p-1.5 rounded-lg border text-xs flex items-center justify-center gap-1 transition-colors ${
                isDarkMode ? 'bg-white/5 hover:bg-white/10 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}
              title="Align Bottom"
            >
              <AlignEndVertical size={13} />
              <span className="text-[10px]">Bot</span>
            </button>
          </div>

          {/* Opacity Control */}
          <div className={`my-1.5 border-t ${isDarkMode ? 'border-gray-700/60' : 'border-gray-200'}`} />
          <div className="px-2 py-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-60">Opacity</span>
              <span className="text-[11px] font-mono opacity-80 font-bold">{Math.round(opacity * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.05" 
              max="1" 
              step="0.05"
              value={opacity}
              onChange={(e) => setObjectOpacity(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 mb-1.5"
            />
            <div className="grid grid-cols-4 gap-1">
              {[0.25, 0.5, 0.75, 1].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setObjectOpacity(val)}
                  className={`text-[10px] py-0.5 rounded font-mono border transition-colors ${
                    Math.abs(opacity - val) < 0.03
                      ? 'bg-indigo-600 text-white font-bold border-indigo-500'
                      : isDarkMode
                        ? 'bg-white/5 hover:bg-white/10 text-gray-300 border-gray-700'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {Math.round(val * 100)}%
                </button>
              ))}
            </div>
          </div>

          {/* Transform (Flip) */}
          <div className={`my-1.5 border-t ${isDarkMode ? 'border-gray-700/60' : 'border-gray-200'}`} />
          <div className="grid grid-cols-2 gap-1 px-1.5 mb-1">
            <button
              type="button"
              onClick={() => {
                flipActiveObject('horizontal');
                setContextMenu(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isDarkMode ? 'bg-white/5 hover:bg-white/10 text-gray-200 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
              }`}
              title="Flip Horizontal"
            >
              <FlipHorizontal size={13} className="text-indigo-400" />
              <span className="text-[11px]">Flip X</span>
            </button>
            <button
              type="button"
              onClick={() => {
                flipActiveObject('vertical');
                setContextMenu(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isDarkMode ? 'bg-white/5 hover:bg-white/10 text-gray-200 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
              }`}
              title="Flip Vertical"
            >
              <FlipVertical size={13} className="text-indigo-400" />
              <span className="text-[11px]">Flip Y</span>
            </button>
          </div>

          {/* Duplicate & Delete Actions */}
          <div className={`my-1.5 border-t ${isDarkMode ? 'border-gray-700/60' : 'border-gray-200'}`} />

          <button
            type="button"
            onClick={() => {
              duplicateActiveObject();
              setContextMenu(null);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <Copy size={14} className="text-indigo-400" /> Duplicate
            </span>
            <span className="text-[10px] opacity-50 font-mono">Ctrl+D</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const canvas = fabricRef.current;
              if (canvas) {
                const activeObjects = canvas.getActiveObjects();
                const toDelete = activeObjects.filter((o: any) => o.name !== 'a4-background' && o.name !== 'a4-ruled-line');
                if (toDelete.length > 0) {
                  canvas.discardActiveObject();
                  canvas.remove(...toDelete);
                  canvas.requestRenderAll();
                  recordState();
                }
              }
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/15 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trash2 size={14} /> Delete
            </span>
            <span className="text-[10px] opacity-50 font-mono">Del</span>
          </button>
        </div>
      )}
    </div>
  );
};
