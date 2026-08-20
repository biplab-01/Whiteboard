// Fast and safe mathematical expression compiler for 2D (x) and 3D (x, y) equations

export type MathFunc2D = (x: number) => number;
export type MathFunc3D = (x: number, y: number) => number;

/**
 * Preprocesses a human-written math string into valid JS syntax with scoped Math functions.
 */
export function sanitizeMathExpression(expr: string): string {
  let clean = expr.trim();
  if (!clean) return 'NaN';

  clean = clean.toLowerCase();

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

  // 4. Handle implicit multiplication:
  // e.g. 2x -> 2*x, 2sin -> 2*sin, )x -> )*x, )( -> )*(, x( -> x*(, 2( -> 2*(
  clean = clean.replace(/(\d)\s*([a-zA-Z(])/g, '$1*$2');
  clean = clean.replace(/(\))\s*(\()/g, '$1*$2');
  clean = clean.replace(/(\))\s*([a-zA-Z0-9_])/g, '$1*$2');
  clean = clean.replace(/([xy])\s*(\()/g, '$1*$2');
  clean = clean.replace(/(\))\s*([xy])/g, '$1*$2');
  clean = clean.replace(/([xy])\s*([xy])/g, '$1*$2');

  return clean;
}

/**
 * Compiles a 2D math expression into an executable function (x) => number
 */
export function compileExpression2D(expression: string): { fn: MathFunc2D; error: string | null } {
  try {
    const cleanExpr = sanitizeMathExpression(expression);
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

    // Test with sample inputs
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
 * Compiles a 3D math expression into an executable function (x, y) => number
 */
export function compileExpression3D(expression: string): { fn: MathFunc3D; error: string | null } {
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
