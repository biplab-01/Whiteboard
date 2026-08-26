import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useBoardStore } from '../store/useBoardStore';
import { 
  compileExpression2D, 
  compileExpression3D,
  compileImplicit2D,
  compileImplicit3D,
  isImplicitExpression2D,
  isImplicitExpression3D
} from '../utils/mathParser';
import { 
  X, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Download, 
  Play, 
  Pause, 
  Box, 
  Grid as GridIcon,
  Sparkles,
  Layers,
  Check
} from 'lucide-react';

interface Equation2D {
  id: string;
  expr: string;
  color: string;
  visible: boolean;
}

const COLOR_PALETTE = [
  '#6366f1', // Indigo
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#38bdf8', // Sky Blue
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#14b8a6', // Teal
];

const PRESETS_2D = [
  { name: 'Circle (Implicit)', expr: 'x^2 + y^2 = 25' },
  { name: 'Ellipse (Implicit)', expr: 'x^2/16 + y^2/9 = 1' },
  { name: 'Hyperbola (Implicit)', expr: 'x^2/4 - y^2/4 = 1' },
  { name: 'Heart Curve (Implicit)', expr: '(x^2 + y^2 - 4)^3 = x^2 * y^3' },
  { name: 'Folium of Descartes', expr: 'x^3 + y^3 - 3*x*y = 0' },
  { name: 'Elliptic Curve (Implicit)', expr: 'y^2 = x^3 - 3*x + 3' },
  { name: 'Cassini Oval (Implicit)', expr: '(x^2 + y^2)^2 - 4*(x^2 - y^2) = 1' },
  { name: 'Periodic Grid (Implicit)', expr: 'sin(x) + cos(y) = 0.5' },
  { name: 'Sine Wave', expr: 'sin(x)' },
  { name: 'Parabola', expr: 'x^2 - 4' },
  { name: 'Cubic', expr: 'x^3 - 3x' },
  { name: 'Gaussian Bell', expr: 'e^(-x^2)' },
  { name: 'Damped Wave', expr: 'sin(5x) * e^(-x/2)' }
];

const PRESETS_3D = [
  { name: 'Sphere (Implicit 3D)', expr: 'x^2 + y^2 + z^2 = 9' },
  { name: 'Torus / Donut (Implicit 3D)', expr: '(x^2 + y^2 + z^2 + 4 - 1)^2 = 16*(x^2 + y^2)' },
  { name: '3D Heart Surface (Implicit 3D)', expr: '(2*x^2 + y^2 + z^2 - 1)^3 - 0.1*x^2*z^3 - y^2*z^3 = 0' },
  { name: 'Gyroid Lattice (Implicit 3D)', expr: 'cos(x)*sin(y) + cos(y)*sin(z) + cos(z)*sin(x) = 0' },
  { name: 'Hyperboloid (Implicit 3D)', expr: 'x^2 + y^2 - z^2 = 1' },
  { name: 'Double Cone (Implicit 3D)', expr: 'x^2 + y^2 = z^2' },
  { name: 'Superquadric (Implicit 3D)', expr: 'x^4 + y^4 + z^4 = 16' },
  { name: 'Goursat Surface (Implicit 3D)', expr: 'x^4 + y^4 + z^4 - 1.5*(x^2 + y^2 + z^2) + 1 = 0' },
  { name: 'Ripple Waves (Explicit)', expr: 'sin(sqrt(x^2 + y^2))' },
  { name: 'Saddle Surface (Explicit)', expr: 'x^2 - y^2' },
  { name: 'Sombrero / Hat (Explicit)', expr: 'sin(sqrt(x^2+y^2)+0.01)/(sqrt(x^2+y^2)+0.01)' },
  { name: 'Paraboloid Bowl (Explicit)', expr: '(x^2 + y^2) / 4' }
];

interface GraphingCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GraphingCalculator: React.FC<GraphingCalculatorProps> = ({ isOpen, onClose }) => {
  const { isDarkMode } = useBoardStore();
  const [activeTab, setActiveTab] = useState<'2d' | '3d'>('2d');

  // 2D Equations State
  const [equations2D, setEquations2D] = useState<Equation2D[]>([
    { id: '1', expr: 'sin(x)', color: '#6366f1', visible: true },
    { id: '2', expr: 'x^2 - 4', color: '#ef4444', visible: false }
  ]);
  const [activeEqIndex, setActiveEqIndex] = useState<number>(0);

  // 2D Viewport State
  const [view2D, setView2D] = useState({
    centerX: 0,
    centerY: 0,
    zoom: 40, // pixels per unit
  });
  const [mouseCoord, setMouseCoord] = useState<{ x: number; y: number } | null>(null);

  // 3D Equation & Viewport State
  const [expr3D, setExpr3D] = useState('sin(sqrt(x^2 + y^2))');
  const [view3D, setView3D] = useState({
    rotX: 35, // Pitch in degrees
    rotZ: 45, // Yaw in degrees
    zoom: 24,
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    resolution: 32, // Grid mesh density
    wireframe: false,
    colorScheme: 'rainbow' as 'rainbow' | 'neon' | 'ocean' | 'emerald',
    autoRotate: false
  });

  // Import Options
  const [importBg, setImportBg] = useState<'transparent' | 'dark' | 'light'>('transparent');
  const [importSuccessToast, setImportSuccessToast] = useState(false);

