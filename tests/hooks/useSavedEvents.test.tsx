// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useSavedEvents from '@/hooks/useSavedEvents';

const STORAGE_KEY = 'musictop:saved-events';

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const GUEST = { authenticated: false, ids: [], persisted: false };
const account = (ids: string[]) => ({ authenticated: true, ids, persisted: true });

let fetchMock: ReturnType<typeof vi.fn>;

function isPost(call: unknown[]): boolean {
  return (call[1] as RequestInit | undefined)?.method === 'POST';
}

function postedIds(call: unknown[]): string[] {
  return (JSON.parse((call[1] as RequestInit).body as string) as { ids: string[] }).ids;
}

/** Lets the hook's mount request settle before a test drives the star. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useSavedEvents', () => {
  it('keeps a guest star on this device', async () => {
    fetchMock.mockResolvedValue(jsonResponse(GUEST));
    const { result } = renderHook(() => useSavedEvents());
    await settle();

    act(() => result.current.toggle({ id: 'evt-1', label: 'Aitana' }));

    expect(result.current.ids.has('evt-1')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(['evt-1']);
    expect(fetchMock.mock.calls.some(isPost)).toBe(false);
  });

  it('replays a tap made while the account lookup is in flight', async () => {
    let resolveLookup: (value: Response) => void = () => {};
    const lookup = new Promise<Response>((resolve) => { resolveLookup = resolve; });

    fetchMock.mockImplementation((_input: unknown, init?: RequestInit) => (
      init?.method === 'POST'
        ? Promise.resolve(jsonResponse(account([])))
        : lookup
    ));

    const { result } = renderHook(() => useSavedEvents());
    act(() => result.current.toggle({ id: 'evt-9', label: 'Aitana' }));
    expect(result.current.ids.has('evt-9')).toBe(true);

    await act(async () => {
      resolveLookup(jsonResponse(account([])));
      await lookup;
    });

    // The account answered with an empty list; the tap must still be there.
    await waitFor(() => expect(result.current.ids.has('evt-9')).toBe(true));
    const post = fetchMock.mock.calls.find(isPost);
    expect(post).toBeDefined();
    expect(postedIds(post as unknown[])).toEqual(['evt-9']);
  });

  it('rolls the star back and names the event when the write fails', async () => {
    fetchMock.mockImplementation((_input: unknown, init?: RequestInit) => (
      init?.method === 'POST'
        ? Promise.resolve(jsonResponse({ error: 'unavailable' }, 503))
        : Promise.resolve(jsonResponse(account([])))
    ));

    const { result } = renderHook(() => useSavedEvents());
    await settle();

    act(() => result.current.toggle({ id: 'evt-2', label: 'Kate Bush' }));
    expect(result.current.ids.has('evt-2')).toBe(true);

    await waitFor(() => expect(result.current.failedEvent?.label).toBe('Kate Bush'));
    expect(result.current.ids.has('evt-2')).toBe(false);
  });

  it('keeps a replayed tap on the device when that write fails', async () => {
    let resolveLookup: (value: Response) => void = () => {};
    const lookup = new Promise<Response>((resolve) => { resolveLookup = resolve; });

    fetchMock.mockImplementation((_input: unknown, init?: RequestInit) => (
      init?.method === 'POST'
        ? Promise.resolve(jsonResponse({ error: 'unavailable' }, 503))
        : lookup
    ));

    const { result } = renderHook(() => useSavedEvents());
    act(() => result.current.toggle({ id: 'evt-7', label: 'Aitana' }));

    await act(async () => {
      resolveLookup(jsonResponse(account([])));
      await lookup;
    });

    // No second guess: the viewer's tap stands, saved on this device instead.
    await waitFor(() => expect(fetchMock.mock.calls.some(isPost)).toBe(true));
    expect(result.current.ids.has('evt-7')).toBe(true);
    expect(result.current.failedEvent).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(['evt-7']);
  });

  it('falls back to this device when the lookup rejects', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['evt-3']));
    fetchMock.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useSavedEvents());
    await waitFor(() => expect(result.current.ids.has('evt-3')).toBe(true));
  });
});
