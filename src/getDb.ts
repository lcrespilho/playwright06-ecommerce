import { db, app } from './database'
import fs from 'fs'

;(async () => {
  const allCookies = (await db.ref().get()).val()
  fs.writeFileSync('allCookies.json', JSON.stringify(allCookies, null, 2), 'utf8')
  await app.delete() // close firebase SDK connection
})()

