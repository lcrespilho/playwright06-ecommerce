import type { Browser, BrowserContext, Page, Request, Response } from 'playwright'
import { chromium, devices } from 'playwright'
import { fakerPT_BR as faker } from '@faker-js/faker'
import { db } from './database'
import { USERBASE, CHURNPROBABILITY, NAVIGATIONSKIPTHRESHOLD } from './index'
import { responseMatcher, requestMatcher } from '@lcrespilho/playwright-utils'

let browser: Browser

export async function job(
  /**
   * Session name. EX: 'ecommerce0X/session_XXXXX'
   */
  sessionName: string = 'ecommerce01/session_' + String(Math.floor(Math.random() * USERBASE)).padStart(5, '0')
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
    page.setDefaultNavigationTimeout(60000)

    // Restore previously saved session, or churn the user with `CHURNPROBABILITY` chance.
    if (Math.random() >= CHURNPROBABILITY) {
      // Restore session, if it already exists
      const savedSessionCookies = (await db.ref(sessionName).get()).val()
      if (savedSessionCookies) await context.addCookies(savedSessionCookies)
    }

    // Create "email" cookie in .louren.co.in if it doesn't exist
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

    // Home page
    // 1 page_view + 3 view_promotion + 1 optional select_promotion (80% chance) + 1 scroll
    await Promise.all([
      page.goto('https://louren.co.in/ecommerce/home.html' + utm, {
        waitUntil: 'load',
        referer,
      }),
      // 1 page_view G-8EEVZD2KXM + 1 page_view G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=page_view&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=page_view&/)),
      // 1 view_promotion G-8EEVZD2KXM + 1 view_promotion G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=view_promotion&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=view_promotion&/)),
      // 1 scroll G-8EEVZD2KXM + 1 scroll G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=scroll&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=scroll&/)),
    ])

    // Closes Cookiebot banner.
    page
      .getByRole('button', { name: Math.random() <= 0.5 ? 'Permitir todos' : 'Negar' })
      .click({ timeout: 1900 })
      .catch(() => {})
    await page.waitForTimeout(2000)

    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) return
    // to accumulate at least 10s to simulate engaged session
    await page.waitForTimeout(8000)

    // PDL
    await Promise.all([
      page.locator(Math.random() < 0.75 ? 'text=pdl1.html' : 'text=pdl2.html').click(),
      page.waitForURL(/pdl.\.html/, { waitUntil: 'networkidle' }),
      // 1 page_view G-8EEVZD2KXM + 1 page_view G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=page_view&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=page_view&/)),
      // 1 view_item_list G-8EEVZD2KXM + 1 view_item_list G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=view_item_list&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=view_item_list&/)),
      // 1 scroll G-8EEVZD2KXM + 1 scroll G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=scroll&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=scroll&/)),
    ])
    await page.waitForTimeout(2000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) return

    // product click on PDL
    await Promise.all([
      page
        .locator('button', { hasText: 'pdp' })
        .nth(Math.random() < 0.75 ? 0 : 1)
        .click(),
      page.waitForURL(/pdp.\.html/, { waitUntil: 'networkidle' }),
      // 1 select_item G-8EEVZD2KXM + 1 select_item G-4Z970YCHQZ (on PDL)
      page.waitForRequest(requestMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=select_item&/)),
      page.waitForRequest(requestMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=select_item&/)),
      // 1 page_view G-8EEVZD2KXM + 1 page_view G-4Z970YCHQZ (on PDP)
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=page_view&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=page_view&/)),
      // 1 view_item G-8EEVZD2KXM + 1 view_item G-4Z970YCHQZ (on PDP)
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=view_item&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=view_item&/)),
      // 1 scroll G-8EEVZD2KXM + 1 scroll G-4Z970YCHQZ (on PDP)
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=scroll&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=scroll&/)),
    ])
    await page.waitForTimeout(2000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) return

    // add_to_cart on PDP
    await Promise.all([
      page.locator('text=add_to_cart').click(),
      // 1 add_to_cart G-8EEVZD2KXM + 1 add_to_cart G-4Z970YCHQZ (on PDP)
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=add_to_cart&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=add_to_cart&/)),
    ])
    await page.waitForTimeout(2000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) return

    // Cart
    await Promise.all([
      page.locator('text=cart.html').click(),
      page.waitForURL(/cart\.html/, { waitUntil: 'networkidle' }),
      // 1 page_view G-8EEVZD2KXM + 1 page_view G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=page_view&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=page_view&/)),
      // 1 view_cart G-8EEVZD2KXM + 1 view_cart G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=view_cart&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=view_cart&/)),
      // 1 scroll G-8EEVZD2KXM + 1 scroll G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=scroll&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=scroll&/)),
    ])
    await page.waitForTimeout(2000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) return

    // begin_checkout on Cart -> Checkout
    await Promise.all([
      page.locator('text=checkout').click(),
      // 1 begin_checkout G-8EEVZD2KXM + 1 begin_checkout G-4Z970YCHQZ (on Cart)
      page.waitForRequest(requestMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=begin_checkout&/)),
      page.waitForRequest(requestMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=begin_checkout&/)),
      page.waitForURL(/checkout\.html/, { waitUntil: 'networkidle' }),
      // 1 page_view G-8EEVZD2KXM + 1 page_view G-4Z970YCHQZ (on Checkout)
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=page_view&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=page_view&/)),
      // 1 scroll G-8EEVZD2KXM + 1 scroll G-4Z970YCHQZ (on Checkout)
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=scroll&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=scroll&/)),
    ])
    await page.waitForTimeout(2000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) return

    // add_payment_info on Checkout
    await Promise.all([
      page.locator('text=add_payment_info').click(),
      // 1 add_payment_info G-8EEVZD2KXM + 1 add_payment_info G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=add_payment_info&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=add_payment_info&/)),
    ])
    await page.waitForTimeout(2000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) return

    // add_shipping_info on Checkout
    await Promise.all([
      page.locator('text=add_shipping_info').click(),
      // 1 add_shipping_info G-8EEVZD2KXM + 1 add_shipping_info G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=add_shipping_info&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=add_shipping_info&/)),
    ])
    await page.waitForTimeout(2000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) return

    // purchase on Checkout
    await Promise.all([
      page.locator('text=finalizar compra').click(),
      page.waitForURL(/typ\.html/, { waitUntil: 'networkidle' }),
      // 1 page_view G-8EEVZD2KXM + 1 page_view G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=page_view&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=page_view&/)),
      // 1 purchase G-8EEVZD2KXM + 1 purchase G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=purchase&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=purchase&/)),
      // 1 scroll G-8EEVZD2KXM + 1 scroll G-4Z970YCHQZ
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-8EEVZD2KXM.*en=scroll&/)),
      page.waitForResponse(responseMatcher(/google.*collect\?v=2.*G-4Z970YCHQZ.*en=scroll&/)),
    ])
    await page.waitForTimeout(2000)
  } catch (error) {
    console.error('E1:', error)
  } finally {
    try {
      if (page!) {
        // .catch() is necessary because runBeforeUnload throws if the target page has been closed.
        await page.close({ runBeforeUnload: true }).catch(() => {})
        // .catch() is necessary because .cookies() throws if the target page has been closed.
        const sessionCookies = await page
          .context()
          .cookies()
          .catch(() => {})
        // Don't need .catch because context.close() never throws.
        await page.context().close()
        if (sessionCookies?.length) await db.ref(sessionName).set(sessionCookies)
        return true // indicates success in flow execution
      }
    } catch (error) {
      console.error('E2:', error)
    }
    return false // indicates failure in flow execution
  }
}
