import asyncio, json
from playwright.async_api import async_playwright
GAS='http://127.0.0.1:8766/exec'; URL='http://127.0.0.1:8765/test.html'
async def page(b, w=1280):
    c=await b.new_context(viewport={'width':w,'height':900})
    await c.add_init_script("window.ONUW_TRACK='%s';"%GAS)
    await c.route('https://accounts.google.com/**', lambda r: r.fulfill(status=200, body='window.google={accounts:{id:{initialize(){},renderButton(el){el.innerHTML="<button>Sign in with Google</button>"},disableAutoSelect(){}}}};', content_type='text/javascript'))
    return await c.new_page()
async def api(p, body):
    return await p.evaluate("async (b) => { const a=JSON.parse(localStorage.getItem('onuw:acct')||'null'); b.token=a&&a.token; const r=await fetch('%s',{method:'POST',body:JSON.stringify(b)}); return r.json(); }"%GAS, body)
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]
        o=await page(b); o.on('pageerror',lambda e: errs.append(str(e)))
        await o.goto(URL); await o.wait_for_selector('#create-room')
        await o.evaluate("() => window.__signin('fake:1001:owner@example.com:Matthew')"); await o.wait_for_selector('#owner-open')
        await o.click('#owner-open'); await o.wait_for_selector('#admin-set')
        # password on
        await o.fill('#gate-new','wolf123'); await o.click('#gate-save'); await o.wait_for_timeout(600); await o.click('#gate-toggle'); await o.wait_for_timeout(600)
        # add admin
        await o.fill('#admin-new','Pal@Example.com'); await o.click('#admin-add'); await o.wait_for_timeout(800)
        print('owner admin list:', (await o.inner_text('#admin-set')).replace('\n',' | '))
        await o.screenshot(path='test/shots/admin_owner_view.png', full_page=True)
        # admin: locked out first, signs in from the gate screen, gets in without password
        a=await page(b); a.on('pageerror',lambda e: errs.append(str(e)))
        await a.goto(URL); await a.wait_for_selector('#gate'); print('admin before sign-in: locked')
        await a.evaluate("() => window.__signin('fake:2002:pal@example.com:Pal')"); await a.wait_for_selector('#create-room', timeout=8000); print('admin after sign-in: in without password')
        await a.wait_for_selector('#owner-open'); print('admin button:', await a.inner_text('#owner-open'))
        await a.click('#owner-open'); await a.wait_for_selector('#gate-set'); await a.wait_for_timeout(400)
        print('admin password field shows:', await a.input_value('#gate-new'))
        print('admin sees sheet link / admin list:', await a.locator('text=開啟試算表').count(), await a.locator('#admin-set').count())
        emails=await a.evaluate("() => [...document.querySelectorAll('#dash-logins tbody tr td:nth-child(4)')].map(x=>x.innerText).filter(Boolean).slice(0,3)")
        print('admin sees emails as:', emails)
        # admin changes the password -> a guest who knew the old one is locked out, new one works
        g=await page(b, 390); await g.goto(URL); await g.wait_for_selector('#gate'); await g.fill('#gate-pw','wolf123'); await g.press('#gate-pw','Enter'); await g.wait_for_selector('#create-room')
        await a.fill('#gate-new','moon456'); await a.click('#gate-save'); await a.wait_for_timeout(800); print('admin saved:', await a.inner_text('#gate-msg'))
        await a.screenshot(path='test/shots/admin_admin_view.png', full_page=True)
        await g.reload(); await g.wait_for_selector('#gate'); await g.fill('#gate-pw','moon456'); await g.press('#gate-pw','Enter'); await g.wait_for_selector('#create-room'); print('guest needed the admin\'s new password: ok')
        await a.click('#gate-toggle'); await a.wait_for_timeout(800); print('admin switched off:', await a.inner_text('#gate-msg'))
        await a.click('#gate-toggle'); await a.wait_for_timeout(800)
        print('admin set admins via API:', (await api(a, {'a':'admins','emails':['x@y.com']}))['error'])
        # max 5
        r=await api(o, {'a':'admins','emails':['a1@x.com','a2@x.com','a3@x.com','a4@x.com','a5@x.com','a6@x.com']}); print('6 admins:', r.get('error'))
        # non-admin google player still needs the password
        n=await page(b); await n.goto(URL); await n.wait_for_selector('#gate'); await n.evaluate("() => window.__signin('fake:3003:other@example.com:Other')"); await n.wait_for_timeout(1500)
        print('non-admin google still locked:', await n.locator('#gate').count()==1)
        # owner removes admin -> admin locked on next visit
        await o.get_by_role('button', name='移除 pal@example.com').click(); await o.wait_for_timeout(800)
        await a.reload(); await a.wait_for_timeout(1800); print('removed admin locked again:', await a.locator('#gate').count()==1)
        print('errors', errs); await b.close()
asyncio.run(main())
