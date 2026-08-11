import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'

import dotenv from 'dotenv'
dotenv.config()

const firebaseConfig: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
}
export const app = initializeApp({
  credential: cert(firebaseConfig),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
})

export const db = getDatabase(app)
