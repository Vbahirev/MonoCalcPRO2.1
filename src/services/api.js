// DEPRECATED 🚫
//
// This file used to contain direct Firestore operations and string-built paths.
// STEP 3 migration introduces a single Firestore adapter:
//   - src/core/db/collections.ts (path helpers)
//   - src/core/db/index.ts (operations)
//
// Keep this file only so older imports won't instantly crash during refactors.
// New code MUST NOT import this module.

export function deprecatedApi() {
  throw new Error('src/services/api.js is deprecated. Use src/core/db/index.ts instead.')
}
