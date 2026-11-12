const activeRuns = new Map();
const rerunRequested = new Set();

/**
 * Serialize all durable sync work for one account across mounted Notely surfaces.
 * A trigger received during a run schedules one fresh pass instead of being lost.
 */
export async function runOwnerSync(ownerId, worker) {
  if (!ownerId || typeof worker !== 'function') return;
  const current = activeRuns.get(ownerId);
  if (current) {
    rerunRequested.add(ownerId);
    await current;
    return;
  }

  const run = (async () => {
    do {
      rerunRequested.delete(ownerId);
      await worker();
    } while (rerunRequested.has(ownerId));
  })();
  activeRuns.set(ownerId, run);
  try {
    await run;
  } finally {
    if (activeRuns.get(ownerId) === run) activeRuns.delete(ownerId);
    rerunRequested.delete(ownerId);
  }
}
