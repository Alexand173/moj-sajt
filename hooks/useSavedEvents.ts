import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Starred concerts for the current visitor.
 *
 * Three rules keep the star honest:
 * 1. A tap is never lost. Until the account lookup resolves, toggles are recorded
 *    as intents and replayed onto the account's list instead of being overwritten
 *    by it.
 * 2. A tap never lies. A write that fails rolls the star back and names the event
 *    rather than leaving a filled star that saved nothing.
 * 3. Guests still get a working control. Without an account, or on a database that
 *    has not run the `saved_events` migration, the list lives on this device.
 */

const SAVED_EVENTS_KEY = 'musictop:saved-events';
const FAILURE_TIMEOUT_MS = 8000;

type SavedSource = 'pending' | 'account' | 'device';

type SavedResponse = {
  authenticated: boolean;
  ids: string[];
  persisted: boolean;
};

export type SavedEventTarget = {
  id: string;
  /** Artist name; used only to say which event failed to save. */
  label?: string;
};

export type SavedEventsApi = {
  /** Ids the viewer has starred. */
  ids: Set<string>;
  /** The event a failed write named, or null. Clears itself after a few seconds. */
  failedEvent: SavedEventTarget | null;
  toggle: (target: SavedEventTarget) => void;
};

function readSavedEvents(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SAVED_EVENTS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function persistLocalSavedEvents(ids: Set<string>): void {
  try {
    window.localStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Private mode or a full quota: the star still works for this session.
  }
}

/** Replays toggles made before the account list was known on top of it. */
function applyPendingToggles(base: Set<string>, pending: Map<string, boolean>): Set<string> {
  const merged = new Set(base);
  for (const [id, shouldSave] of pending) {
    if (shouldSave) merged.add(id);
    else merged.delete(id);
  }
  pending.clear();
  return merged;
}

export function useSavedEvents(): SavedEventsApi {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [failedEvent, setFailedEvent] = useState<SavedEventTarget | null>(null);

  // Mirrors so handlers read the latest list without being rebuilt on every tap.
  const idsRef = useRef<Set<string>>(new Set());
  const sourceRef = useRef<SavedSource>('pending');
  const pendingRef = useRef<Map<string, boolean>>(new Map());

  const commit = useCallback((next: Set<string>) => {
    idsRef.current = next;
    setIds(next);
  }, []);

  /**
   * Writes the whole list to the account. `target` is present only for a direct
   * tap, which is the case that rolls back on failure; a replayed intent keeps the
   * viewer's tap and falls back to this device instead.
   */
  const writeToAccount = useCallback(async (
    next: Set<string>,
    previous: Set<string>,
    target?: SavedEventTarget,
  ) => {
    try {
      const response = await fetch('/api/saved-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(next) }),
      });

      if (!response.ok) throw new Error(`Saved events request failed with ${response.status}.`);

      const payload = (await response.json().catch(() => null)) as { persisted?: boolean } | null;

      if (payload?.persisted === false) {
        // The account exists but the column does not: keep the intent on this device.
        sourceRef.current = 'device';
        persistLocalSavedEvents(next);
      }
    } catch (error: unknown) {
      console.warn('Could not persist saved events:', error);

      if (target) {
        commit(previous);
        setFailedEvent(target);
        return;
      }

      sourceRef.current = 'device';
      persistLocalSavedEvents(next);
    }
  }, [commit]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch('/api/saved-events', {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        const payload = response.ok ? ((await response.json()) as SavedResponse) : null;
        if (controller.signal.aborted) return;

        if (payload?.authenticated && payload.persisted) {
          const accountIds = new Set(payload.ids);
          sourceRef.current = 'account';

          if (pendingRef.current.size === 0) {
            commit(accountIds);
            return;
          }

          // The taps made while this request was in flight belong on the account.
          const merged = applyPendingToggles(accountIds, pendingRef.current);
          commit(merged);
          void writeToAccount(merged, accountIds);
          return;
        }

        commit(readSavedEvents());
        sourceRef.current = 'device';
      } catch {
        if (controller.signal.aborted) return;
        commit(readSavedEvents());
        sourceRef.current = 'device';
      }
    };

    void load();
    return () => controller.abort();
  }, [commit, writeToAccount]);

  useEffect(() => {
    if (!failedEvent) return undefined;
    const timer = window.setTimeout(() => setFailedEvent(null), FAILURE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [failedEvent]);

  const toggle = useCallback((target: SavedEventTarget) => {
    const current = idsRef.current;
    const shouldSave = !current.has(target.id);
    const next = new Set(current);

    if (shouldSave) next.add(target.id);
    else next.delete(target.id);

    commit(next);
    setFailedEvent(null);

    if (sourceRef.current === 'pending') {
      // Record the intent and keep the device copy in step, so the tap survives
      // whichever answer the account lookup returns.
      pendingRef.current.set(target.id, shouldSave);
      persistLocalSavedEvents(next);
      return;
    }

    if (sourceRef.current === 'device') {
      persistLocalSavedEvents(next);
      return;
    }

    void writeToAccount(next, current, target);
  }, [commit, writeToAccount]);

  return { ids, failedEvent, toggle };
}

export default useSavedEvents;
