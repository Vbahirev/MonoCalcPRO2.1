import { doc } from 'firebase/firestore';
import { db } from '@/firebase';
import { softDelete } from '@/core/trash/trash.service';

export async function deleteMaterial(material) {
  return softDelete({
    type: 'material',
    docRef: doc(db, 'materials', material.id),
    meta: { title: material.name }
  });
}
