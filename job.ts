import type { Browser, BrowserContext, Page } from 'playwright'
import { chromium, devices } from 'playwright'
import admin, { ServiceAccount } from 'firebase-admin'
import { fakerPT_BR as faker } from '@faker-js/faker'
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
const db = admin.database()

let browser: Browser

export async function job(
  /**
   * Small chance of churning the session. [default=0]
   */
  churnProbability: number = 0,
  /**
   * Navigation skip threshold. [default=0.25]
   */
  navigationSkipThreshold: number = 0.25,
  /**
   * Session name. [default='ecommerce/session_XXXX']
   */
  sessionName: string = 'ecommerce/session_' + Math.floor(Math.random() * 5000)
) {
  let page: Page
  let context: BrowserContext

  try {
    // Only one browser instance
    if (!browser) {
      browser = await chromium.launch({
        headless: process.env.HEADLESS !== 'false',
        devtools: process.env.DEVTOOLS === 'true',
      })
    }

    // Create new context and new page
    context = await browser.newContext({
      ...devices['Nexus 10'],
    })
    page = await context.newPage()

    // Restore previously saved session, or churn the user with `churnProbability` chance.
    if (Math.random() >= churnProbability) {
      // Restore session, if it already exists
      const savedSessionCookies = (await db.ref(sessionName).get()).val()
      if (savedSessionCookies) await context.addCookies(savedSessionCookies)
    }

    // Create "email" cookie in https://louren.co.in/ if it doesn't exist
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

    // Create "variant=1" cookie for future tests.
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
    if (Math.random() < navigationSkipThreshold) return
    // at least 10s to simulate engaged session
    await page.waitForTimeout(10000)

    // view_item_list em PDL
    await Promise.all([
      page.locator(Math.random() < 0.75 ? 'text=pdl1.html' : 'text=pdl2.html').click(),
      page.waitForURL(/pdl.\.html/, { waitUntil: 'networkidle' }),
    ])
    await page.waitForTimeout(6000) // wait for events
    if (Math.random() < navigationSkipThreshold) return

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
    if (Math.random() < navigationSkipThreshold) return

    // add_to_cart
    await page.locator('text=add_to_cart').click()
    await page.waitForTimeout(6000) // wait for events
    if (Math.random() < navigationSkipThreshold) return

    // view_cart on cart.html load
    await Promise.all([
      page.locator('text=cart.html').click(),
      page.waitForURL(/cart\.html/, { waitUntil: 'networkidle' }),
    ])
    await page.waitForTimeout(6000) // wait for events
    if (Math.random() < navigationSkipThreshold) return

    // begin_checkout
    await Promise.all([
      page.locator('text=checkout').click(),
      page.waitForURL(/checkout\.html/, { waitUntil: 'networkidle' }),
    ])
    await page.waitForTimeout(6000) // wait for events
    if (Math.random() < navigationSkipThreshold) return

    // add_payment_info
    await page.locator('text=add_payment_info').click()
    await page.waitForTimeout(6000) // wait for events
    if (Math.random() < navigationSkipThreshold) return

    // add_shipping_info
    await page.locator('text=add_shipping_info').click()
    await page.waitForTimeout(6000) // wait for events
    await page.waitForTimeout(1000)
    if (Math.random() < navigationSkipThreshold) return

    // purchase
    await Promise.all([
      page.locator('text=finalizar compra').click(),
      page.waitForURL(/typ\.html/, { waitUntil: 'networkidle' }),
    ])
    await page.waitForTimeout(6000) // wait for events
  } catch (error) {
    console.error('E1:', error)
  } finally {
    try {
      if (page! && !page.isClosed()) {
        await page.close({ runBeforeUnload: true })
        const sessionCookies = await page.context().cookies()
        if (sessionCookies.length) await db.ref(sessionName).set(sessionCookies)
      }
    } catch (error) {
      console.error('E2:', error)
    }
  }
}