  // Canvas Refs
  const canvas2DRef = useRef<HTMLCanvasElement>(null);
  const canvas3DRef = useRef<HTMLCanvasElement>(null);
  const isDragging2D = useRef(false);
  const dragStart2D = useRef({ x: 0, y: 0, centerX: 0, centerY: 0 });

  const isDragging3D = useRef(false);
  const dragStart3D = useRef({ x: 0, y: 0, rotX: 0, rotZ: 0 });

  // Auto-rotate 3D animation frame
  useEffect(() => {
    if (!view3D.autoRotate || activeTab !== '3d' || !isOpen) return;

    let animId: number;
    const animate = () => {
      setView3D(prev => ({ ...prev, rotZ: (prev.rotZ + 0.5) % 360 }));
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [view3D.autoRotate, activeTab, isOpen]);

  // Insert token into active equation input
  const insertToken = (token: string) => {
    if (activeTab === '2d') {
      setEquations2D(prev => {
        const next = [...prev];
        if (next[activeEqIndex]) {
          next[activeEqIndex] = {
            ...next[activeEqIndex],
            expr: next[activeEqIndex].expr + token
          };
        }
        return next;
      });
    } else {
      setExpr3D(prev => prev + token);
    }
  };

  // Add 2D equation
  const handleAddEquation = () => {
    const nextColor = COLOR_PALETTE[equations2D.length % COLOR_PALETTE.length];
    const newEq: Equation2D = {
      id: Math.random().toString(36).substring(2, 9),
      expr: '',
      color: nextColor,
      visible: true
    };
    setEquations2D(prev => [...prev, newEq]);
    setActiveEqIndex(equations2D.length);
  };

  // Remove 2D equation
  const handleRemoveEquation = (id: string) => {
    if (equations2D.length <= 1) return;
    setEquations2D(prev => prev.filter(e => e.id !== id));
    setActiveEqIndex(0);
  };

  // -------------------------------------------------------------
  // RENDER 2D GRAPH
  // -------------------------------------------------------------
  const draw2DGraph = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, customBg?: 'transparent' | 'dark' | 'light') => {
    ctx.clearRect(0, 0, width, height);

    const isDark = customBg ? customBg === 'dark' : isDarkMode;
    const bg = customBg === 'transparent' ? 'transparent' : isDark ? '#0f172a' : '#ffffff';

    if (bg !== 'transparent') {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }

    const { centerX, centerY, zoom } = view2D;
    const originCanvasX = width / 2 - centerX * zoom;
    const originCanvasY = height / 2 + centerY * zoom;

    // Grid step calculation based on zoom level
    const roughSteps = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
    let unitStep = 1;
    for (const step of roughSteps) {
      if (step * zoom >= 45) {
        unitStep = step;
        break;
      }
    }

    const xMin = (0 - originCanvasX) / zoom;
    const xMax = (width - originCanvasX) / zoom;
    const yMin = (originCanvasY - height) / zoom;
    const yMax = (originCanvasY - 0) / zoom;

    // Draw Minor Grid Lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    // Vertical grid lines
    const firstX = Math.floor(xMin / unitStep) * unitStep;
    for (let x = firstX; x <= xMax; x += unitStep) {
      const cx = originCanvasX + x * zoom;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    const firstY = Math.floor(yMin / unitStep) * unitStep;
    for (let y = firstY; y <= yMax; y += unitStep) {
      const cy = originCanvasY - y * zoom;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
    }

    // Draw Main Coordinate Axes (X and Y)
    ctx.lineWidth = 2;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';

    // X Axis
    ctx.beginPath();
    ctx.moveTo(0, originCanvasY);
    ctx.lineTo(width, originCanvasY);
    ctx.stroke();

    // Y Axis
    ctx.beginPath();
    ctx.moveTo(originCanvasX, 0);
    ctx.lineTo(originCanvasX, height);
    ctx.stroke();

    // Draw Numbers / Axis Labels
    ctx.font = '11px sans-serif';
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // X axis labels
    for (let x = firstX; x <= xMax; x += unitStep) {
      if (Math.abs(x) < 0.0001) continue; // Skip origin
      const cx = originCanvasX + x * zoom;
      const label = Number(x.toFixed(4)).toString();
      const labelY = Math.max(10, Math.min(height - 20, originCanvasY + 6));
      ctx.fillText(label, cx, labelY);
    }

    // Y axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = firstY; y <= yMax; y += unitStep) {
      if (Math.abs(y) < 0.0001) continue;
      const cy = originCanvasY - y * zoom;
      const label = Number(y.toFixed(4)).toString();
      const labelX = Math.max(30, Math.min(width - 10, originCanvasX - 6));
      ctx.fillText(label, labelX, cy);
    }

    // Origin (0,0) label
    ctx.textAlign = 'right';
    ctx.fillText('0', originCanvasX - 6, originCanvasY + 6);

    // Draw Equations Curves
    equations2D.forEach((eq) => {
      if (!eq.visible || !eq.expr.trim()) return;

      if (isImplicitExpression2D(eq.expr)) {
        // 2D Implicit Function Plotting using Marching Squares
        const { fn } = compileImplicit2D(eq.expr);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = eq.color;
        ctx.beginPath();

        const gridW = Math.min(240, Math.max(80, Math.round(width / 3.5)));
        const gridH = Math.min(180, Math.max(60, Math.round(height / 3.5)));
        const cellW = width / gridW;
        const cellH = height / gridH;

        const gridVals: number[][] = [];
        for (let i = 0; i <= gridW; i++) {
          gridVals[i] = [];
          const px = i * cellW;
          const mathX = (px - originCanvasX) / zoom;
          for (let j = 0; j <= gridH; j++) {
            const py = j * cellH;
            const mathY = (originCanvasY - py) / zoom;
            const val = fn(mathX, mathY);
            gridVals[i][j] = isNaN(val) ? 0 : val;
          }
        }

        const lerp = (p1: number, p2: number, v1: number, v2: number) => {
          if (Math.abs(v2 - v1) < 1e-7) return (p1 + p2) / 2;
          return p1 + (-v1 / (v2 - v1)) * (p2 - p1);
        };

        for (let i = 0; i < gridW; i++) {
          const x0 = i * cellW;
          const x1 = (i + 1) * cellW;
          for (let j = 0; j < gridH; j++) {
            const y0 = j * cellH;
            const y1 = (j + 1) * cellH;

            const v0 = gridVals[i][j];
            const v1 = gridVals[i + 1][j];
            const v2 = gridVals[i + 1][j + 1];
            const v3 = gridVals[i][j + 1];

            let mask = 0;
            if (v0 > 0) mask |= 1;
            if (v1 > 0) mask |= 2;
            if (v2 > 0) mask |= 4;
            if (v3 > 0) mask |= 8;

            if (mask === 0 || mask === 15) continue;

            const topPt = { x: lerp(x0, x1, v0, v1), y: y0 };
            const rightPt = { x: x1, y: lerp(y0, y1, v1, v2) };
            const bottomPt = { x: lerp(x0, x1, v3, v2), y: y1 };
            const leftPt = { x: x0, y: lerp(y0, y1, v0, v3) };

            switch (mask) {
              case 1:
              case 14:
                ctx.moveTo(leftPt.x, leftPt.y); ctx.lineTo(topPt.x, topPt.y);
                break;
              case 2:
              case 13:
                ctx.moveTo(topPt.x, topPt.y); ctx.lineTo(rightPt.x, rightPt.y);
                break;
              case 3:
              case 12:
                ctx.moveTo(leftPt.x, leftPt.y); ctx.lineTo(rightPt.x, rightPt.y);
                break;
              case 4:
              case 11:
                ctx.moveTo(rightPt.x, rightPt.y); ctx.lineTo(bottomPt.x, bottomPt.y);
                break;
              case 5: {
                const centerVal = (v0 + v1 + v2 + v3) / 4;
                if (centerVal > 0) {
                  ctx.moveTo(leftPt.x, leftPt.y); ctx.lineTo(topPt.x, topPt.y);
                  ctx.moveTo(rightPt.x, rightPt.y); ctx.lineTo(bottomPt.x, bottomPt.y);
                } else {
                  ctx.moveTo(leftPt.x, leftPt.y); ctx.lineTo(bottomPt.x, bottomPt.y);
                  ctx.moveTo(topPt.x, topPt.y); ctx.lineTo(rightPt.x, rightPt.y);
                }
                break;
              }
              case 6:
              case 9:
                ctx.moveTo(topPt.x, topPt.y); ctx.lineTo(bottomPt.x, bottomPt.y);
                break;
              case 7:
              case 8:
                ctx.moveTo(leftPt.x, leftPt.y); ctx.lineTo(bottomPt.x, bottomPt.y);
                break;
              case 10: {
                const centerVal = (v0 + v1 + v2 + v3) / 4;
                if (centerVal > 0) {
                  ctx.moveTo(topPt.x, topPt.y); ctx.lineTo(rightPt.x, rightPt.y);
                  ctx.moveTo(leftPt.x, leftPt.y); ctx.lineTo(bottomPt.x, bottomPt.y);
                } else {
                  ctx.moveTo(topPt.x, topPt.y); ctx.lineTo(leftPt.x, leftPt.y);
                  ctx.moveTo(rightPt.x, rightPt.y); ctx.lineTo(bottomPt.x, bottomPt.y);
                }
                break;
              }
            }
          }
        }
        ctx.stroke();
      } else {
        // Explicit 2D Curve
        const { fn } = compileExpression2D(eq.expr);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = eq.color;
        ctx.beginPath();

        let isDrawing = false;
        const pixelStep = 1; // 1px horizontal sampling

        for (let px = 0; px <= width; px += pixelStep) {
          const mathX = (px - originCanvasX) / zoom;
          const mathY = fn(mathX);

          if (isNaN(mathY) || !isFinite(mathY)) {
            isDrawing = false;
            continue;
          }

          const py = originCanvasY - mathY * zoom;

          // Prevent asymptote vertical lines
          if (py < -height || py > height * 2) {
            isDrawing = false;
            continue;
          }

          if (!isDrawing) {
            ctx.moveTo(px, py);
            isDrawing = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      }
    });
  }, [view2D, equations2D, isDarkMode]);

  // -------------------------------------------------------------
  // RENDER 3D SURFACE (EXPLICIT & IMPLICIT)
  // -------------------------------------------------------------
  const draw3DGraph = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, customBg?: 'transparent' | 'dark' | 'light') => {
    ctx.clearRect(0, 0, width, height);

    const isDark = customBg ? customBg === 'dark' : isDarkMode;
    const bg = customBg === 'transparent' ? 'transparent' : isDark ? '#0f172a' : '#ffffff';

    if (bg !== 'transparent') {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
    }

    const { rotX, rotZ, zoom, xMin, xMax, yMin, yMax, resolution, wireframe, colorScheme } = view3D;

    // Color gradient function
    const getColor = (t: number, lightFactor: number = 1) => {
      const clampT = Math.max(0, Math.min(1, t));
      let r = 0, g = 0, b = 0;

      if (colorScheme === 'rainbow') {
        const hue = (1 - clampT) * 240;
        const h = hue / 360;
        const s = 0.85;
        const l = Math.min(0.75, 0.45 * lightFactor);
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (tVal: number) => {
          let tNorm = tVal;
          if (tNorm < 0) tNorm += 1;
          if (tNorm > 1) tNorm -= 1;
          if (tNorm < 1/6) return p + (q - p) * 6 * tNorm;
          if (tNorm < 1/2) return q;
          if (tNorm < 2/3) return p + (q - p) * (2/3 - tNorm) * 6;
          return p;
        };
        r = Math.round(hue2rgb(h + 1/3) * 255);
        g = Math.round(hue2rgb(h) * 255);
        b = Math.round(hue2rgb(h - 1/3) * 255);
      } else if (colorScheme === 'neon') {
        r = Math.round((0.2 + 0.8 * clampT) * 255 * lightFactor);
        g = Math.round((0.1 + 0.6 * (1 - clampT)) * 255 * lightFactor);
        b = Math.round((0.9 - 0.5 * clampT) * 255 * lightFactor);
      } else if (colorScheme === 'ocean') {
        r = Math.round((0.1 + 0.8 * clampT) * 255 * lightFactor);
        g = Math.round((0.4 + 0.5 * clampT) * 255 * lightFactor);
        b = Math.round((0.9 + 0.1 * clampT) * 255 * lightFactor);
      } else {
        r = Math.round((0.1 + 0.9 * clampT) * 255 * lightFactor);
        g = Math.round((0.7 + 0.2 * clampT) * 255 * lightFactor);
        b = Math.round((0.3 * (1 - clampT)) * 255 * lightFactor);
      }

      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));

      return { r, g, b, str: `rgb(${r}, ${g}, ${b})` };
    };

