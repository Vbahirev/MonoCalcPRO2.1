import {
  collection,
  getDocs,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * STEP 9
 * Очистка архива без TTL
 * Удаляет записи, у которых restoreUntil < now
 * Запускать при входе в архив или по расписанию
 */
export async function cleanupArchive({
  scope,
  userId,
}: {
  scope: 'user' | 'global';
  userId?: string;
}) {
  const now = Timestamp.now();

  const col =
    scope === 'user'
      ? collection(db, 'users', userId!, 'trash')
      : collection(db, 'trash');

  const q = query(col, where('restoreUntil', '<', now));
  const snap = await getDocs(q);

  for (const docSnap of snap.docs) {
    await deleteDoc(docSnap.ref);
  }
}
