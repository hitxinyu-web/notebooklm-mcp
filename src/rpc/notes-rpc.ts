/**
 * Notes over the internal RPC API (read-only).
 *
 * `GET_NOTES` (shared id with `LIST_MIND_MAPS`) returns every note and mind map
 * of a notebook in one call, full text included — no Studio panel to open, no
 * note editor to click. Verified live payload shape:
 *   `[[[noteId, [noteId, content, meta, citations, title, richContent…]], …], [timestamp]]`
 * A deleted entry carries no payload array at slot 1. Mind maps share the list;
 * their content is a JSON document rather than text.
 */

import { BatchExecuteClient } from './batchexecute.js';

export interface RpcNote {
  id: string;
  title: string;
  content: string;
}

/** True when `content` is a mind map's JSON document rather than note text. */
function isMindMapContent(content: string): boolean {
  if (!/^\s*\{/.test(content)) return false;
  try {
    const parsed: unknown = JSON.parse(content);
    return !!parsed && typeof parsed === 'object';
  } catch {
    return false;
  }
}

/** Parse a `GET_NOTES` result into notes, dropping deleted entries and mind maps. Pure. */
export function parseNotes(result: unknown): RpcNote[] {
  const items = Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as unknown[]) : [];
  const notes: RpcNote[] = [];
  for (const item of items) {
    if (!Array.isArray(item) || !Array.isArray(item[1])) continue;
    const payload = item[1] as unknown[];
    const id = typeof item[0] === 'string' ? item[0] : String(payload[0] ?? '');
    const content = typeof payload[1] === 'string' ? payload[1] : '';
    const title = typeof payload[4] === 'string' ? payload[4] : '';
    if (isMindMapContent(content)) continue;
    notes.push({ id, title, content });
  }
  return notes;
}

/**
 * Pick a note by id, then by exact title, then by title substring
 * (all case-insensitive on the title). Returns undefined when nothing matches.
 */
export function findNote(
  notes: RpcNote[],
  noteTitle?: string,
  noteId?: string
): RpcNote | undefined {
  if (noteId) {
    const byId = notes.find((n) => n.id === noteId);
    if (byId) return byId;
  }
  if (!noteTitle) return undefined;
  const needle = noteTitle.trim().toLowerCase();
  if (!needle) return undefined;
  return (
    notes.find((n) => n.title.trim().toLowerCase() === needle) ||
    notes.find((n) => n.title.toLowerCase().includes(needle))
  );
}

export class NotesRpc {
  constructor(private readonly client: BatchExecuteClient) {}

  /** List the notebook's notes (mind maps excluded) with their full text. */
  async list(notebookId: string): Promise<RpcNote[]> {
    const result = await this.client.call('GET_NOTES', [notebookId], `/notebook/${notebookId}`);
    return parseNotes(result);
  }
}
