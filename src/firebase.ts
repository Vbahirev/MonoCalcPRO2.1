// ⚠️ Single source of truth for Firebase in this project is: src/services/firebase.js
//
// This file exists ONLY for compatibility with earlier imports like `@/firebase`.
// It must NOT call initializeApp(), otherwise you can hit app/duplicate-app.

export { db, auth } from './services/firebase';
