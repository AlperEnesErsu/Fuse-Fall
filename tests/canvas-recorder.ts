/** A stand-in canvas that records every coordinate drawn to, so a test can ask how far a drawing reaches. */
export const recorder = () => {
  const xs: number[] = [];
  const ys: number[] = [];
  let calls = 0;
  /** Inside a clip the canvas cuts strokes off at the clip's edge; what is drawn there is bounded by the clip itself. */
  let clipped = false;
  /** translate() moves what follows; save() and restore() keep and bring back the offset and the clip. */
  let tx = 0;
  let ty = 0;
  const stack: { tx: number; ty: number; clipped: boolean }[] = [];
  const point = (x: number, y: number) => {
    if (clipped) return;
    xs.push(x + tx);
    ys.push(y + ty);
  };
  const ctx = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === 'fillRect' || name === 'rect')
          return (x: number, y: number, w: number, h: number) => {
            calls++;
            point(x, y);
            point(x + w, y + h);
          };
        if (name === 'moveTo' || name === 'lineTo')
          return (x: number, y: number) => {
            calls++;
            point(x, y);
          };
        if (name === 'quadraticCurveTo')
          return (_cx: number, _cy: number, x: number, y: number) => {
            calls++;
            point(x, y);
          };
        if (name === 'arc' || name === 'ellipse')
          return (x: number, y: number, r: number, r2?: number) => {
            calls++;
            point(x - r, y - (name === 'ellipse' ? (r2 ?? r) : r));
            point(x + r, y + (name === 'ellipse' ? (r2 ?? r) : r));
          };
        if (name === 'clip') return () => (clipped = true);
        if (name === 'save') return () => stack.push({ tx, ty, clipped });
        if (name === 'restore')
          return () => {
            const top = stack.pop();
            if (top) ({ tx, ty, clipped } = top);
          };
        if (name === 'translate')
          return (x: number, y: number) => {
            tx += x;
            ty += y;
          };
        return () => undefined;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls: () => calls, minX: () => Math.min(...xs), maxX: () => Math.max(...xs), minY: () => Math.min(...ys), maxY: () => Math.max(...ys) };
};
