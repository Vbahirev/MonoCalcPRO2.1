import { auth } from '@/firebase';
import { writeToArchive } from '@/services/archive.service';

/**
 * Backward compatible wrapper.
 * IMPORTANT: Call this ONLY after successful delete/save.
 */
export async function archiveDeletedData(payload: {
  scope: string;
  type: string;
  sourcePath: string;
  originalData: any;
  meta?: Record<string, any>;
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  // We store settings-related deletions in global trash
  return writeToArchive({
    scope: 'global',
    type: 'settings',
    data: payload,
    deletedBy: uid,
  });
}
