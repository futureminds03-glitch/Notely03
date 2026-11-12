const activeRuns = new Map();

/**
 * Serialize durable sync work for one account across mounted Notely surfaces.
 * A trigger received during a run replaces the queued pass with the latest worker.
 */
export async function runOwnerSync(ownerId, worker) {
  if (!ownerId || typeof worker !== 'function') return;
  const existing = activeRuns.get(ownerId);
  if (existing) {
    existing.worker = worker;
    existing.rerun = true;
    await existing.promise;
    return;
  }

  const entry = { worker, rerun: false, promise: null };
  entry.promise = (async () => {
    try {
      while (true) {
        entry.rerun = false;
        await Promise.resolve().then(() => entry.worker());
        if (!entry.rerun) break;
      }
    } finally {
      // Delete in the same turn as the final pass so a new trigger cannot be lost
      // between the loop's final check and lock release.
      if (activeRuns.get(ownerId) === entry) activeRuns.delete(ownerId);
    }
  })();
  activeRuns.set(ownerId, entry);
  await entry.promise;
}
