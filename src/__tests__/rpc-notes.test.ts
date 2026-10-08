/**
 * Notes over RPC (no network).
 *
 * `note_get` reads note text from `GET_NOTES` instead of clicking the Studio
 * panel. These lock the wire shape and the payload slots it reads.
 */
import { describe, it, expect } from '@jest/globals';
import { NotesRpc, parseNotes, findNote } from '../rpc/notes-rpc.js';

const NB = '11111111-2222-3333-4444-555555555555';

const META = [2, '123', [1790938310, 0], null, null, [1790938310, 0], false];
const RESULT = [
  [
    ['note-1', ['note-1', '# Heading\n\nBody text', META, [], 'Pyramid Principle']],
    ['note-2', ['note-2', 'Second note', META, [], 'Other note']],
    ['mm-1', ['mm-1', '{"name":"root","children":[]}', META, null, 'Mind Map']],
    ['deleted-1', null, 2],
  ],
  [[1791454155, 0]],
];

describe('parseNotes', () => {
  it('reads id, title and full content, skipping mind maps and deleted entries', () => {
    expect(parseNotes(RESULT)).toEqual([
      { id: 'note-1', title: 'Pyramid Principle', content: '# Heading\n\nBody text' },
      { id: 'note-2', title: 'Other note', content: 'Second note' },
    ]);
  });

  it('returns an empty list for an empty or malformed result', () => {
    expect(parseNotes(null)).toEqual([]);
    expect(parseNotes([])).toEqual([]);
    expect(parseNotes([null])).toEqual([]);
  });
});

describe('findNote', () => {
  const notes = parseNotes(RESULT);

  it('matches by id first', () => {
    expect(findNote(notes, 'Other note', 'note-1')?.id).toBe('note-1');
  });

  it('prefers an exact (case-insensitive) title over a substring match', () => {
    const list = [
      { id: 'a', title: 'Pyramid Principle notes', content: 'x' },
      { id: 'b', title: 'pyramid principle', content: 'y' },
    ];
    expect(findNote(list, 'Pyramid Principle')?.id).toBe('b');
  });

  it('falls back to a substring match, and returns undefined when nothing matches', () => {
    expect(findNote(notes, 'pyramid')?.id).toBe('note-1');
    expect(findNote(notes, 'missing')).toBeUndefined();
    expect(findNote(notes)).toBeUndefined();
  });
});

describe('NotesRpc.list', () => {
  it('calls GET_NOTES with the notebook id, scoped to the notebook', async () => {
    const calls: Array<{ method: string; params: unknown; path: string }> = [];
    const client = {
      call: async (method: string, params: unknown, path: string) => {
        calls.push({ method, params, path });
        return RESULT;
      },
    };
    const notes = await new NotesRpc(client as never).list(NB);
    expect(calls).toEqual([{ method: 'GET_NOTES', params: [NB], path: `/notebook/${NB}` }]);
    expect(notes).toHaveLength(2);
  });

  it('lets an RPC failure propagate so the caller can retry or fall back', async () => {
    const client = {
      call: async () => {
        throw new Error('UNAUTHENTICATED');
      },
    };
    await expect(new NotesRpc(client as never).list(NB)).rejects.toThrow('UNAUTHENTICATED');
  });
});
