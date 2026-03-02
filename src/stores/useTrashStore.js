
import { ref, computed } from 'vue'
import { useDatabase } from '@/composables/useDatabase'

export function useTrashStore(uid) {
  const { db } = useDatabase()

  const items = ref([])
  const filter = ref('all')
  const error = ref(null)

  async function load() {
    try {
      if (!uid) return
      const snap = await db
        .collection('users')
        .doc(uid)
        .collection('trash')
        .orderBy('deletedAt', 'desc')
        .get()

      items.value = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(i => i && i.id)
    } catch (e) {
      error.value = e.message
    }
  }

  const filtered = computed(() => {
    if (filter.value === 'all') return items.value
    return items.value.filter(i => i.type === filter.value)
  })

  async function purge(id) {
    if (!uid || !id) return
    await db
      .collection('users')
      .doc(uid)
      .collection('trash')
      .doc(id)
      .delete()
    await load()
  }

  return { items, filtered, filter, load, purge, error }
}


// === STEP 7: purgeExpiredTrash (no TTL) ===
import { query, where, orderBy, limit, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { useAuthStore } from './useAuthStore';
import { can } from '@/core/auth/permissions';

export async function purgeExpiredTrash(db, uid) {
  const auth = useAuthStore();
  if (!can(auth.user, 'trash.purge')) return;

  const now = Timestamp.now();
  let hasMore = true;

  while (hasMore) {
    const q = query(
      collection(db, `users/${uid}/trash`),
      where('expiresAt', '<=', now),
      orderBy('expiresAt'),
      limit(100)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      hasMore = false;
      break;
    }

    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}
