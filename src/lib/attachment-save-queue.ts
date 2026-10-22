// Serialize client loadout edits across screens. Matches must not use a profile
// fetched before the last attachment update has reached the server.
let settled: Promise<void> = Promise.resolve();
let lastWriteError: unknown = null;

export function enqueueAttachmentSave(work: () => Promise<void>): Promise<void> {
  const next = settled.then(async () => {
    try {
      await work();
      lastWriteError = null;
    } catch (error) {
      lastWriteError = error;
      throw error;
    }
  });
  settled = next.catch(() => {});
  return next;
}

export async function waitForAttachmentSaves(): Promise<void> {
  await settled;
  if (lastWriteError) throw lastWriteError;
}
