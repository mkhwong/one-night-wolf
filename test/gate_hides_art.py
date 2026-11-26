import asyncio
from playwright.async_api import async_playwright
GAS='http://127.0.0.1:8766/exec'; URL='http://127.0.0.1:8765/test.html'
async def page(b, vp={'width':1280,'height':800}):
    c=await b.new_context(viewport=vp); await c.add_init_script("window.ONUW_TRACK='%s';"%GAS)
    await c.route('https://accounts.google.com/**', lambda r: r.fulfill(status=200, body='window.google={accounts:{id:{initialize(){},renderButton(el){el.innerHTML="<button>Sign in with Google</button>"},disableAutoSelect(){}}}};', content_type='text/javascript'))
    return await c.new_page()
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        o=await page(b); await o.goto(URL); await o.wait_for_selector('#create-room')
        print('no password set -> rules/test buttons:', await o.locator('#rules-btn').count(), await o.locator('#test-mode-btn').count())
        await o.evaluate("() => window.__signin('fake:1001:owner@example.com:Matthew')"); await o.wait_for_selector('#owner-open'); await o.click('#owner-open'); await o.wait_for_selector('#gate-set')
        await o.fill('#gate-new','wolf123'); await o.click('#gate-save'); await o.wait_for_timeout(600); await o.click('#gate-toggle'); await o.wait_for_timeout(600)
        for n,vp in [('desk',{'width':1280,'height':800}),('mob',{'width':390,'height':844})]:
            g=await page(b,vp); g.on('pageerror',lambda e: errs.append(str(e))); await g.goto(URL); await g.wait_for_selector('#gate')
            imgs=await g.evaluate("() => [...document.images].filter(i=>i.src.startsWith('data:image/webp')||i.src.startsWith('data:image/png')||i.src.startsWith('data:image/jpeg')).length")
            print(n,'locked -> rules/test buttons:', await g.locator('#rules-btn').count(), await g.locator('#test-mode-btn').count(), '| character images on screen:', imgs)
            await g.screenshot(path=f'test/shots/gate_nav_{n}.png')
            await g.fill('#gate-pw','wolf123'); await g.press('#gate-pw','Enter'); await g.wait_for_selector('#create-room')
            print(n,'unlocked -> rules/test buttons:', await g.locator('#rules-btn').count(), await g.locator('#test-mode-btn').count())
            await g.click('#rules-btn'); await g.wait_for_selector('.rules-roles'); print(n,'rules open with art:', await g.locator('.rules-art').count()>0)
        print('errors', errs); await b.close()
asyncio.run(main())
