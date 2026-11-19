import { parseChallenge, type Challenge } from './challenge';
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

/**
 * The code inside whatever was pasted or opened: a bare code, a link to the game
 * (`https://…/#FF1-…`) or a message with the code in it. Undefined when there is none.
 */
export const codeIn = (text: string): string | undefined => {
  const at = text.indexOf(PREFIX);
  if (at < 0) return undefined;
  const body = /^[A-Za-z0-9_-]*/.exec(text.slice(at + PREFIX.length))?.[0] ?? '';
  return PREFIX + body;
};

/** A link that opens the mission in the web game: the code rides in the fragment, which no server sees. */
export const missionLink = (base: string, code: string): string => `${base.split('#')[0]}#${code}`;

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

/**
 * The code for a mission. The id is replaced, so the receiver's progress is never touched.
 * `challenge`, when given, is the sender's result to beat. It rides as one more field, which a
 * build that does not know it simply ignores: old codes open in new builds and new in old.
 */
export const encodeLevel = async (level: LevelDefinition, challenge?: Challenge): Promise<string> => {
  // The campaign's third-star goal and seed stay with the campaign: a shared copy is played, never booked.
  const { mastery: _goal, seed: _seed, ...plays } = level;
  void _goal;
  void _seed;
  const json = new TextEncoder().encode(JSON.stringify({ ...plays, id: SHARED_ID, ...(challenge ? { challenge } : {}) }));
  return PREFIX + toBase64Url(await deflate(json));
};

/** A mission and, if the code carries one, the result to beat. */
export interface SharedMission {
  readonly level: LevelDefinition;
  readonly challenge: Challenge | undefined;
}

/** A mission from a pasted code, validated like any shipped level. */
export const decodeLevel = async (code: string): Promise<Result<LevelDefinition, ShareError>> => {
  const shared = await decodeShared(code);
  return shared.ok ? ok(shared.value.level) : shared;
};

/** A pasted code's mission and its challenge. A challenge that does not make sense is dropped, not fatal. */
export const decodeShared = async (code: string): Promise<Result<SharedMission, ShareError>> => {
  if (code.length > MAX_CODE * 2) return err('too-large');
  const text = codeIn(code);
  if (text === undefined) return err('format');
  if (text.length > MAX_CODE) return err('too-large');
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
  if (!level.ok) return err('invalid-level');
  const challenge = typeof raw === 'object' && raw !== null ? parseChallenge((raw as { challenge?: unknown }).challenge, level.value.charges.max) : undefined;
  return ok({ level: level.value, challenge });
};
