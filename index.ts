import { chromium } from 'playwright';
import type { Page, BrowserContext, Request } from 'playwright';
import c from 'ansi-colors';
import fs from 'fs';

function flatRequestUrl(req: Request): string {
  return (req.url() + '&' + (req.postData() || ''))
    .replace(/\r\n|\n|\r/g, '&')
    .replace(/&&/g, '&')
    .replace(/&$/g, '');
}

function updateLogs(logs: object) {
  console.clear();
  console.log('Logs:\n');
  for (const [key, value] of Object.entries(logs)) {
    console.log(`[${key}]: ${value}`);
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    devtools: process.env.DEVTOOLS === 'true',
  });

  let logs = {};
  while (true) {
    logs = Object.fromEntries(Object.entries(logs).slice(-30)); // limita o tamanho de `logs`
    
    // safeguard: it shouldn't be any context here
    const contexts = browser.contexts();
    for (const context of contexts) await context.close();

    await Promise.allSettled(
      new Array(2).fill(3).map(async (_, idx) => {
        let page: Page, context: BrowserContext;
        let stateFile =
          '/tmp/state_' + Math.floor(Math.random() * 1000) + '.json';
        const SKIP_THRESHOLD = 0.25;

        try {
          if (!fs.existsSync(stateFile)) {
            fs.writeFileSync(stateFile, '{}', 'utf8');
          }
          context = await browser.newContext({
            storageState: stateFile,
            viewport: null,
          });
          await context.addInitScript({
            content: `
              window.is_playwright_bot = true;
              //window.debug_mode = true; // uncomment to enable GA4 DebugView
            `,
          });
          page = await context.newPage();

          page.on('close', page => {
            logs[stateFile] = logs[stateFile] || '';
            logs[stateFile] += ' ' + c.gray('page closed');
          });

          page.on('request', async (req: Request) => {
            const url = flatRequestUrl(req);
            if (url.match(/google.*collect\?v=2/)) {
              let [, _et = ''] =
                url.match(/en=user_engagement.*?&_et=(\d+)/) || [];
              const events = url
                .match(/&en=.*?&/g)
                .map(s => s.replace(/&(en=)?/g, ''))
                .map(s =>
                  s === 'purchase'
                    ? c.red(s)
                    : s === 'user_engagement'
                    ? c.green(s + ` (${_et})`)
                    : s
                );
              logs[stateFile] = logs[stateFile] || '';
              logs[stateFile] += ' ' + events.join(', ');
              updateLogs(logs);
            }
          });

          const referrals = [
            'https://www.google.com/',
            'https://www.facebook.com/',
            'https://www.bing.com/',
            'https://br.yahoo.com/',
            'https://www.msn.com/',
          ];

          const UTMs = [
            '?utm_source=google&utm_medium=cpc&utm_campaign=google-cpc-campaign',
            '?utm_source=facebook&utm_medium=cpc&utm_campaign=facebook-cpc-campaign',
            '?utm_source=bing&utm_medium=cpc&utm_campaign=bing-cpc-campaign',
            '?utm_source=yahoo&utm_medium=cpc&utm_campaign=yahoo-cpc-campaign',
            '?utm_source=msn&utm_medium=cpc&utm_campaign=msn-cpc-campaign',
            '?utm_source=newsletter&utm_medium=email&utm_campaign=newsletter-email-campaign',
            '?utm_source=myaffiliate&utm_medium=affiliate&utm_campaign=myaffiliate-affiliate-campaign',
            '?utm_source=mysource&utm_medium=display&utm_campaign=mysource-display-campaign',
          ];

          // Decides if referral or UTM traffic:
          let utm = '';
          let referer = undefined;
          if (Math.random() < 0.5) {
            // UTM
            utm = UTMs[Math.floor(Math.random() * UTMs.length)];
          } else {
            // referer
            referer = referrals[Math.floor(Math.random() * referrals.length)];
          }
          // 2 disparos de view_promotion
          await Promise.all([
            page.goto('https://louren.co.in/ecommerce/home.html' + utm, {
              waitUntil: 'load',
              referer,
            }),
            page.waitForRequest(/google.*collect\?v=2/),
          ]);

          // at least 10s to simulate engaged session
          // at least 500ms to collect "select_promotion" (deliberately delayed by 500ms)
          await page.waitForTimeout(10000);

          if (Math.random() < SKIP_THRESHOLD) return;

          // view_item_list em PDL
          await Promise.all([
            page
              .locator(
                Math.random() < 0.75 ? 'text=pdl1.html' : 'text=pdl2.html'
              )
              .click(),
            page.waitForURL(/pdl.\.html/, { waitUntil: 'networkidle' }),
          ]);

          if (Math.random() < SKIP_THRESHOLD) return;
          // select_item quando clica no produto
          // view_item no carregamento da pdp
          await Promise.all([
            page
              .locator('button', { hasText: 'pdp' })
              .nth(Math.random() < 0.75 ? 0 : 1)
              .click(),
            page.waitForURL(/pdp.\.html/, { waitUntil: 'networkidle' }),
          ]);

          if (Math.random() < SKIP_THRESHOLD) return;
          // add_to_cart, estando na PDP
          await page.locator('text=add_to_cart').click();

          if (Math.random() < SKIP_THRESHOLD) return;
          // view_cart no carregamento do cart.html, estando na PDP
          await Promise.all([
            page.locator('text=cart.html').click(),
            page.waitForURL(/cart\.html/, { waitUntil: 'networkidle' }),
          ]);

          if (Math.random() < SKIP_THRESHOLD) return;
          // begin_checkout no clique para ir pro checkout, estando no cart
          await Promise.all([
            page.locator('text=checkout').click(),
            page.waitForURL(/checkout\.html/, { waitUntil: 'networkidle' }),
          ]);

          if (Math.random() < SKIP_THRESHOLD) return;
          // add_payment_info, estando no checkout
          await page.locator('text=add_payment_info').click();

          if (Math.random() < SKIP_THRESHOLD) return;
          // add_shipping_info, estando no checkout
          await page.locator('text=add_shipping_info').click();

          await page.waitForTimeout(1000);

          if (Math.random() < SKIP_THRESHOLD) return;
          // purchase, no carregamento da TYP
          await Promise.all([
            page.locator('text=finalizar compra').click(),
            page.waitForURL(/typ\.html/, { waitUntil: 'networkidle' }),
          ]);
          await page.waitForTimeout(1500);
        } catch (error) {
          console.log('[💩]', error);
        } finally {
          if (page && !page.isClosed()) {
            await page.close();
            await context.storageState({ path: stateFile });
            await context.close();
          }
        }
      })
    );
  }

  await browser.close();
})();
