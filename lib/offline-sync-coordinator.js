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
    do {
      entry.rerun = false;
      const currentWorker = entry.worker;
      await currentWorker();
    } while (entry.rerun);
  })();
  activeRuns.set(ownerId, entry);
  try {
    await entry.promise;
  } finally {
    if (activeRuns.get(ownerId) === entry) activeRuns.delete(ownerId);
  }
}
