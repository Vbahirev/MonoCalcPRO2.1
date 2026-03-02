import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { writeToArchive } from '@/services/archive.service';

/**
 * Удаление материала лазера с архивированием
 * Принцип: сначала успешный updateDoc, затем запись в архив.
 */
export async function removeLaserMaterial(material: any) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  // 1) СНАЧАЛА удаляем из настроек
  await updateDoc(doc(db, 'settings', 'global_config'), {
    materials: arrayRemove(material),
  });

  // 2) ПОТОМ архивируем (глобальный архив)
  await writeToArchive({
    scope: 'global',
    type: 'settings',
    data: {
      scope: 'settings.laser',
      action: 'remove_material',
      sourcePath: 'settings/global_config',
      originalData: material,
    },
    deletedBy: uid,
  });
}