    // -----------------------------------------------------------
    // IMPLICIT 3D ISOSURFACE VOLUMETRIC CONTOUR MESHING (Fast & Smooth)
    // -----------------------------------------------------------
    if (isImplicitExpression3D(expr3D)) {
      const { fn: implicitFn } = compileImplicit3D(expr3D);
      const L = 4.0;
      const radX = (rotX * Math.PI) / 180;
      const radZ = (rotZ * Math.PI) / 180;
      const cosX = Math.cos(radX), sinX = Math.sin(radX);
      const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

      const project = (x: number, y: number, z: number) => {
        const x1 = x * cosZ - y * sinZ;
        const y1 = x * sinZ + y * cosZ;
        const z1 = z;
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;
        const screenX = width / 2 + x2 * zoom;
        const screenY = height / 2 - z2 * zoom;
        return { x: screenX, y: screenY, depth: y2 };
      };

      const numSlices = wireframe ? 14 : 26;
      const zStep = (2 * L) / numSlices;
      const gridRes = 32;
      const stepXY = (2 * L) / gridRes;

      interface ContourSegment {
        p1: { x: number; y: number; depth: number };
        p2: { x: number; y: number; depth: number };
        avgDepth: number;
        normH: number;
      }
      const segments: ContourSegment[] = [];

      for (let s = 0; s <= numSlices; s++) {
        const sliceZ = -L + s * zStep;
        const sliceVals: number[][] = [];
        for (let i = 0; i <= gridRes; i++) {
          sliceVals[i] = [];
          const x = -L + i * stepXY;
          for (let j = 0; j <= gridRes; j++) {
            const y = -L + j * stepXY;
            let v = implicitFn(x, y, sliceZ);
            if (isNaN(v) || !isFinite(v)) v = 0;
            sliceVals[i][j] = v;
          }
        }

        for (let i = 0; i < gridRes; i++) {
          for (let j = 0; j < gridRes; j++) {
            const v0 = sliceVals[i][j];
            const v1 = sliceVals[i + 1][j];
            const v2 = sliceVals[i + 1][j + 1];
            const v3 = sliceVals[i][j + 1];
            let mask = 0;
            if (v0 > 0) mask |= 1;
            if (v1 > 0) mask |= 2;
            if (v2 > 0) mask |= 4;
            if (v3 > 0) mask |= 8;
            if (mask === 0 || mask === 15) continue;

            const xA = -L + i * stepXY;
            const xB = xA + stepXY;
            const yA = -L + j * stepXY;
            const yB = yA + stepXY;
            const lerp3 = (p1: number, p2: number, va: number, vb: number) => p1 + (-va / (vb - va || 1e-6)) * (p2 - p1);
            const pTop = project(lerp3(xA, xB, v0, v1), yA, sliceZ);
            const pRight = project(xB, lerp3(yA, yB, v1, v2), sliceZ);
            const pBottom = project(lerp3(xA, xB, v3, v2), yB, sliceZ);
            const pLeft = project(xA, lerp3(yA, yB, v0, v3), sliceZ);

            let ptA = pLeft, ptB = pTop;
            if (mask === 2 || mask === 13) { ptA = pTop; ptB = pRight; }
            else if (mask === 3 || mask === 12) { ptA = pLeft; ptB = pRight; }
            else if (mask === 4 || mask === 11) { ptA = pRight; ptB = pBottom; }
            else if (mask === 6 || mask === 9) { ptA = pTop; ptB = pBottom; }
            else if (mask === 7 || mask === 8) { ptA = pLeft; ptB = pBottom; }

            const avgD = (ptA.depth + ptB.depth) / 2;
            const normH = Math.max(0, Math.min(1, (sliceZ + L * 0.8) / (L * 1.6)));
            segments.push({ p1: ptA, p2: ptB, avgDepth: avgD, normH });
          }
        }
      }

      // Depth sort segments from furthest to nearest
      segments.sort((a, b) => a.avgDepth - b.avgDepth);
      ctx.lineWidth = wireframe ? 1.5 : 2.5;

      for (const seg of segments) {
        const col = getColor(seg.normH, 1.0);
        ctx.strokeStyle = col.str;
        ctx.beginPath();
        ctx.moveTo(seg.p1.x, seg.p1.y);
        ctx.lineTo(seg.p2.x, seg.p2.y);
        ctx.stroke();
      }

      // Draw Coordinate Axes Base Box
      ctx.lineWidth = 2;
      const o = project(0, 0, 0);
      const axX = project(L * 0.8, 0, 0);
      const axY = project(0, L * 0.8, 0);
      const axZ = project(0, 0, L * 0.8);

      // X Axis (Red)
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(axX.x, axX.y);
      ctx.stroke();

      // Y Axis (Green)
      ctx.strokeStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(axY.x, axY.y);
      ctx.stroke();

      // Z Axis (Blue)
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(axZ.x, axZ.y);
      ctx.stroke();

      // Draw Axis Labels
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('X', axX.x + 6, axX.y);
      ctx.fillStyle = '#10b981';
      ctx.fillText('Y', axY.x + 6, axY.y);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('Z', axZ.x + 6, axZ.y);

      return;
    }

