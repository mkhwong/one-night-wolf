import asyncio, sys, time
from playwright.async_api import async_playwright
SHOT = 'test/shots/'
URL = 'http://localhost:8765/test.html'
errors = []

async def auto_night(p, tag):
    # act if it's my turn: pick needed targets and confirm
    btn = await p.query_selector('#night-confirm')
    if btn:
        hint = await p.inner_text('.action-panel .hint') if await p.query_selector('.action-panel .hint') else ''
        picks = await p.query_selector_all('.tcard.is-pickable')
        need = 2 if ('two' in hint.lower() or '兩' in hint) else 1
        for k in range(need):
            try:
                els = await p.query_selector_all('.tcard.is-pickable:not(.is-sel)')
                if els: await els[0].click(timeout=3000)
            except Exception as e:
                print(tag, 'pick failed', str(e)[:80])
        if await btn.is_enabled():
            await btn.click(); print(tag, 'acted:', hint)
            return True
    return False

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1280, 'height': 860})
        await ctx.add_init_script(r'''
          window.__onuwBad = []; window.__onuwMax = 0;
          window.__onuwCheck = (o) => {
            const enc = new TextEncoder();
            const size = enc.encode(JSON.stringify(o)).length; window.__onuwMax = Math.max(window.__onuwMax, size);
            if (size > 4096) window.__onuwBad.push('size ' + size);
            const walk = (v, d, path) => {
              if (d > 8) window.__onuwBad.push('depth ' + path);
              if (typeof v === 'string') { if (enc.encode(v).length > 1024) window.__onuwBad.push('long ' + path); if (/[\u0000-\u001f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/.test(v)) window.__onuwBad.push('ctrl ' + path); }
              else if (Array.isArray(v)) v.forEach((x, i) => walk(x, d + 1, path + '[' + i + ']'));
              else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(k)) window.__onuwBad.push('key ' + path + '.' + k); walk(x, d + 1, path + '.' + k); }
            };
            walk(o, 1, '$');
            if (window.__onuwBad.length > 50) window.__onuwBad.length = 50;
          };''')
        host = await ctx.new_page(); host.on('console', lambda m: errors.append(('host', m.text)) if m.type == 'error' else None)
        host.on('pageerror', lambda e: errors.append(('host-pageerror', str(e))))
        await host.goto(URL); await host.wait_for_timeout(800)
        await host.click('text=EN'); await host.wait_for_timeout(200)
        await host.screenshot(path=SHOT + '01_home.png')
        await host.click('#test-mode-btn'); await host.click('#test-confirm')
        await host.click('#create-room'); await host.wait_for_selector('#player-name')
        await host.fill('#player-name', 'Matthew'); await host.press('#player-name', 'Enter')
        await host.wait_for_selector('.room-code')
        code = (await host.inner_text('.room-code')).strip(); print('code', code)
        # second human
        p2 = await ctx.new_page(); p2.on('pageerror', lambda e: errors.append(('p2-pageerror', str(e))))
        p2.on('console', lambda m: errors.append(('p2', m.text)) if m.type == 'error' else None)
        await p2.goto(URL); await p2.wait_for_timeout(500)
        await p2.fill('#join-code', code); await p2.press('#join-code', 'Enter')
        await p2.wait_for_selector('#player-name', timeout=10000)
        await p2.fill('#player-name', 'Peter'); await p2.press('#player-name', 'Enter')
        await p2.wait_for_selector('.room-code', timeout=8000)
        await host.wait_for_timeout(1500)
        await host.click('text=Fill to 8'); await host.wait_for_timeout(600)
        await host.click('#cfg-tn >> text=6s'); await host.click('#cfg-dd >> text=1 min')
        await host.wait_for_timeout(500)
        await host.screenshot(path=SHOT + '02_lobby.png', full_page=True)
        await p2.screenshot(path=SHOT + '02b_lobby_p2.png')
        await host.click('#start-game')
        await host.wait_for_selector('#flip-card'); await p2.wait_for_selector('#flip-card', timeout=8000)
        await host.click('#flip-card'); await p2.click('#flip-card'); await host.wait_for_timeout(900)
        await host.screenshot(path=SHOT + '03_reveal.png')
        await host.click('#ready-btn'); await p2.click('#ready-btn')
        # night
        shots = 0; t0 = time.time(); acted = {'h': False, 'p': False}
        while time.time() - t0 < 160:
            if await host.query_selector('.day') or await host.query_selector('.vote'): break
            for tag, pg in (('h', host), ('p', p2)):
                if not acted[tag] or True:
                    if await auto_night(pg, tag):
                        acted[tag] = True
                        await pg.wait_for_timeout(1300)
                        await pg.screenshot(path=SHOT + f'04_night_{tag}_act.png')
            if shots < 3 and await host.query_selector('.theater'):
                await host.screenshot(path=SHOT + f'04_night_{shots}.png'); shots += 1
            await host.wait_for_timeout(2500)
        print('night done', time.time() - t0)
        await host.wait_for_selector('.day', timeout=30000)
        await host.wait_for_timeout(1500)
        print('P2 MARKS', await p2.evaluate("() => Object.keys(localStorage).filter(k=>k.startsWith('onuw:mk')).map(k=>k+' '+localStorage.getItem(k))"))
        print('P2 INFO', await p2.evaluate("() => [...document.querySelectorAll('.desk .info')].map(e=>e.textContent)"))
        # claim + chat + throw
        await host.click('.claim-btn >> nth=0'); await host.wait_for_timeout(200)
        await host.screenshot(path=SHOT + '05_claim_toast.png')
        await p2.click('.claim-btn >> nth=1')
        await host.click('#chat-open'); await host.fill('#chat-input', 'I am the Seer, trust me'); await host.press('#chat-input', 'Enter')
        await host.hover('.armory-tab'); await host.click('.armory-item.item-egg')
        await host.click('.pcard[data-pseat="2"]')
        await host.wait_for_timeout(500)
        # p2 throws at host -> first-person splat on host
        await p2.click('.armory-tab'); await p2.wait_for_timeout(400); await p2.click('.armory-item.item-tomato')
        await p2.click('.pcard[data-pseat="0"]')
        await host.wait_for_timeout(1200)
        await host.screenshot(path=SHOT + '06_day_splat.png')
        await host.wait_for_timeout(6000)
        await host.screenshot(path=SHOT + '06b_day.png', full_page=True)
        await p2.screenshot(path=SHOT + '06c_day_p2.png', full_page=True)
        await host.click('#start-vote'); await host.wait_for_selector('.ballot')
        await host.click('.ballot-card >> nth=0'); await host.click('#lock-vote')
        await p2.wait_for_selector('.ballot', timeout=8000); await p2.click('.ballot-card >> nth=1'); await p2.click('#lock-vote')
        await host.screenshot(path=SHOT + '07_vote.png')
        await host.wait_for_selector('.end', timeout=40000); await host.wait_for_timeout(1200)
        await host.screenshot(path=SHOT + '08_end.png', full_page=True)
        await p2.wait_for_selector('.end', timeout=8000)
        await p2.screenshot(path=SHOT + '08b_end_p2.png')
        await host.click('#play-again'); await host.wait_for_timeout(800)
        print('after play again lobby:', bool(await host.query_selector('.lobby')), bool(await p2.query_selector('.lobby')))
        for tag, pg in (('host', host), ('p2', p2)):
            print(tag, 'presence max bytes', await pg.evaluate('window.__onuwMax'), 'violations', await pg.evaluate('[...new Set(window.__onuwBad)].slice(0,10)'))
        await b.close()
    print('ERRORS', len(errors))
    for e in errors[:20]: print(e)
asyncio.run(main())
