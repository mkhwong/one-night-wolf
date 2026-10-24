import asyncio, time
from playwright.async_api import async_playwright
SHOT = 'test/shots/p_'
URL = 'http://127.0.0.1:8765/test-peer.html'
errs = []
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--disable-features=WebRtcHideLocalIpsWithMdns'])
        A = await (await b.new_context(viewport={'width': 1280, 'height': 820})).new_page()
        B = await (await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)).new_page()
        for tag, p in (('A', A), ('B', B)):
            p.on('pageerror', lambda e, tag=tag: errs.append(tag + ' ' + str(e)))
            p.on('console', lambda m, tag=tag: errs.append(tag + ' console ' + m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        await A.goto(URL); await B.goto(URL); await A.wait_for_timeout(1200)
        print('A mode note:', (await A.inner_text('.mode-note'))[:60])
        await A.click('.lang-seg >> text=EN'); await A.click('#test-mode-btn'); await A.click('#test-confirm'); await A.click('#create-room')
        await A.fill('#player-name', 'Matthew'); await A.press('#player-name', 'Enter'); await A.wait_for_selector('.room-code')
        code = (await A.inner_text('.room-code')).strip(); print('code', code, 'net', await A.evaluate('window.__onuw.v.netKind'))
        t0 = time.time()
        await B.fill('#join-code', code); await B.press('#join-code', 'Enter')
        await B.wait_for_selector('#player-name', timeout=15000); print('B reached name screen in %.1fs' % (time.time() - t0), 'net', await B.evaluate('window.__onuw.v.netKind'))
        await B.fill('#player-name', 'Peter'); await B.press('#player-name', 'Enter')
        await B.wait_for_selector('.room-code', timeout=8000)
        await A.wait_for_function("() => document.querySelectorAll('.seat-row').length === 2", timeout=8000); print('host sees 2 seats')
        await A.click('text=Fill to 5'); await A.evaluate("() => window.__onuw.hostCfg({ pool: [0,0,4,6,7,8,14,11], tn: 8, dd: 120 }, true)")
        await B.wait_for_timeout(800)
        print('B lobby seats:', await B.evaluate("() => document.querySelectorAll('.seat-row').length"))
        # host reload in lobby: hub must come back under the same code
        await A.reload(); await A.wait_for_selector('.room-code', timeout=25000); print('host back after reload:', (await A.inner_text('.room-code')).strip())
        await B.wait_for_function("() => document.querySelectorAll('.seat-row').length === 5", timeout=30000)
        await A.wait_for_timeout(7000)
        print('B reconnected, sees 5 seats; Peter still seat', await A.evaluate("() => window.__onuw.engine.s.seats.findIndex(x => x.name === 'Peter') + 1"))
        await A.click('#start-game')
        await A.evaluate("""() => { const s = window.__onuw.engine.s;
          const put = (seat, role) => { let i = s.start.indexOf(role); if (i === seat) return;
            if (i < 0) { const c = s.center.indexOf(role); s.center[c] = s.start[seat]; s.center0[c] = s.start[seat]; }
            else { s.start[i] = s.start[seat]; s.cards[i] = s.start[seat]; }
            s.start[seat] = role; s.cards[seat] = role; };
          const pb = s.seats.findIndex(x => x.name === 'Peter'); put(0, 7); put(pb, 4); s.lastStart = s.start.slice(); s.sq++; }""")
        await B.wait_for_selector('#flip-card', timeout=10000); await A.wait_for_timeout(2000)
        print('DEBUG host start', await A.evaluate('window.__onuw.engine.s.start'), 'B priv r', await B.evaluate('window.__onuw.v.priv && window.__onuw.v.priv.r'), 'B seat', await B.evaluate('window.__onuw.v.mySeat'))
        await B.tap('#flip-card'); await B.wait_for_timeout(900)
        print('B card:', await B.inner_text('.flip-name b'))
        await B.tap('#ready-btn'); await A.click('#flip-card'); await A.click('#ready-btn')
        # B (seer) acts across the peer link
        for _ in range(80):
            if await B.query_selector('#night-confirm'): break
            await B.wait_for_timeout(500)
        await B.wait_for_timeout(300); await B.tap('.tcard.is-pickable >> nth=0'); await B.tap('#night-confirm'); await B.wait_for_timeout(1500)
        print('B seer result:', await B.inner_text('.dock-result') if await B.query_selector('.dock-result') else await B.inner_text('.action-panel'))
        await B.screenshot(path=SHOT + 'B_seer.png')
        for _ in range(80):
            if await A.query_selector('#night-confirm'): break
            await A.wait_for_timeout(500)
        await A.click('.center-pick .btn >> nth=0'); await A.click('#night-confirm'); await A.wait_for_timeout(1200)
        await A.click('.tcard.is-pickable >> nth=1'); await A.click('#night-confirm'); await A.wait_for_timeout(800)
        print('A witch:', [x for x in (await A.inner_text('.action-panel')).split('\n') if x][-2:])
        await A.wait_for_selector('.day', timeout=90000); await B.wait_for_selector('.day', timeout=15000)
        await B.tap('.claim-btn[data-role="4"]'); await A.wait_for_timeout(1200)
        print('A sees B claim:', await A.evaluate("() => document.querySelector('.pcard[data-pseat=\"' + window.__onuw.engine.s.seats.findIndex(x => x.name === 'Peter') + '\"] .pcard-claim').innerText"))
        await B.tap('#chat-open'); await B.fill('#chat-input', 'I am the Seer'); await B.press('#chat-input', 'Enter')
        await A.wait_for_timeout(1000); await A.click('#chat-open')
        print('A chat has B line:', 'I am the Seer' in await A.inner_text('.chat-list'))
        await A.hover('.armory-tab'); await A.click('.armory-item.item-egg'); await A.click('.pcard[data-pseat="' + str(await A.evaluate("() => window.__onuw.engine.s.seats.findIndex(x => x.name === 'Peter')")) + '"]')
        await B.wait_for_selector('.fp-splat', timeout=5000); print('B got splatted (first-person)')
        await B.screenshot(path=SHOT + 'B_splat.png')
        await A.click('#start-vote'); await A.wait_for_selector('.ballot'); await B.wait_for_selector('.ballot', timeout=8000)
        await A.click('.ballot-card >> nth=0'); await A.click('#lock-vote')
        await B.tap('.ballot-card >> nth=0'); await B.tap('#lock-vote')
        await A.wait_for_selector('.end', timeout=40000); await B.wait_for_selector('.end', timeout=10000); await A.wait_for_timeout(800)
        ha, hb = await A.inner_text('.end-title'), await B.inner_text('.end-title')
        print('results  A:', ha, '| B:', hb)
        await B.screenshot(path=SHOT + 'B_end.png')
        await A.click('#play-again'); await B.wait_for_selector('.lobby', timeout=8000); print('B back in lobby')
        await B.reload(); await B.wait_for_selector('.lobby', timeout=25000); print('B resumed lobby after reload, seats:', await B.evaluate("() => document.querySelectorAll('.seat-row').length"))
        print('errors', errs[:10])
        await b.close()
asyncio.run(main())