    // -----------------------------------------------------------
    // EXPLICIT 3D SURFACE QUAD MESH
    // -----------------------------------------------------------
    const { fn } = compileExpression3D(expr3D);

    const radX = (rotX * Math.PI) / 180;
    const radZ = (rotZ * Math.PI) / 180;
    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

    // 3D Point Projection Helper
    const project = (x: number, y: number, z: number) => {
      const x1 = x * cosZ - y * sinZ;
      const y1 = x * sinZ + y * cosZ;
      const z1 = z;

      const x2 = x1;
      const y2 = y1 * cosX - z1 * sinX;
      const z2 = y1 * sinX + z1 * cosX;

      const screenX = width / 2 + x2 * zoom;
      const screenY = height / 2 - z2 * zoom;

      return { x: screenX, y: screenY, depth: y2 };
    };

    // Calculate grid vertices & find min/max Z for color mapping
    const stepX = (xMax - xMin) / resolution;
    const stepY = (yMax - yMin) / resolution;

    let minZ = Infinity;
    let maxZ = -Infinity;

    const gridZ: number[][] = [];
    for (let i = 0; i <= resolution; i++) {
      gridZ[i] = [];
      const x = xMin + i * stepX;
      for (let j = 0; j <= resolution; j++) {
        const y = yMin + j * stepY;
        let z = fn(x, y);
        if (isNaN(z) || !isFinite(z)) z = 0;
        z = Math.max(-10, Math.min(10, z));
        gridZ[i][j] = z;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }

    if (minZ === maxZ) maxZ = minZ + 1;

    interface Quad {
      p1: { x: number; y: number; depth: number };
      p2: { x: number; y: number; depth: number };
      p3: { x: number; y: number; depth: number };
      p4: { x: number; y: number; depth: number };
      avgZ: number;
      avgDepth: number;
      light: number;
    }

    const quads: Quad[] = [];

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const x1 = xMin + i * stepX;
        const x2 = x1 + stepX;
        const y1 = yMin + j * stepY;
        const y2 = y1 + stepY;

        const z11 = gridZ[i][j];
        const z21 = gridZ[i + 1][j];
        const z22 = gridZ[i + 1][j + 1];
        const z12 = gridZ[i][j + 1];

        const p1 = project(x1, y1, z11);
        const p2 = project(x2, y1, z21);
        const p3 = project(x2, y2, z22);
        const p4 = project(x1, y2, z12);

        const dzx = (z21 - z11) / stepX;
        const dzy = (z12 - z11) / stepY;
        const nx = -dzx;
        const ny = -dzy;
        const nz = 1;
        const len = Math.hypot(nx, ny, nz);
        const dot = (nx * 0.4 - ny * 0.4 + nz * 0.8) / (len || 1);
        const light = Math.max(0.6, Math.min(1.3, 0.9 + dot * 0.4));

        const avgZ = (z11 + z21 + z22 + z12) / 4;
        const avgDepth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;

        quads.push({ p1, p2, p3, p4, avgZ, avgDepth, light });
      }
    }

    quads.sort((a, b) => a.avgDepth - b.avgDepth);

    // Draw Coordinate Axes Base Box
    ctx.lineWidth = 1;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
    const o = project(0, 0, 0);
    const axX = project(xMax, 0, 0);
    const axY = project(0, yMax, 0);
    const axZ = project(0, 0, Math.max(2, maxZ));

    // X Axis (Red)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(axX.x, axX.y);
    ctx.stroke();

    // Y Axis (Green)
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(axY.x, axY.y);
    ctx.stroke();

    // Z Axis (Blue)
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(axZ.x, axZ.y);
    ctx.stroke();

    // Draw Axis Labels
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('X', axX.x + 6, axX.y);
    ctx.fillStyle = '#10b981';
    ctx.fillText('Y', axY.x + 6, axY.y);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Z', axZ.x + 6, axZ.y);

    // Render Quads
    quads.forEach((q) => {
      const normZ = (q.avgZ - minZ) / (maxZ - minZ || 1);
      const col = getColor(normZ, q.light);
      ctx.fillStyle = col.str;
      ctx.strokeStyle = isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.6;

      ctx.beginPath();
      ctx.moveTo(q.p1.x, q.p1.y);
      ctx.lineTo(q.p2.x, q.p2.y);
      ctx.lineTo(q.p3.x, q.p3.y);
      ctx.lineTo(q.p4.x, q.p4.y);
      ctx.closePath();

      if (!wireframe) {
        ctx.fill();
      }
      ctx.stroke();
    });
  }, [view3D, expr3D, isDarkMode]);

  // Live Canvas Updates
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === '2d' && canvas2DRef.current) {
      const canvas = canvas2DRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) draw2DGraph(ctx, canvas.width, canvas.height);
    } else if (activeTab === '3d' && canvas3DRef.current) {
      const canvas = canvas3DRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) draw3DGraph(ctx, canvas.width, canvas.height);
    }
  }, [activeTab, isOpen, draw2DGraph, draw3DGraph]);

  // -------------------------------------------------------------
  // IMPORT INTO WHITEBOARD PAGE AS PNG
  // -------------------------------------------------------------
  const handleImportToPage = () => {
    const exportWidth = 1400;
    const exportHeight = 950;
    const offscreen = document.createElement('canvas');
    offscreen.width = exportWidth;
    offscreen.height = exportHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    if (activeTab === '2d') {
      draw2DGraph(ctx, exportWidth, exportHeight, importBg);
    } else {
      draw3DGraph(ctx, exportWidth, exportHeight, importBg);
    }

    const dataUrl = offscreen.toDataURL('image/png');

    // Convert dataUrl to blob/file to dispatch standard insert-media
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `graph_${activeTab}_${Date.now()}.png`, { type: 'image/png' });
        window.dispatchEvent(new CustomEvent('insert-media', {
          detail: {
            url: dataUrl,
            type: 'image',
            file
          }
        }));

        setImportSuccessToast(true);
        setTimeout(() => {
          setImportSuccessToast(false);
          onClose();
        }, 1200);
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className={`relative w-full max-w-5xl h-[88vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl ${
        isDarkMode ? 'bg-[#131722]/95 border-gray-700/80 text-white' : 'bg-white/95 border-gray-200 text-gray-800'
      }`}>

        {/* TOP BAR */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-md">
              <Sparkles size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base tracking-wide">Graphing Calculator</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Desmos-Style
                </span>
              </div>
              <p className="text-xs text-gray-400">Plot 2D mathematical functions & 3D parametric surfaces</p>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200/30 dark:border-gray-700/50">
            <button
              onClick={() => setActiveTab('2d')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === '2d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <GridIcon size={14} /> 2D Graph
            </button>
            <button
              onClick={() => setActiveTab('3d')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === '3d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Box size={14} /> 3D Surface
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* MAIN BODY: SPLIT VIEW */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT PANEL: EQUATIONS & CONTROLS */}
          <div className="w-84 border-r border-gray-200/20 p-4 flex flex-col justify-between overflow-y-auto custom-scrollbar shrink-0">
            <div className="space-y-4">

              {/* 2D Mode Equation List */}
              {activeTab === '2d' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">2D Equations (Explicit & Implicit)</span>
                    <button
                      onClick={handleAddEquation}
                      className="px-2 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {equations2D.map((eq, index) => {
                      const isActive = activeEqIndex === index;
                      const isImplicit = isImplicitExpression2D(eq.expr);
                      const { error } = isImplicit ? compileImplicit2D(eq.expr) : compileExpression2D(eq.expr);

                      return (
                        <div
                          key={eq.id}
                          onClick={() => setActiveEqIndex(index)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isActive
                              ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                              : 'border-gray-200/20 bg-gray-800/30 hover:bg-gray-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {/* Color Tag & Visiblity */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextIndex = (COLOR_PALETTE.indexOf(eq.color) + 1) % COLOR_PALETTE.length;
                                setEquations2D(prev => prev.map((item, i) => i === index ? { ...item, color: COLOR_PALETTE[nextIndex] } : item));
                              }}
                              className="w-4 h-4 rounded-full shrink-0 border border-white/40 shadow-sm"
                              style={{ backgroundColor: eq.color }}
                              title="Change Color"
                            />

                            <span className="font-serif italic font-bold text-xs text-indigo-400 shrink-0">
                              {isImplicit ? 'F(x,y)' : 'y ='}
                            </span>

                            <input
                              type="text"
                              value={eq.expr}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEquations2D(prev => prev.map((item, i) => i === index ? { ...item, expr: val } : item));
                              }}
                              placeholder="e.g. sin(x) or x^2 + y^2 = 25"
                              className="flex-1 bg-transparent text-xs font-mono focus:outline-none text-white"
                            />

                            {/* Visibility Toggle */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEquations2D(prev => prev.map((item, i) => i === index ? { ...item, visible: !item.visible } : item));
                              }}
                              className="text-gray-400 hover:text-white p-1"
                              title={eq.visible ? 'Hide graph' : 'Show graph'}
                            >
                              {eq.visible ? <Eye size={14} className="text-indigo-400" /> : <EyeOff size={14} />}
                            </button>

                            {/* Remove button */}
                            {equations2D.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveEquation(eq.id);
                                }}
                                className="text-gray-500 hover:text-red-400 p-1"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          {error && eq.expr.trim() && (
                            <p className="text-[10px] text-red-400 mt-1 pl-6">⚠️ {error}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 2D Presets */}
                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Presets</span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESETS_2D.map(p => (
                        <button
                          key={p.name}
                          onClick={() => {
                            setEquations2D(prev => {
                              const next = [...prev];
                              if (next[activeEqIndex]) {
                                next[activeEqIndex] = { ...next[activeEqIndex], expr: p.expr, visible: true };
                              }
                              return next;
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-gray-700 bg-gray-800/60 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white transition-all text-gray-300"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* 3D Mode Equation & Controls */
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                      Surface Equation (Explicit or Implicit 3D)
                    </span>
                    <div className="p-3 rounded-xl border border-indigo-500/50 bg-indigo-500/10 flex items-center gap-2">
                      <span className="font-serif italic font-bold text-sm text-indigo-400 shrink-0">
                        {isImplicitExpression3D(expr3D) ? 'F(x,y,z)' : 'z ='}
                      </span>
                      <input
                        type="text"
                        value={expr3D}
                        onChange={(e) => setExpr3D(e.target.value)}
                        placeholder="e.g. sin(sqrt(x^2+y^2)) or x^2+y^2+z^2=9"
                        className="flex-1 bg-transparent text-sm font-mono focus:outline-none text-white"
                      />
                    </div>
                    {(() => {
                      const isImp = isImplicitExpression3D(expr3D);
                      const { error } = isImp ? compileImplicit3D(expr3D) : compileExpression3D(expr3D);
                      return error && expr3D.trim() ? (
                        <p className="text-[10px] text-red-400 mt-1">⚠️ {error}</p>
                      ) : null;
                    })()}
                  </div>

                  {/* 3D Presets */}
                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Surface Presets</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PRESETS_3D.map(p => (
                        <button
                          key={p.name}
                          onClick={() => setExpr3D(p.expr)}
                          className={`px-2 py-1.5 rounded-lg text-left text-[11px] font-medium border transition-all truncate ${
                            expr3D === p.expr
                              ? 'border-indigo-500 bg-indigo-600 text-white'
                              : 'border-gray-700 bg-gray-800/60 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3D Appearance Settings */}
                  <div className="space-y-2.5 pt-2 border-t border-gray-200/20">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">3D Controls</span>
                    
                    {/* Colormap */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Color Theme:</span>
                      <div className="flex gap-1">
                        {(['rainbow', 'neon', 'ocean', 'emerald'] as const).map(c => (
                          <button
                            key={c}
                            onClick={() => setView3D(prev => ({ ...prev, colorScheme: c }))}
                            className={`px-2 py-1 rounded-md text-[10px] capitalize font-medium transition-all ${
                              view3D.colorScheme === c
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-gray-800 text-gray-400 hover:text-white'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Auto Rotate & Wireframe */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setView3D(prev => ({ ...prev, autoRotate: !prev.autoRotate }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                          view3D.autoRotate
                            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                            : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {view3D.autoRotate ? <Pause size={13} /> : <Play size={13} />}
                        <span>Auto-Spin</span>
                      </button>

                      <button
                        onClick={() => setView3D(prev => ({ ...prev, wireframe: !prev.wireframe }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                          view3D.wireframe
                            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                            : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <Layers size={13} />
                        <span>Wireframe</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Math Virtual Keypad */}
              <div className="pt-3 border-t border-gray-200/20">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Quick Math Keypad</span>
                <div className="grid grid-cols-6 gap-1.5">
                  {['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', '^', 'pi', 'e', 'abs', 'x', 'y', 'z', '=', '(', ')', '+', '-', '*', '/', '0', '1', '2', '3'].map(token => (
                    <button
                      key={token}
                      onClick={() => insertToken(
                        token === 'pi' ? 'pi' : 
                        token === 'sqrt' ? 'sqrt(' : 
                        token === 'sin' || token === 'cos' || token === 'tan' || token === 'log' || token === 'ln' || token === 'abs' ? `${token}(` : 
                        token
                      )}
                      className="h-7 rounded-md bg-gray-800/80 hover:bg-indigo-600 hover:text-white text-gray-200 font-mono text-xs border border-gray-700/60 transition-all flex items-center justify-center shadow-xs active:scale-95"
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* BOTTOM EXPORT & IMPORT ACTION BAR */}
            <div className="pt-4 border-t border-gray-200/20 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Canvas Background:</span>
                <div className="flex gap-1">
                  {(['transparent', 'dark', 'light'] as const).map(bg => (
                    <button
                      key={bg}
                      onClick={() => setImportBg(bg)}
                      className={`px-2 py-0.5 rounded text-[10px] capitalize font-medium ${
                        importBg === bg ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {bg}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleImportToPage}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98]"
              >
                {importSuccessToast ? (
                  <>
                    <Check size={16} className="text-emerald-300" />
                    <span>Imported to Page!</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Import into Page as PNG</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: INTERACTIVE GRAPH CANVAS */}
          <div className="flex-1 relative bg-[#0b0e14] flex items-center justify-center overflow-hidden">
            
            {activeTab === '2d' ? (
              <canvas
                ref={canvas2DRef}
                width={800}
                height={600}
                className="w-full h-full cursor-crosshair"
                onMouseDown={(e) => {
                  isDragging2D.current = true;
                  dragStart2D.current = {
                    x: e.clientX,
                    y: e.clientY,
                    centerX: view2D.centerX,
                    centerY: view2D.centerY
                  };
                }}
                onMouseMove={(e) => {
                  const rect = canvas2DRef.current?.getBoundingClientRect();
                  if (rect) {
                    const px = e.clientX - rect.left;
                    const py = e.clientY - rect.top;
                    const originCanvasX = rect.width / 2 - view2D.centerX * view2D.zoom;
                    const originCanvasY = rect.height / 2 + view2D.centerY * view2D.zoom;
                    const mathX = (px - originCanvasX) / view2D.zoom;
                    const mathY = (originCanvasY - py) / view2D.zoom;
                    setMouseCoord({ x: mathX, y: mathY });
                  }

                  if (!isDragging2D.current) return;
                  const dx = (e.clientX - dragStart2D.current.x) / view2D.zoom;
                  const dy = (e.clientY - dragStart2D.current.y) / view2D.zoom;
                  setView2D(prev => ({
                    ...prev,
                    centerX: dragStart2D.current.centerX - dx,
                    centerY: dragStart2D.current.centerY + dy
                  }));
                }}
                onMouseUp={() => { isDragging2D.current = false; }}
                onMouseLeave={() => { isDragging2D.current = false; setMouseCoord(null); }}
                onWheel={(e) => {
                  e.preventDefault();
                  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
                  setView2D(prev => ({
                    ...prev,
                    zoom: Math.max(5, Math.min(500, prev.zoom * zoomFactor))
                  }));
                }}
              />
            ) : (
              <canvas
                ref={canvas3DRef}
                width={800}
                height={600}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => {
                  isDragging3D.current = true;
                  dragStart3D.current = {
                    x: e.clientX,
                    y: e.clientY,
                    rotX: view3D.rotX,
                    rotZ: view3D.rotZ
                  };
                }}
                onMouseMove={(e) => {
                  if (!isDragging3D.current) return;
                  const dx = e.clientX - dragStart3D.current.x;
                  const dy = e.clientY - dragStart3D.current.y;
                  setView3D(prev => ({
                    ...prev,
                    rotZ: (dragStart3D.current.rotZ + dx * 0.6) % 360,
                    rotX: Math.max(-85, Math.min(85, dragStart3D.current.rotX + dy * 0.6))
                  }));
                }}
                onMouseUp={() => { isDragging3D.current = false; }}
                onMouseLeave={() => { isDragging3D.current = false; }}
                onWheel={(e) => {
                  e.preventDefault();
                  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
                  setView3D(prev => ({
                    ...prev,
                    zoom: Math.max(5, Math.min(80, prev.zoom * zoomFactor))
                  }));
                }}
              />
            )}

            {/* OVERLAY CONTROLS */}
            <div className="absolute top-4 right-4 flex flex-col gap-1.5 bg-gray-900/80 p-1.5 rounded-xl border border-gray-700/60 backdrop-blur-md">
              <button
                onClick={() => {
                  if (activeTab === '2d') {
                    setView2D(prev => ({ ...prev, zoom: Math.min(500, prev.zoom * 1.25) }));
                  } else {
                    setView3D(prev => ({ ...prev, zoom: Math.min(80, prev.zoom * 1.25) }));
                  }
                }}
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>

              <button
                onClick={() => {
                  if (activeTab === '2d') {
                    setView2D(prev => ({ ...prev, zoom: Math.max(5, prev.zoom * 0.8) }));
                  } else {
                    setView3D(prev => ({ ...prev, zoom: Math.max(5, prev.zoom * 0.8) }));
                  }
                }}
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>

              <button
                onClick={() => {
                  if (activeTab === '2d') {
                    setView2D({ centerX: 0, centerY: 0, zoom: 40 });
                  } else {
                    setView3D(prev => ({ ...prev, rotX: 35, rotZ: 45, zoom: 24 }));
                  }
                }}
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                title="Reset View"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {/* COORDINATE READOUT */}
            <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-gray-900/80 border border-gray-700/60 backdrop-blur-md text-[11px] font-mono text-gray-300 pointer-events-none">
              {activeTab === '2d' ? (
                mouseCoord ? (
                  <span>(x: {mouseCoord.x.toFixed(2)}, y: {mouseCoord.y.toFixed(2)})</span>
                ) : (
                  <span>Pan: ({view2D.centerX.toFixed(1)}, {view2D.centerY.toFixed(1)}) • Zoom: {view2D.zoom.toFixed(0)}px</span>
                )
              ) : (
                <span>Pitch: {view3D.rotX.toFixed(0)}° • Yaw: {view3D.rotZ.toFixed(0)}° • Zoom: {view3D.zoom.toFixed(0)}</span>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
