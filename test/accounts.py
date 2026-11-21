import asyncio, json, urllib.request
from playwright.async_api import async_playwright
GAS='http://127.0.0.1:8766/exec'
INIT="window.ONUW_TRACK='%s';" % GAS
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); errs=[]; reqs=[]
        ctx=await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True); await ctx.add_init_script(INIT)
        h=await ctx.new_page(); h.on('pageerror',lambda e: errs.append(str(e)))
        h.on('request', lambda r: reqs.append(r.method) if '8766' in r.url else None)
        # route Google's script away (no network in tests)
        await ctx.route('https://accounts.google.com/**', lambda r: r.fulfill(status=200, body='window.google={accounts:{id:{initialize(){},renderButton(el){el.innerHTML="<button id=fake-gsi>Sign in with Google</button>"},disableAutoSelect(){}}}};', content_type='text/javascript'))
        await h.goto('http://127.0.0.1:8765/test.html'); await h.wait_for_selector('#acct-strip'); await h.wait_for_timeout(800)
        print('guest strip:', (await h.inner_text('#acct-strip')).replace('\n',' | '))
        await h.screenshot(path='test/shots/acct_home_guest.png')
        # a second, guest-only visitor
        g=await (await b.new_context()).new_page(); await g.add_init_script(INIT); await g.goto('http://127.0.0.1:8765/test.html'); await g.wait_for_timeout(1200)
        # owner signs in
        await h.evaluate("() => window.__signin('fake:1001:owner@example.com:Matthew')"); await h.wait_for_selector('#owner-open')
        print('signed-in strip:', (await h.inner_text('#acct-strip')).replace('\n',' | '))
        # play a quick test-mode game that ends with a Hunter misfire
        await h.tap('#test-mode-btn'); await h.tap('#test-confirm'); await h.tap('#create-room')
        await h.wait_for_selector('#player-name'); print('name prefilled:', await h.input_value('#player-name')); await h.press('#player-name','Enter')
        await h.wait_for_selector('.room-code')
        await h.evaluate("() => window.__onuw.fillBots(5)"); await h.evaluate("() => window.__onuw.hostCfg({ pool: [12,6,0,0,2,14,14,4], tn: 6, dd: 120, hr: true }, true)")
        await h.tap('#start-game')
        await h.evaluate("""() => { const s=window.__onuw.engine.s; s.start[0]=12; s.cards=s.start.slice(); s.sq++; }""")
        await h.tap('#flip-card'); await h.tap('#ready-btn')
        await h.wait_for_selector('.day', timeout=90000); await h.wait_for_timeout(1500)
        print('dump mid-game rooms:', json.loads(urllib.request.urlopen('http://127.0.0.1:8766/__dump').read())['房間'])
        await h.tap('#hunt-btn'); await h.wait_for_selector('.hunt-overlay')
        await h.tap('.hunt-targets .btn >> nth=2'); await h.tap('#hunt-shoot'); await h.tap('#hunt-confirm')
        await h.wait_for_selector('.end', timeout=8000); await h.wait_for_timeout(2000)
        d=json.loads(urllib.request.urlopen('http://127.0.0.1:8766/__dump').read())
        for k,v in d.items(): print(k, json.dumps(v, ensure_ascii=False, default=str)[:700])
        # owner dashboard
        await h.tap('#acct-btn'); await h.wait_for_selector('#owner-open-2'); await h.screenshot(path='test/shots/acct_modal.png')
        await h.tap('#owner-open-2'); await h.wait_for_selector('#owner-dash .stat'); await h.wait_for_timeout(500)
        await h.screenshot(path='test/shots/owner_dash_mobile.png')
        print('dash stats:', (await h.inner_text('#owner-dash .stat-row')).replace('\n',' '))
        print('logins rows:', await h.evaluate("() => document.querySelectorAll('#dash-logins tbody tr').length"))
        # a non-owner cannot read the dashboard
        r=await g.evaluate("""async () => { await window.__signin('fake:2002:pal@example.com:Pal'); const a=JSON.parse(localStorage.getItem('onuw:acct'));
           const r=await fetch('%s',{method:'POST',body:JSON.stringify({a:'dashboard',token:a.token})}); return [a.account.owner, (await r.json()).error]; }""" % GAS)
        print('non-owner:', r)
        forged=await g.evaluate("""async () => { const r=await fetch('%s',{method:'POST',body:JSON.stringify({a:'dashboard',token:'eyJzdWIiOiIxMDAxIiwiZW1haWwiOiJvd25lckBleGFtcGxlLmNvbSIsImV4cCI6OTk5OTk5OTk5OTk5OX0.abc'})}); return (await r.json()).error; }""" % GAS)
        print('forged token:', forged)
        # mobile layout of dashboard
        w=await (await b.new_context(viewport={'width':1280,'height':1000})).new_page(); await w.add_init_script(INIT)
        await w.goto('http://127.0.0.1:8765/test.html'); await w.wait_for_timeout(600)
        await w.evaluate("() => window.__signin('fake:1001:owner@example.com:Matthew')"); await w.wait_for_selector('#owner-open')
        await w.screenshot(path='test/shots/acct_home_owner.png')
        await w.click('#owner-open'); await w.wait_for_selector('#owner-dash .stat'); await w.wait_for_timeout(500); await w.screenshot(path='test/shots/owner_dash.png')
        print('methods', set(reqs), 'errors', errs)
        await b.close()
asyncio.run(main())
