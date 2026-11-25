import type { Browser, BrowserContext, LaunchOptions, Page } from 'playwright'
import { chromium, devices } from 'playwright'
import { fakerPT_BR as faker } from '@faker-js/faker'
import { db } from './database'
import {
  CHURNPROBABILITY,
  NAVIGATIONSKIPTHRESHOLD,
  DEVTOOLS,
  HEADLESS,
  LOG,
  GRANTCONSENTPROBABILITY,
  BOTVERSION,
} from './index'
import { responseMatcher, requestMatcher } from '@lcrespilho/playwright-utils'

declare global {
  interface Window {
    is_playwright_bot: boolean
    bot_version: string
  }
}

let browser: Browser

export async function job(sessionName: string) {
  let page: Page
  let context: BrowserContext

  LOG && console.log('sessionName:', sessionName)

  try {
    // Only one browser instance
    if (!browser) {
      const launchOptions: LaunchOptions = { headless: HEADLESS }
      if (DEVTOOLS) launchOptions.args = ['--auto-open-devtools-for-tabs']
      browser = await chromium.launch(launchOptions)
    }

    // Create new context and new page
    context = await browser.newContext({ ...devices['Nexus 10'], serviceWorkers: 'block' })
    page = await context.newPage()
    page.setDefaultNavigationTimeout(60000)

    // Restore previously saved session, or churn the user with `CHURNPROBABILITY` chance.
    if (Math.random() >= CHURNPROBABILITY) {
      // Restore session, if it already exists
      const savedSessionCookies = (await db.ref(sessionName).get()).val()
      if (savedSessionCookies) {
        LOG && console.log('restoring session')
        await context.addCookies(savedSessionCookies)
      } else {
        LOG && console.log('creating new session')
      }
    } else {
      LOG && console.log('creating new session')
    }

    // Se o banner de cookies aparecer, clico em allow ou decline com 50% de chance
    const cookiebotAllowLocator = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll')
    const cookiebotDeclineLocator = page.locator('#CybotCookiebotDialogBodyButtonDecline')
    const isConsented = Math.random() <= GRANTCONSENTPROBABILITY
    isConsented
      ? cookiebotAllowLocator
          .click()
          .then(() => LOG && console.log('cookies granted'))
          .catch(() => {})
      : cookiebotDeclineLocator
          .click()
          .then(() => LOG && console.log('cookies denied'))
          .catch(() => {})

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

    await context.addInitScript(botVersion => {
      window.is_playwright_bot = true // feed GA4 custom dimensions (event and user scopes)
      window.bot_version = botVersion // feed GA4 event scoped dimension
    }, BOTVERSION)

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
    // Obs: múltiplos page.waitForResponse() olham para a mesma requisição => não adianta inserir 3 esperas por view_promotion.
    LOG && console.log(`utms: ${utm}; referrer: ${referer}`)
    await Promise.all([
      page.goto('https://louren.co.in/ecommerce/home.html' + utm, {
        waitUntil: 'load',
        referer,
      }),
      // 1 page_view
      page.waitForResponse(responseMatcher(makeGA4Regex('page_view', false))),
      // 1 view_promotion
      page.waitForResponse(responseMatcher(makeGA4Regex('view_promotion', false))),
    ])

    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) {
      LOG && console.log('Skip PDL (1/8)')
      return
    } else {
      LOG && console.log("Don't skip PDL (1/8)")
    }

    // PDL
    await Promise.all([
      page.locator(Math.random() < 0.75 ? 'text=pdl1.html' : 'text=pdl2.html').click(),
      page.waitForURL(/pdl.\.html/, { waitUntil: 'networkidle' }),
      // 1 page_view
      page.waitForResponse(responseMatcher(makeGA4Regex('page_view', false))),
      // 1 view_item_list
      page.waitForResponse(responseMatcher(makeGA4Regex('view_item_list', false))),
    ])
    await page.waitForTimeout(5000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) {
      LOG && console.log('Skip PDP (2/8)')
      return
    } else {
      LOG && console.log("Don't skip PDP (2/8)")
    }

    // product click on PDL
    {
      const selectItemResponsePromise = page.waitForResponse(responseMatcher(makeGA4Regex('select_item', false)))
      // Inibe o carregamento da PDP até que o select_item seja coletado
      await using _delayPdp = await page.route(/\/ecommerce\/pdp\d\.html/, async (route, request) => {
        if (request.isNavigationRequest()) {
          await selectItemResponsePromise
        }
        await route.continue()
      })
      await Promise.all([
        page
          .locator('button', { hasText: 'pdp' })
          .nth(Math.random() < 0.75 ? 0 : 1)
          .click(),
        page.waitForURL(/pdp.\.html/, { waitUntil: 'networkidle' }),
        // 1 select_item on PDL
        selectItemResponsePromise,
        // 1 page_view on PDP
        page.waitForResponse(responseMatcher(makeGA4Regex('page_view', false))),
        // 1 view_item on PDP
        page.waitForResponse(responseMatcher(makeGA4Regex('view_item', false))),
      ])
    }
    await page.waitForTimeout(5000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) {
      LOG && console.log('Skip add_to_cart (3/8)')
      return
    } else {
      LOG && console.log("Don't skip add_to_cart (3/8)")
    }

    // add_to_cart on PDP
    await Promise.all([
      page.locator('text=add_to_cart').click(),
      // 1 add_to_cart on PDP
      page.waitForResponse(responseMatcher(makeGA4Regex('add_to_cart', false))),
    ])
    await page.waitForTimeout(5000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) {
      LOG && console.log('Skip Cart (4/8)')
      return
    } else {
      LOG && console.log("Don't skip Cart (4/8)")
    }

    // PDP -> Cart
    await Promise.all([
      page.locator('text=cart.html').click(),
      page.waitForURL(/cart\.html/, { waitUntil: 'networkidle' }),
      // 1 page_view on Cart
      page.waitForResponse(responseMatcher(makeGA4Regex('page_view', isConsented))),
      // 1 view_cart on Cart
      page.waitForResponse(responseMatcher(makeGA4Regex('view_cart', isConsented))),
    ])
    await page.waitForTimeout(5000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) {
      LOG && console.log('Skip Checkout (5/8)')
      return
    } else {
      LOG && console.log("Don't skip Checkout (5/8)")
    }

    // begin_checkout on Cart -> Checkout
    await Promise.all([
      page.locator('text=checkout').click(),
      // 1 begin_checkout on Cart
      page.waitForRequest(requestMatcher(makeGA4Regex('begin_checkout', isConsented))),
      page.waitForURL(/checkout\.html/, { waitUntil: 'networkidle' }),
      // 1 page_view on Checkout
      page.waitForResponse(responseMatcher(makeGA4Regex('page_view', isConsented))),
    ])
    await page.waitForTimeout(5000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) {
      LOG && console.log('Skip add_shipping_info (6/8)')
      return
    } else {
      LOG && console.log("Don't skip add_shipping_info (6/8)")
    }

    // add_shipping_info on Checkout
    await Promise.all([
      page.locator('text=add_shipping_info').click(),
      // 1 add_shipping_info
      page.waitForResponse(responseMatcher(makeGA4Regex('add_shipping_info', isConsented))),
    ])
    await page.waitForTimeout(5000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) {
      LOG && console.log('Skip add_payment_info (7/8)')
      return
    } else {
      LOG && console.log("Don't skip add_payment_info (7/8)")
    }

    // add_payment_info on Checkout
    await Promise.all([
      page.locator('text=add_payment_info').click(),
      // 1 add_payment_info
      page.waitForResponse(responseMatcher(makeGA4Regex('add_payment_info', isConsented))),
    ])
    await page.waitForTimeout(5000)
    if (Math.random() < NAVIGATIONSKIPTHRESHOLD) {
      LOG && console.log('Skip purchase (8/8)')
      return
    } else {
      LOG && console.log("Don't skip purchase (8/8)")
    }

    // purchase on Checkout
    await Promise.all([
      page.locator('text=finalizar compra').click(),
      page.waitForURL(/typ\.html/),
      // 1 page_view
      page.waitForResponse(responseMatcher(makeGA4Regex('page_view', isConsented))),
      // 1 purchase
      page.waitForResponse(responseMatcher(makeGA4Regex('purchase', isConsented))),
    ])
    await page.waitForTimeout(5000)
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
        if (sessionCookies?.length) {
          LOG && console.log('saving session cookies')
          await db.ref(sessionName).set(sessionCookies)
        }
      }
    } catch (error) {
      console.error('E2:', error)
    }
  }
}

function makeGA4Regex(
  /** GA4 event name */
  eventName:
    | 'page_view'
    | 'view_promotion'
    | 'view_item_list'
    | 'select_item'
    | 'view_item'
    | 'add_to_cart'
    | 'view_cart'
    | 'begin_checkout'
    | 'add_shipping_info'
    | 'add_payment_info'
    | 'purchase',
  /** If the hit must or not have UPD data */
  withUPD: boolean,
): RegExp {
  if (withUPD) {
    return new RegExp(`^(?=.*&em=tv\\.1~em\\.[^&]{30,}).*google.*collect\\?v=2.*G-N2DW3RHY0F&.*&en=${eventName}`)
  } else {
    return new RegExp(`^(?!.*&em=tv\\.1~em\\.[^&]{30,}).*google.*collect\\?v=2.*G-N2DW3RHY0F&.*&en=${eventName}`)
  }
}
