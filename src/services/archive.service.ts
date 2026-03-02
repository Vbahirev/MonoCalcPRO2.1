import {
  addDoc, collection, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

const DAYS_30 = 30 * 24 * 60 * 60 * 1000;

export async function writeToArchive({
  scope, userId, type, data, deletedBy
}) {
  if (scope === 'user' && !userId) {
    throw new Error('userId required');
  }
  const restoreUntil = Timestamp.fromMillis(Date.now() + DAYS_30);
  const ref = scope === 'user'
    ? collection(db, 'users', userId, 'trash')
    : collection(db, 'trash');

  return addDoc(ref, {
    type, data, deletedBy,
    deletedAt: serverTimestamp(),
    restoreUntil,
  });
}
