import { getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { trashDoc, historyDoc } from '@/core/db/collections'

const DAY = 24 * 60 * 60 * 1000
const SLOTS = 30

export async function moveToTrash(uid: string, id: string, payload: any) {
  const deletedAt = new Date()
  await setDoc(trashDoc(uid, id), {
    ...payload,
    deletedAt: serverTimestamp(),
    deletedAtISO: deletedAt.toISOString(),
    expiresAtISO: new Date(deletedAt.getTime() + SLOTS * DAY).toISOString(),
  })
}

export async function restoreFromTrash(uid: string, id: string) {
  const ref = trashDoc(uid, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return

  const data: any = snap.data()
  delete data.deletedAt
  delete data.deletedAtISO
  delete data.expiresAtISO

  await setDoc(historyDoc(uid, id), data)
  await deleteDoc(ref)
}

export async function deleteForever(uid: string, id: string) {
  await deleteDoc(trashDoc(uid, id))
}
