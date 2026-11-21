import asyncio
from playwright.async_api import async_playwright
GAS='http://127.0.0.1:8766/exec'; URL='http://127.0.0.1:8765/test.html'
async def page(b, mobile=False):
    c=await b.new_context(**({'viewport':{'width':390,'height':844},'is_mobile':True,'has_touch':True} if mobile else {'viewport':{'width':1280,'height':900}}))
    await c.add_init_script("window.ONUW_TRACK='%s';"%GAS)
    await c.route('https://accounts.google.com/**', lambda r: r.fulfill(status=200, body='window.google={accounts:{id:{initialize(){},renderButton(el){el.innerHTML="<button>Sign in with Google</button>"},disableAutoSelect(){}}}};', content_type='text/javascript'))
    p=await c.new_page(); return p
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        o=await page(b); o.on('pageerror',lambda e: errs.append(str(e)))
        await o.goto(URL); await o.wait_for_selector('#create-room'); print('no password: home shown')
        await o.evaluate("() => window.__signin('fake:1001:owner@example.com:Matthew')"); await o.wait_for_selector('#owner-open')
        await o.click('#owner-open'); await o.wait_for_selector('#gate-set'); print('owner sees:', await o.inner_text('#gate-set'))
        await o.fill('#gate-new','wolf123'); await o.click('#gate-save'); await o.wait_for_timeout(800)
        print('after save:', (await o.inner_text('#gate-set')).replace('\n',' | '))
        await o.screenshot(path='test/shots/gate_owner.png')
        # owner reloads: still open
        await o.reload(); await o.wait_for_timeout(1200); print('owner after reload sees home:', await o.locator('#create-room').count()==1)
        # guest
        g=await page(b, True); g.on('pageerror',lambda e: errs.append(str(e)))
        await g.goto(URL); await g.wait_for_selector('#gate'); print('guest locked, create button present:', await g.locator('#create-room').count())
        await g.fill('#gate-pw','nope'); await g.press('#gate-pw','Enter'); await g.wait_for_selector('#gate-wrong'); print('wrong ->', await g.inner_text('#gate-wrong'))
        await g.screenshot(path='test/shots/gate_guest.png')
        await g.fill('#gate-pw','wolf123'); await g.press('#gate-pw','Enter'); await g.wait_for_selector('#create-room'); print('right password -> home')
        await g.reload(); await g.wait_for_timeout(1200); print('guest after reload home:', await g.locator('#create-room').count()==1)
        # owner changes password -> guest locked again on next visit
        await o.click('#owner-open'); await o.wait_for_selector('#gate-set'); await o.fill('#gate-new','moon456'); await o.click('#gate-save'); await o.wait_for_timeout(800)
        await g.reload(); await g.wait_for_timeout(1200); print('guest after change locked:', await g.locator('#gate').count()==1)
        # google non-owner also needs it
        n=await page(b); await n.goto(URL); await n.wait_for_selector('#gate'); await n.evaluate("() => window.__signin('fake:2002:pal@example.com:Pal')"); await n.wait_for_timeout(1000)
        print('non-owner google still locked:', await n.locator('#gate').count()==1)
        # turn off
        await o.click('#gate-off'); await o.wait_for_timeout(800); await g.reload(); await g.wait_for_timeout(1200); print('after off guest home:', await g.locator('#create-room').count()==1)
        print('errors', errs); await b.close()
asyncio.run(main())
