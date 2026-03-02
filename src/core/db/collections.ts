import { doc, collection } from 'firebase/firestore'
import { db } from '@/firebase'

/**
 * Firestore path helpers (single source of truth).
 * IMPORTANT: Do NOT build string paths in UI/components.
 */

export const usersDoc = (uid: string) => doc(db, 'users', uid)

export const historyCol = (uid: string) => collection(db, 'users', uid, 'history')
export const historyDoc = (uid: string, id: string) => doc(db, 'users', uid, 'history', id)

export const trashCol = (uid: string) => collection(db, 'users', uid, 'trash')
export const trashDoc = (uid: string, id: string) => doc(db, 'users', uid, 'trash', id)

export const kanbanCol = (uid: string) => collection(db, 'users', uid, 'kanban')

export const globalConfigDoc = () => doc(db, 'settings', 'global_config')

// Optional: daily garbage ring-buffer (30 slots)
export const garbageSlotDoc = (uid: string, slotId: string | number) =>
  doc(db, 'users', uid, 'garbage', 'slots', String(slotId))
