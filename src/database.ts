import admin, { ServiceAccount } from 'firebase-admin'

import dotenv from 'dotenv'
dotenv.config()

const firebaseConfig: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
}
admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
  databaseURL: 'https://lourenco-tests-340212-default-rtdb.firebaseio.com',
})

export const db = admin.database()
export const app = admin.app()
