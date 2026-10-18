import { snap, type DraftBlock, type DraftKind, type EditAction, type EditorTool } from '../core/editor';
import { distance, type Vec2 } from '../core/math';
import type { Renderer } from '../presentation/renderer';

/** A drag shorter than this is a tap. */
const DRAG = 8;
/** A tapped charge zone: its size, centred on the tap. */
const TAP_ZONE = { w: 120, h: 50 };
/** A tapped block: its size, centred on the tap. */
const TAP_BLOCK = 40;

/** A block for a tap: protected buildings are concrete, everything else timber. */
export const blockAt = (kind: DraftKind, at: Vec2): DraftBlock => ({
  kind,
  material: kind === 'protected' ? 'concrete' : 'wood',
  x: snap(at.x - TAP_BLOCK / 2),
  y: snap(at.y - TAP_BLOCK / 2),
  w: TAP_BLOCK,
  h: TAP_BLOCK,
});

/** Taps and drags on the field while a mission is being built. */
export class EditorInput {
  private down: Vec2 | undefined;

  constructor(
    canvas: HTMLCanvasElement,
    renderer: Renderer,
    private readonly tool: () => EditorTool,
    private readonly apply: (action: EditAction) => void,
  ) {
    canvas.addEventListener('pointerdown', (e) => {
      this.down = renderer.toWorld(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', (e) => {
      const start = this.down;
      this.down = undefined;
      if (!start) return;
      const end = renderer.toWorld(e.clientX, e.clientY);
      const t = this.tool();
      if (t === 'remove') return this.apply({ type: 'remove', at: end });
      if (t === 'zone') {
        if (distance(start, end) < DRAG) {
          return this.apply({ type: 'zone', rect: { x: snap(end.x - TAP_ZONE.w / 2), y: snap(end.y - TAP_ZONE.h / 2), ...TAP_ZONE } });
        }
        return this.apply({
          type: 'zone',
          rect: {
            x: snap(Math.min(start.x, end.x)),
            y: snap(Math.min(start.y, end.y)),
            w: snap(Math.abs(end.x - start.x)),
            h: snap(Math.abs(end.y - start.y)),
          },
        });
      }
      this.apply({ type: 'block', kind: t, at: end });
    });
  }
}
