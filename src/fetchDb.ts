import { db, app } from './database'
import { deleteApp } from 'firebase-admin/app'
import fs from 'fs'

;(async () => {
  const allCookies = (await db.ref('ecommerce01').get()).val()
  fs.writeFileSync('allCookies.json', JSON.stringify(allCookies, null, 2), 'utf8')
  await deleteApp(app) // close firebase SDK connection
})()
