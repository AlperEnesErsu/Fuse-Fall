/**
 * Records a replay as a short vertical clip for sharing (Shorts, Reels, TikTok).
 * The landscape game canvas is framed inside a 9:16 card with the title on top
 * and the verdict stamped below once the dust settles. Recording happens on the
 * device; nothing is uploaded.
 */

export interface ClipCaption {
  /** Mission line, e.g. "Ankara 05 · Concrete Frame". */
  readonly title: string;
  /** The verdict stamp, e.g. "CLEAN DEMOLITION · 100%". */
  readonly stamp: string;
  /** Stamp colour: green for a win, red for a failed job. */
  readonly tone: 'win' | 'fail';
}

const STAMP_COLOURS = { win: '#4cb36a', fail: '#e5484d' } as const;

const WIDTH = 720;
const HEIGHT = 1280;
const FPS = 30;
/** The stamp lands this long after recording starts, when the collapse is under way. */
const STAMP_AT_MS = 2600;
/** The widest picture kept in the clip (width / height): the middle of a landscape world, where structures stand. */
const MAX_ASPECT = 1.14;
/** Layout of the card: title, mission line, then the game frame. */
const TITLE_Y = 190;
const SUBTITLE_Y = 250;
const FRAME_TOP = 330;

/** Containers in order of preference: MP4 plays everywhere; WebM is the fallback. */
const MIME_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];

export class ClipRecorder {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly chunks: Blob[] = [];
  private recorder: MediaRecorder | undefined;
  private frame = 0;
  private startedAt = 0;
  readonly mimeType: string;

  static supported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
      MIME_TYPES.some((t) => MediaRecorder.isTypeSupported(t))
    );
  }

  constructor(
    private readonly source: HTMLCanvasElement,
    private readonly caption: ClipCaption,
    /** The part of the source canvas showing the world (the renderer knows; portrait frames differ). */
    private readonly frameOf: () => { readonly sx: number; readonly sy: number; readonly sw: number; readonly sh: number },
  ) {
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = this.canvas.getContext('2d');
    this.mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
  }

  /** File extension matching the recorded container. */
  get extension(): string {
    return this.mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
  }

  /** Starts composing frames and recording; `audio` mixes the game's sound into the clip. */
  start(audio: MediaStream | undefined): void {
    const stream = this.canvas.captureStream(FPS);
    // Clones, so stopping the clip's tracks leaves the game's own audio tap running.
    for (const track of audio?.getAudioTracks() ?? []) stream.addTrack(track.clone());
    this.recorder = new MediaRecorder(stream, { mimeType: this.mimeType, videoBitsPerSecond: 4_000_000 });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.startedAt = performance.now();
    this.recorder.start(250);
    const tick = () => {
      this.compose(performance.now() - this.startedAt);
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Stops recording; resolves with the clip, or undefined if nothing was recorded. */
  stop(): Promise<Blob | undefined> {
    cancelAnimationFrame(this.frame);
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(undefined);
    return new Promise((resolve) => {
      recorder.onstop = () => {
        for (const track of recorder.stream.getTracks()) track.stop();
        resolve(this.chunks.length > 0 ? new Blob(this.chunks, { type: this.mimeType }) : undefined);
      };
      recorder.stop();
    });
  }

  private compose(elapsed: number): void {
    const c = this.ctx;
    if (!c) return;
    const bg = c.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#0f1114');
    bg.addColorStop(0.5, '#1a1d22');
    bg.addColorStop(1, '#0f1114');
    c.fillStyle = bg;
    c.fillRect(0, 0, WIDTH, HEIGHT);

    // The game: the framed world, narrowed to its middle when it is wide, scaled to the full width.
    const src = this.source;
    const frame = this.frameOf();
    const crop = Math.min(frame.sw, frame.sh * MAX_ASPECT);
    const cropH = frame.sh;
    const sx = frame.sx + (frame.sw - crop) / 2;
    const sy = frame.sy;
    const h = (WIDTH * cropH) / crop;
    const top = FRAME_TOP;
    if (src.width > 0 && src.height > 0) c.drawImage(src, sx, sy, crop, cropH, 0, top, WIDTH, h);
    hazard(c, top - 14);
    hazard(c, top + h + 4);

    // Title.
    c.textAlign = 'center';
    c.fillStyle = '#ebe8e2';
    c.font = '800 76px Bahnschrift, "Arial Narrow", system-ui, sans-serif';
    c.fillText('FUSE', WIDTH / 2 - 150, TITLE_Y);
    c.fillText('FALL', WIDTH / 2 + 150, TITLE_Y);
    c.fillStyle = '#f2b134';
    c.fillText('&', WIDTH / 2, TITLE_Y);
    c.fillStyle = '#8d939c';
    c.font = '600 30px "Segoe UI", system-ui, sans-serif';
    c.fillText(this.caption.title, WIDTH / 2, SUBTITLE_Y);

    // The verdict stamp, slammed in once the collapse is under way.
    if (elapsed >= STAMP_AT_MS) {
      const t = Math.min(1, (elapsed - STAMP_AT_MS) / 180);
      const scale = 1.6 - 0.6 * t;
      const colour = STAMP_COLOURS[this.caption.tone];
      c.save();
      c.translate(WIDTH / 2, Math.min(HEIGHT - 110, top + h + 160));
      c.rotate(-0.07);
      c.scale(scale, scale);
      c.globalAlpha = t;
      c.font = '800 54px Bahnschrift, "Arial Narrow", system-ui, sans-serif';
      const width = c.measureText(this.caption.stamp).width + 48;
      c.strokeStyle = colour;
      c.lineWidth = 6;
      c.strokeRect(-width / 2, -46, width, 92);
      c.fillStyle = colour;
      c.textBaseline = 'middle';
      c.fillText(this.caption.stamp, 0, 4);
      c.restore();
    }
  }
}

/** A thin hazard-tape band across the card. */
const hazard = (c: CanvasRenderingContext2D, y: number): void => {
  c.save();
  c.beginPath();
  c.rect(0, y, WIDTH, 10);
  c.clip();
  c.fillStyle = '#f2b134';
  c.fillRect(0, y, WIDTH, 10);
  c.fillStyle = '#1a1408';
  for (let x = -20; x < WIDTH + 20; x += 28) {
    c.beginPath();
    c.moveTo(x, y + 10);
    c.lineTo(x + 10, y);
    c.lineTo(x + 20, y);
    c.lineTo(x + 10, y + 10);
    c.fill();
  }
  c.restore();
};
