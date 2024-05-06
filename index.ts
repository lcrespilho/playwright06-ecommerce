import { chromium, devices } from 'playwright'
import type { Page, BrowserContext, Request } from 'playwright'
import c from 'ansi-colors'
import { fakerPT_BR as faker } from '@faker-js/faker'
import { flatRequestUrl } from '@lcrespilho/playwright-utils'
import admin, { ServiceAccount } from 'firebase-admin'
import dotenv from 'dotenv'
dotenv.config()

const DISABLE_VERBOSE_LOG = true // Gera logs enormes no pm2. Ativar apenas para debug.
const CONCURRENCY = 2 // Navegações concorrentes: precisa ser no máximo 2 na VM free-tier do GCP.

const firebaseConfig: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
}
admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
  databaseURL: 'https://lourenco-tests-340212-default-rtdb.firebaseio.com',
})
const db = admin.database()


/**
 * Prints to console the { key: value } object parameter as "key: value" string.
 *
 * @param {object} logs Object containing the data to be printed.
 */
function updateLogs(logs: object) {
  if (DISABLE_VERBOSE_LOG) return
  console.clear()
  console.log('Logs:\n')
  for (const [key, value] of Object.entries(logs)) {
    console.log(`[${key}]: ${value}`)
  }
}

;(async () => {
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    devtools: process.env.DEVTOOLS === 'true',
  })

  let logs: { [key: string]: string } = {}
  while (true) {
    logs = Object.fromEntries(Object.entries(logs).slice(-30)) // limit `logs` size

    // safeguard: it shouldn't be any context here
    const contexts = browser.contexts()
    for (const context of contexts) await context.close()

    await Promise.allSettled(
      new Array(CONCURRENCY).fill(3).map(async (_, idx) => {
        const context: BrowserContext = await browser.newContext({
          ...devices['Nexus 10'],
        })
        const page: Page = await context.newPage()
        const clientSessionName = 'ecommerce/session_' + Math.floor(Math.random() * 5000)
        const SKIP_THRESHOLD = 0.25

        try {
          // Small probability to reset (don't restore) user state.
          // TODO: mudar para 0.95 no futuro, para simular churn
          if (Math.random() <= 1.0) {
            // await restoreSessionCookies(context, clientSessionName)
            const cookies = (await db.ref(clientSessionName).get()).val()
            if (cookies) await context.addCookies(cookies)
          }

          // Cria o cookie "email" em https://louren.co.in se ele ainda não existir
          if (!(await context.cookies('https://louren.co.in')).find(c => c.name === 'email')) {
            await context.addCookies([
              {
                name: 'email',
                value: (faker.person.firstName().replace(' ', '.') + '@gmail.com').toLowerCase(),
                domain: '.louren.co.in',
                path: '/',
                expires: Date.now() / 1000 + 1 * 365 * 24 * 60 * 60, // 1 ano
              },
            ])
          }

          // Cria cookie "variant" com valor "1", para ser utilizado em futuros testes
          await context.addCookies([
            {
              name: 'variant',
              value: '1',
              domain: '.louren.co.in',
              path: '/',
              expires: Date.now() / 1000 + 1 * 365 * 24 * 60 * 60, // 1 ano
            },
          ])

          await context.addInitScript({
            content: `
              window.is_playwright_bot = true; // feeds GA4 custom dimensions (event and user scopes)
              // window.debug_mode = true; // uncomment to enable GA4 DebugView
              // window.server_container_url = 'https://enunujuwqdhws.x.pipedream.net'; // https://public.requestbin.com/r/enunujuwqdhws
            `,
          })

          page.on('close', () => {
            logs[clientSessionName] = (logs[clientSessionName] || '') + ' ' + c.gray('page closed')
            updateLogs(logs)
          })

          page.on('request', async (req: Request) => {
            const url = flatRequestUrl(req)
            // GA4 hit
            if (url.match(/google.*collect\?v=2.*G-8EEVZD2KXM/)) {
              let [, _et = ''] = url.match(/en=user_engagement.*?&_et=(\d+)/) || [] // extracts _et parameter, if present
              const events = url
                .match(/&en=[^&]+/g)! // ['&en=event1', '&en=event2', ...]
                .map(s => s.replace(/&en=/g, '')) // ['event1', 'event2', ...]
                .map(s => {
                  switch (s) {
                    case 'user_engagement':
                      return c.green(s + ` (${_et})`)
                    case 'purchase':
                      return c.red(s)
                    default:
                      return s
                  }
                })
              logs[clientSessionName] = (logs[clientSessionName] || '') + ' ' + events.join(', ')
              updateLogs(logs)
            }
          })

          const referrals = [
            'https://www.google.com/',
            'https://www.facebook.com/',
            'https://www.bing.com/',
            undefined, // (direct)
          ]

          const UTMs = [
            '?gclid=gclidAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            '?gclid=gclidBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB&utm_source=google-gclid&utm_medium=cpc-gclid&utm_campaign=google-cpc-campaign-gclid&utm_id=google-cpc-id-gclid&utm_term=google-cpc-term-gclid&utm_content=google-cpc-content-gclid&utm_source_platform=playwright006&utm_creative_format=none&utm_marketing_tactic=testing',
            '?utm_source=facebook&utm_medium=cpc&utm_campaign=facebook-cpc-campaign&utm_id=facebook-cpc-id&utm_term=facebook-cpc-term&utm_content=facebook-cpc-content&utm_source_platform=playwright006&utm_creative_format=none&utm_marketing_tactic=testing',
            '?utm_source=mysource&utm_medium=display&utm_campaign=mysource-display-campaign&utm_id=mysource-display-id&utm_term=mysource-display-term&utm_content=mysource-display-content&utm_source_platform=playwright006&utm_creative_format=none&utm_marketing_tactic=testing',
          ]

          // Decides if referral or UTM traffic:
          let utm = ''
          let referer = undefined
          if (Math.random() < 0.5) {
            // UTM
            utm = UTMs[Math.floor(Math.random() * UTMs.length)]
            referer = (utm.includes('gclid=') && Math.random() < 0.5 && 'https://www.google.com/') || undefined
          } else {
            // referer
            referer = referrals[Math.floor(Math.random() * referrals.length)]
          }

          // 2 view_promotion events
          await Promise.all([
            page.goto('https://louren.co.in/ecommerce/home.html' + utm, {
              waitUntil: 'load',
              referer,
            }),
            page.waitForResponse(/google.*collect\?v=2/),
          ])

          // Closes Cookiebot banner.
          page
            .getByRole('button', { name: Math.random() <= 1.0 ? 'Permitir todos' : 'Negar' })
            .click({ timeout: 1900 })
            .catch(() => {})

          // at least 500ms to collect "select_promotion" (deliberately delayed by 500ms on website)
          await page.waitForTimeout(2000)
          if (Math.random() < SKIP_THRESHOLD) return
          // at least 10s to simulate engaged session
          await page.waitForTimeout(10000)

          // view_item_list em PDL
          await Promise.all([
            page.locator(Math.random() < 0.75 ? 'text=pdl1.html' : 'text=pdl2.html').click(),
            page.waitForURL(/pdl.\.html/, { waitUntil: 'networkidle' }),
          ])
          await page.waitForTimeout(6000) // wait for events
          if (Math.random() < SKIP_THRESHOLD) return

          // select_item when product click
          // view_item when PDP loads
          await Promise.all([
            page
              .locator('button', { hasText: 'pdp' })
              .nth(Math.random() < 0.75 ? 0 : 1)
              .click(),
            page.waitForURL(/pdp.\.html/, { waitUntil: 'networkidle' }),
          ])
          await page.waitForTimeout(6000) // wait for events
          if (Math.random() < SKIP_THRESHOLD) return

          // add_to_cart
          await page.locator('text=add_to_cart').click()
          await page.waitForTimeout(6000) // wait for events
          if (Math.random() < SKIP_THRESHOLD) return

          // view_cart on cart.html load
          await Promise.all([
            page.locator('text=cart.html').click(),
            page.waitForURL(/cart\.html/, { waitUntil: 'networkidle' }),
          ])
          await page.waitForTimeout(6000) // wait for events
          if (Math.random() < SKIP_THRESHOLD) return

          // begin_checkout
          await Promise.all([
            page.locator('text=checkout').click(),
            page.waitForURL(/checkout\.html/, { waitUntil: 'networkidle' }),
          ])
          await page.waitForTimeout(6000) // wait for events
          if (Math.random() < SKIP_THRESHOLD) return

          // add_payment_info
          await page.locator('text=add_payment_info').click()
          await page.waitForTimeout(6000) // wait for events
          if (Math.random() < SKIP_THRESHOLD) return

          // add_shipping_info
          await page.locator('text=add_shipping_info').click()
          await page.waitForTimeout(6000) // wait for events
          await page.waitForTimeout(1000)
          if (Math.random() < SKIP_THRESHOLD) return

          // purchase
          await Promise.all([
            page.locator('text=finalizar compra').click(),
            page.waitForURL(/typ\.html/, { waitUntil: 'networkidle' }),
          ])
          await page.waitForTimeout(6000) // wait for events
        } catch (error) {
          console.log('[💩]', error)
        } finally {
          if (page && !page.isClosed()) {
            await page.close({ runBeforeUnload: true })
            // await saveSessionCookies(context, clientSessionName, 1 * 365 * 24 * 60 * 60 /*1 ano em segundos*/)
            const cookies = await context.cookies()
            if (cookies.length) await db.ref(clientSessionName).set(cookies)
            await context.close()
          }
        }
      })
    )
  }
})()
