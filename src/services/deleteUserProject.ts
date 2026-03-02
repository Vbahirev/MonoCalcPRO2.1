import { doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { writeToArchive } from './archive.service';

export async function deleteUserProject({
  userId, projectId, projectData, currentUserId
}) {
  const ref = doc(db, 'users', userId, 'projects', projectId);
  await deleteDoc(ref);
  await writeToArchive({
    scope: 'user',
    userId,
    type: 'projects',
    data: { projectId, ...projectData },
    deletedBy: currentUserId,
  });
}
