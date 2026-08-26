// Fast and safe mathematical expression compiler for 2D (x, y) and 3D (x, y, z) explicit & implicit equations

export type MathFunc2D = (x: number) => number;
export type MathFunc3D = (x: number, y: number) => number;
export type ImplicitFunc2D = (x: number, y: number) => number;
export type ImplicitFunc3D = (x: number, y: number, z: number) => number;

/**
 * Preprocesses a human-written math string into valid JS syntax with scoped Math functions.
 */
export function sanitizeMathExpression(expr: string): string {
  let clean = expr.trim();
  if (!clean) return 'NaN';

  clean = clean.toLowerCase();

  // Handle "=" if present: e.g., "x^2 + y^2 = 25" -> "(x^2 + y^2) - (25)"
  if (clean.includes('=')) {
    const parts = clean.split('=');
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      clean = `(${parts[0].trim()}) - (${parts[1].trim()})`;
    }
  }

  // 1. Replace π with pi
  clean = clean.replace(/π/g, 'pi');

  // 2. Handle functions without parentheses: e.g. logx -> log(x), sinx -> sin(x), cosx -> cos(x), lnx -> ln(x), sqrtx -> sqrt(x), absx -> abs(x)
  const fnList = [
    'asin', 'acos', 'atan2', 'atan',
    'sinh', 'cosh', 'tanh',
    'sin', 'cos', 'tan',
    'sqrt', 'cbrt', 'abs',
    'exp', 'floor', 'ceil', 'round',
    'log10', 'log2', 'log', 'ln'
  ];

  for (const fn of fnList) {
    const noParenRegex = new RegExp(`\\b${fn}\\s*([a-zA-Z0-9_.]+)`, 'g');
    clean = clean.replace(noParenRegex, (match, param) => {
      if (match.includes('(')) return match;
      return `${fn}(${param})`;
    });
  }

  // 3. Power operator: ^ -> **
  clean = clean.replace(/\^/g, '**');

  // 4. Handle implicit multiplication (x, y, z):
  clean = clean.replace(/(\d)\s*([a-zA-Z(])/g, '$1*$2');
  clean = clean.replace(/(\))\s*(\()/g, '$1*$2');
  clean = clean.replace(/(\))\s*([a-zA-Z0-9_])/g, '$1*$2');
  clean = clean.replace(/([xyz])\s*(\()/g, '$1*$2');
  clean = clean.replace(/(\))\s*([xyz])/g, '$1*$2');
  clean = clean.replace(/([xyz])\s*([xyz])/g, '$1*$2');

  return clean;
}

/**
 * Checks whether a 2D math formula is an implicit equation (contains '=' with y or uses y as independent variable)
 */
export function isImplicitExpression2D(expr: string): boolean {
  const trimmed = expr.trim().toLowerCase();
  if (!trimmed) return false;

  if (trimmed.includes('=')) {
    const parts = trimmed.split('=');
    if (parts.length === 2) {
      const lhs = parts[0].trim();
      const rhs = parts[1].trim();
      if (lhs === 'y' && !rhs.includes('y')) {
        return false; // Explicit y = f(x)
      }
      return true;
    }
  }

  // Check if expression contains variable 'y'
  return /\by\b/.test(trimmed) || /[^a-z]y[^a-z]|^y[^a-z]|[^a-z]y$|^y$/.test(trimmed);
}

/**
 * Checks whether a 3D math formula is an implicit equation (contains '=' with z or uses z as variable)
 */
export function isImplicitExpression3D(expr: string): boolean {
  const trimmed = expr.trim().toLowerCase();
  if (!trimmed) return false;

  if (trimmed.includes('=')) {
    const parts = trimmed.split('=');
    if (parts.length === 2) {
      const lhs = parts[0].trim();
      const rhs = parts[1].trim();
      if (lhs === 'z' && !rhs.includes('z')) {
        return false; // Explicit z = f(x, y)
      }
      return true;
    }
  }

  // Check if expression contains variable 'z'
  return /\bz\b/.test(trimmed) || /[^a-z]z[^a-z]|^z[^a-z]|[^a-z]z$|^z$/.test(trimmed);
}

/**
 * Compiles an explicit 2D math expression into an executable function (x) => number
 */
export function compileExpression2D(expression: string): { fn: MathFunc2D; error: string | null } {
  try {
    let cleanRaw = expression.trim();
    if (cleanRaw.toLowerCase().startsWith('y=')) {
      cleanRaw = cleanRaw.substring(2);
    } else if (cleanRaw.toLowerCase().startsWith('y =')) {
      cleanRaw = cleanRaw.substring(3);
    }

    const cleanExpr = sanitizeMathExpression(cleanRaw);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const innerFn = new Function('x', 'Math', `
      const sin = Math.sin;
      const cos = Math.cos;
      const tan = Math.tan;
      const asin = Math.asin;
      const acos = Math.acos;
      const atan = Math.atan;
      const sinh = Math.sinh;
      const cosh = Math.cosh;
      const tanh = Math.tanh;
      const sqrt = Math.sqrt;
      const cbrt = Math.cbrt;
      const abs = Math.abs;
      const exp = Math.exp;
      const log = Math.log10;
      const log10 = Math.log10;
      const log2 = Math.log2;
      const ln = Math.log;
      const pi = Math.PI;
      const e = Math.E;
      const floor = Math.floor;
      const ceil = Math.ceil;
      const round = Math.round;
      try {
        const res = (${cleanExpr});
        return typeof res === 'number' && !isNaN(res) ? res : NaN;
      } catch(e) {
        return NaN;
      }
    `);

    const fn: MathFunc2D = (x: number) => {
      try {
        return innerFn(x, Math);
      } catch {
        return NaN;
      }
    };

    fn(1);
    return { fn, error: null };
  } catch (err: any) {
    return {
      fn: () => NaN,
      error: err?.message || 'Invalid formula expression'
    };
  }
}

