import { setDoc, serverTimestamp } from 'firebase/firestore'
import { garbageSlotDoc } from '@/core/db/collections'

const DAY = 24 * 60 * 60 * 1000
const SLOTS = 30

export async function ensureDailyGarbageSlot(uid: string, payload?: any) {
  const slot = Math.floor(Date.now() / DAY) % SLOTS
  await setDoc(garbageSlotDoc(uid, slot), {
    slot,
    type: payload ? 'event' : 'empty',
    writtenAt: serverTimestamp(),
    payload: payload || null,
  })
}
