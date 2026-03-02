import { addDoc, serverTimestamp } from 'firebase/firestore'
import { trashCol } from '@/core/db/collections'

/**
 * @deprecated Prefer using src/core/db/index.ts adapter functions.
 * This service remains for compatibility with earlier code.
 */
export async function moveToTrash(uid, payload) {
  if (!uid) throw new Error('UID required')
  return addDoc(trashCol(uid), {
    ...payload,
    deletedAt: serverTimestamp(),
  })
}
