import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { writeToArchive } from './archive.service';

/**
 * STEP 5
 * Архивация удалённых настроек калькуляторов (diff)
 * Архив пишется ТОЛЬКО после успешного save
 */
export async function archiveRemovedSettings({
  settingsDocPath,
  beforeData,
  afterData,
  currentUserId,
}) {
  const removedKeys = Object.keys(beforeData).filter(
    key => !(key in afterData)
  );

  if (!removedKeys.length) return;

  const removedData = {};
  removedKeys.forEach(k => removedData[k] = beforeData[k]);

  // 1. сохраняем новые настройки
  const ref = doc(db, ...settingsDocPath);
  await updateDoc(ref, afterData);

  // 2. архивируем удалённое
  await writeToArchive({
    scope: 'global',
    type: 'settings',
    data: removedData,
    deletedBy: currentUserId,
  });
}
