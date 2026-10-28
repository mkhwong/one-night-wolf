import asyncio, sys
from playwright.async_api import async_playwright
SHOT = 'test/shots/a_'
async def run(pw, W, H, touch):
    tag = str(W)
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2 if touch else 1, is_mobile=touch, has_touch=touch)
    h = await ctx.new_page(); errs = []; h.on('pageerror', lambda e: errs.append(str(e)))
    press = (lambda sel: h.tap(sel)) if touch else (lambda sel: h.click(sel))
    await h.goto('http://127.0.0.1:8765/test.html'); await h.wait_for_timeout(500)
    await press('#test-mode-btn'); await press('#test-confirm'); await press('#create-room')
    await h.fill('#player-name', '馬修'); await h.press('#player-name', 'Enter')
    await h.wait_for_selector('.room-code'); await h.evaluate("() => window.__onuw.fillBots(5)")
    await h.evaluate("() => window.__onuw.hostCfg({ pool: [15, 0, 2, 4, 6, 14, 14, 11], tn: 10, dd: 120 }, true)")
    await h.wait_for_timeout(300)
    tile = await h.query_selector('.pool-tile.is-in >> nth=1'); await tile.scroll_into_view_if_needed()
    await h.screenshot(path=SHOT + tag + '_lobby.png')
    print(tag, 'lobby note has alpha:', 'Alpha' in await h.inner_text('.lobby-main') or '頭狼' in await h.inner_text('.lobby-main'))
    await press('#start-game')
    await h.evaluate("""() => { const s = window.__onuw.engine.s;
      const put = (seat, role) => { let i = s.start.indexOf(role); if (i === seat) return;
        if (i < 0) { const c = s.center.indexOf(role); s.center[c] = s.start[seat]; s.center0[c] = s.start[seat]; }
        else { s.start[i] = s.start[seat]; s.cards[i] = s.start[seat]; }
        s.start[seat] = role; s.cards[seat] = role; };
      put(0, 15); put(1, 0); s.lastStart = s.start.slice(); s.sq++; }""")
    await h.wait_for_selector('#flip-card'); await press('#flip-card'); await h.wait_for_timeout(900)
    await h.screenshot(path=SHOT + tag + '_reveal.png'); await press('#ready-btn')
    await h.wait_for_selector('.night'); await h.wait_for_timeout(3600)
    print(tag, 'werewolf turn, my turn:', bool(await h.query_selector('.theater.is-mine')), 'mate arrows:', await h.evaluate("() => document.querySelectorAll('.team-arrow').length"))
    await h.screenshot(path=SHOT + tag + '_wolfturn.png')
    for _ in range(60):
        if await h.query_selector('#night-confirm'): break
        await h.wait_for_timeout(500)
    await h.wait_for_timeout(300)
    st = await h.evaluate("() => ({ title: document.querySelector('.theater-title').innerText, pickable: [...document.querySelectorAll('.tcard.is-pickable')].map(e => e.dataset.spot), wolf: !!document.querySelector('.tcard-wolf'), hint: document.querySelector('.action-dock .hint')?.innerText })")
    print(tag, 'alpha turn', st)
    await h.screenshot(path=SHOT + tag + '_alphaturn.png', full_page=not touch)
    await press('.tcard.is-pickable >> nth=0'); await press('#night-confirm'); await h.wait_for_timeout(500)
    await h.screenshot(path=SHOT + tag + '_alphaanim.png')
    await h.wait_for_timeout(1300)
    print(tag, 'result:', await h.evaluate("() => (document.querySelector('.dock-result') || document.querySelector('.action-panel .info:last-child'))?.innerText"))
    await h.screenshot(path=SHOT + tag + '_alphadone.png')
    await h.wait_for_selector('.day', timeout=120000); await h.wait_for_timeout(1500)
    tgt = await h.evaluate("() => window.__onuw.engine.s.log.find(l => l.k === 'aw').s")
    print(tag, 'converted seat', tgt + 1, 'card now', await h.evaluate("() => window.__onuw.engine.s.cards"), 'marker chips on it:', await h.evaluate(f"() => document.querySelector('.pcard[data-pseat=\"{tgt}\"] .marker-chips')?.innerText"))
    await press('#start-vote'); await h.wait_for_selector('.ballot'); await press('.ballot-card >> nth=0'); await press('#lock-vote')
    await h.wait_for_selector('.end', timeout=40000); await h.wait_for_timeout(1500)
    el = await h.query_selector('.end-center'); await el.scroll_into_view_if_needed(); await h.wait_for_timeout(300)
    await h.screenshot(path=SHOT + tag + '_end.png')
    print(tag, 'timeline has alpha line:', [x for x in (await h.inner_text('.timeline')).split('\n') if '頭狼' in x][:1], 'scrollW', await h.evaluate('document.documentElement.scrollWidth'), 'errors', errs)
    await b.close()
async def main():
    async with async_playwright() as pw:
        await run(pw, 390, 844, True)
        await run(pw, 1280, 820, False)
asyncio.run(main())
