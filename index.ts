import { webkit, chromium, firefox, devices } from 'playwright';
import type { Page, BrowserContext, Request } from 'playwright';
import c from 'ansi-colors';
import fs from 'fs';

function flatRequestUrl(req: Request): string {
  return (req.url() + '&' + (req.postData() || ''))
    .replace(/\r\n|\n|\r/g, '&')
    .replace(/&&/g, '&')
    .replace(/&$/g, '');
}

(async () => {
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    devtools: process.env.DEVTOOLS === 'true',
  });

  while (true) {
    console.log('══════════════════════════════════════════════');
    await Promise.allSettled(
      new Array(25).fill(3).map(async (_, idx) => {
        let page: Page, context: BrowserContext;
        let stateFile = 'state_' + Math.floor(Math.random() * 10000) + '.json';
        const SKIP_THRESHOLD = 0.35;

        try {
          if (!fs.existsSync(stateFile)) {
            fs.writeFileSync(stateFile, '{}', 'utf8');
          }
          context = await browser.newContext({
            storageState: stateFile,
            viewport: null,
            userAgent:
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            //...devices['iPhone 12 Pro'],
          });
          page = await context.newPage();

          page.on('request', async (req: Request) => {
            const url = flatRequestUrl(req);
            if (url.match(/google.*collect\?v=2/)) {
              const events = url
                .match(/&en=.*?&/g)
                .map(s => s.replace(/&(en=)?/g, ''))
                .map(s => (s === 'purchase' ? c.red(s) : s));
              console.log(`${idx}:`, events.join(', '));
            }
          });

          // Navegações para popular lista de Ads
          await page.goto('https://google.com.br', {
            timeout: 60000,
            waitUntil: 'networkidle',
          });
          await page.goto('https://google.com', {
            timeout: 60000,
            waitUntil: 'networkidle',
          });
          await page.goto('https://youtube.com', {
            timeout: 60000,
            waitUntil: 'networkidle',
          });

          // 2 disparos de view_promotion
          await Promise.all([
            page.goto('https://louren.co.in/ecommerce/home.html', {
              waitUntil: 'load',
              referer: 'https://google.com/',
            }),
            page.waitForRequest(/google.*collect\?v=2/),
          ]);

          if (Math.random() < SKIP_THRESHOLD) return;
          // Aguarda disparo de select_promotion, porque a página
          // tem delay de 500ms para disparar esse evento.
          await page.waitForTimeout(1000);

          if (Math.random() < SKIP_THRESHOLD) return;
          // view_item_list em PDL
          await Promise.all([
            page
              .locator(
                Math.random() < 0.75 ? 'text=pdl1.html' : 'text=pdl2.html'
              )
              .click(),
            page.waitForNavigation({ waitUntil: 'networkidle' }),
          ]);

          if (Math.random() < SKIP_THRESHOLD) return;
          // select_item quando clica no produto
          // view_item no carregamento da pdp
          await Promise.all([
            page
              .locator('button', { hasText: 'pdp' })
              .nth(Math.random() < 0.75 ? 0 : 1)
              .click(),
            page.waitForNavigation({ waitUntil: 'networkidle' }),
          ]);

          if (Math.random() < SKIP_THRESHOLD) return;
          // add_to_cart, estando na PDP
          await page.locator('text=add_to_cart').click();

          if (Math.random() < SKIP_THRESHOLD) return;
          // view_cart no carregamento do cart.html, estando na PDP
          await Promise.all([
            page.locator('text=cart.html').click(),
            page.waitForNavigation({ waitUntil: 'networkidle' }),
          ]);

          if (Math.random() < SKIP_THRESHOLD) return;
          // begin_checkout no clique para ir pro checkout, estando no cart
          await Promise.all([
            page.locator('text=checkout').click(),
            page.waitForNavigation({ waitUntil: 'networkidle' }),
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
            page.waitForNavigation({ waitUntil: 'networkidle' }),
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
