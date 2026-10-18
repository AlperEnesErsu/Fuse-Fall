import { parseLevel, type LevelDefinition } from './level';
import { err, ok, type Result } from './result';

/**
 * A mission as a short text code: the level, deflated and base64url-encoded.
 * Pasting a code is untrusted input, so decoding is bounded (length and
 * decompressed size) and the level must pass the same validation as shipped data.
 */

const PREFIX = 'FF1-';
/** Longest code accepted (characters). A mission with a few dozen blocks is well under this. */
const MAX_CODE = 12_000;
/** Largest decompressed level (bytes): a zip-bomb stops here. */
const MAX_JSON = 48_000;
/** Shared missions carry this id: they never touch a campaign mission's stars. */
export const SHARED_ID = 'shared';

export type ShareError = 'format' | 'too-large' | 'invalid-level' | 'not-editable';

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array | undefined => {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return undefined;
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
};

const deflate = async (data: Uint8Array): Promise<Uint8Array> => {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw')));
  return new Uint8Array(await out.arrayBuffer());
};

/** Inflates with a hard cap on the output: a few bytes of compressed data cannot expand without limit. */
const inflate = async (data: Uint8Array): Promise<Result<Uint8Array, ShareError>> => {
  const reader = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JSON) {
        await reader.cancel();
        return err('too-large');
      }
      chunks.push(value);
    }
  } catch {
    return err('format');
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return ok(out);
};

/** The code for a mission. The id is replaced, so the receiver's progress is never touched. */
export const encodeLevel = async (level: LevelDefinition): Promise<string> => {
  const json = new TextEncoder().encode(JSON.stringify({ ...level, id: SHARED_ID }));
  return PREFIX + toBase64Url(await deflate(json));
};

/** A mission from a pasted code, validated like any shipped level. */
export const decodeLevel = async (code: string): Promise<Result<LevelDefinition, ShareError>> => {
  const text = code.trim();
  if (text.length > MAX_CODE) return err('too-large');
  if (!text.startsWith(PREFIX)) return err('format');
  const bytes = fromBase64Url(text.slice(PREFIX.length));
  if (!bytes) return err('format');
  const json = await inflate(bytes);
  if (!json.ok) return json;
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(json.value));
  } catch {
    return err('format');
  }
  const level = parseLevel(raw);
  return level.ok ? ok(level.value) : err('invalid-level');
};
