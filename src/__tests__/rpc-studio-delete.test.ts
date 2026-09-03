/**
 * Studio artifact deletion (no network).
 *
 * `DELETE_STUDIO` sat in the id table unused since v3 — content could be
 * generated and listed but never removed. These lock the wire shape, which is
 * single-id only (batch forms were probed against the live server and refused).
 */
import { describe, it, expect } from '@jest/globals';
import { StudioRpc } from '../rpc/studio-rpc.js';

function rpcReturning(result: unknown) {
  const calls: Array<{ method: string; params: unknown; path: string }> = [];
  const client = {
    call: async (method: string, params: unknown, path: string) => {
      calls.push({ method, params, path });
      return result;
    },
  };
  return { studio: new StudioRpc(client as never), calls };
}

const NB = '11111111-2222-3333-4444-555555555555';

describe('StudioRpc.deleteArtifact', () => {
  it('sends a single id, scoped to the notebook', async () => {
    const { studio, calls } = rpcReturning(null);
    await studio.deleteArtifact(NB, 'artifact-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('DELETE_STUDIO');
    expect(calls[0].params).toEqual([[2], 'artifact-1']);
    expect(calls[0].path).toBe(`/notebook/${NB}`);
  });

  it('treats a null result as success, because that is what the server returns', async () => {
    const { studio } = rpcReturning(null);
    await expect(studio.deleteArtifact(NB, 'artifact-1')).resolves.toBeUndefined();
  });

  it('lets a real failure propagate rather than reporting a deletion that did not happen', async () => {
    const client = {
      call: async () => {
        throw new Error('PERMISSION_DENIED');
      },
    };
    await expect(new StudioRpc(client as never).deleteArtifact(NB, 'a')).rejects.toThrow(
      'PERMISSION_DENIED'
    );
  });
});