/**
 * Compiles an implicit 2D math expression into F(x, y) = 0 function (x, y) => number
 */
export function compileImplicit2D(expression: string): { fn: ImplicitFunc2D; error: string | null; isImplicit: boolean } {
  const isImplicit = isImplicitExpression2D(expression);
  try {
    const cleanExpr = sanitizeMathExpression(expression);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const innerFn = new Function('x', 'y', 'Math', `
      const sin = Math.sin;
      const cos = Math.cos;
      const tan = Math.tan;
      const asin = Math.asin;
      const acos = Math.acos;
      const atan = Math.atan;
      const sinh = Math.sinh;
      const cosh = Math.cosh;
      const tanh = Math.tanh;
      const sqrt = Math.sqrt;
      const cbrt = Math.cbrt;
      const abs = Math.abs;
      const exp = Math.exp;
      const log = Math.log10;
      const log10 = Math.log10;
      const log2 = Math.log2;
      const ln = Math.log;
      const pi = Math.PI;
      const e = Math.E;
      const floor = Math.floor;
      const ceil = Math.ceil;
      const round = Math.round;
      try {
        const res = (${cleanExpr});
        return typeof res === 'number' && !isNaN(res) ? res : NaN;
      } catch(e) {
        return NaN;
      }
    `);

    const fn: ImplicitFunc2D = (x: number, y: number) => {
      try {
        return innerFn(x, y, Math);
      } catch {
        return NaN;
      }
    };

    fn(1, 1);
    return { fn, error: null, isImplicit };
  } catch (err: any) {
    return {
      fn: () => NaN,
      error: err?.message || 'Invalid formula expression',
      isImplicit
    };
  }
}

/**
 * Compiles an explicit 3D math expression into an executable function (x, y) => number
 */
export function compileExpression3D(expression: string): { fn: MathFunc3D; error: string | null } {
  try {
    let cleanRaw = expression.trim();
    if (cleanRaw.toLowerCase().startsWith('z=')) {
      cleanRaw = cleanRaw.substring(2);
    } else if (cleanRaw.toLowerCase().startsWith('z =')) {
      cleanRaw = cleanRaw.substring(3);
    }

    const cleanExpr = sanitizeMathExpression(cleanRaw);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const innerFn = new Function('x', 'y', 'Math', `
      const sin = Math.sin;
      const cos = Math.cos;
      const tan = Math.tan;
      const asin = Math.asin;
      const acos = Math.acos;
      const atan = Math.atan;
      const sinh = Math.sinh;
      const cosh = Math.cosh;
      const tanh = Math.tanh;
      const sqrt = Math.sqrt;
      const cbrt = Math.cbrt;
      const abs = Math.abs;
      const exp = Math.exp;
      const log = Math.log10;
      const log10 = Math.log10;
      const log2 = Math.log2;
      const ln = Math.log;
      const pi = Math.PI;
      const e = Math.E;
      const floor = Math.floor;
      const ceil = Math.ceil;
      const round = Math.round;
      try {
        const res = (${cleanExpr});
        return typeof res === 'number' && !isNaN(res) ? res : NaN;
      } catch(e) {
        return NaN;
      }
    `);

    const fn: MathFunc3D = (x: number, y: number) => {
      try {
        return innerFn(x, y, Math);
      } catch {
        return NaN;
      }
    };

    fn(1, 1);
    return { fn, error: null };
  } catch (err: any) {
    return {
      fn: () => NaN,
      error: err?.message || 'Invalid 3D formula expression'
    };
  }
}

/**
 * Compiles an implicit 3D math expression into F(x, y, z) = 0 function (x, y, z) => number
 */
export function compileImplicit3D(expression: string): { fn: ImplicitFunc3D; error: string | null; isImplicit: boolean } {
  const isImplicit = isImplicitExpression3D(expression);
  try {
    const cleanExpr = sanitizeMathExpression(expression);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const innerFn = new Function('x', 'y', 'z', 'Math', `
      const sin = Math.sin;
      const cos = Math.cos;
      const tan = Math.tan;
      const asin = Math.asin;
      const acos = Math.acos;
      const atan = Math.atan;
      const sinh = Math.sinh;
      const cosh = Math.cosh;
      const tanh = Math.tanh;
      const sqrt = Math.sqrt;
      const cbrt = Math.cbrt;
      const abs = Math.abs;
      const exp = Math.exp;
      const log = Math.log10;
      const log10 = Math.log10;
      const log2 = Math.log2;
      const ln = Math.log;
      const pi = Math.PI;
      const e = Math.E;
      const floor = Math.floor;
      const ceil = Math.ceil;
      const round = Math.round;
      try {
        const res = (${cleanExpr});
        return typeof res === 'number' && !isNaN(res) ? res : NaN;
      } catch(e) {
        return NaN;
      }
    `);

    const fn: ImplicitFunc3D = (x: number, y: number, z: number) => {
      try {
        return innerFn(x, y, z, Math);
      } catch {
        return NaN;
      }
    };

    fn(1, 1, 1);
    return { fn, error: null, isImplicit };
  } catch (err: any) {
    return {
      fn: () => NaN,
      error: err?.message || 'Invalid 3D implicit formula expression',
      isImplicit
    };
  }
}
