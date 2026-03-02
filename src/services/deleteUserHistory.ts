import { doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { writeToArchive } from './archive.service';

/**
 * STEP 4
 * Удаление истории пользователя с архивированием
 */
export async function deleteUserHistory({
  userId,
  historyId,
  historyData,
  currentUserId,
}) {
  const ref = doc(db, 'users', userId, 'history', historyId);

  await deleteDoc(ref);

  await writeToArchive({
    scope: 'user',
    userId,
    type: 'history',
    data: {
      historyId,
      ...historyData,
    },
    deletedBy: currentUserId,
  });
}
