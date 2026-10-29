import asyncio
from playwright.async_api import async_playwright
SHOT = 'test/shots/rg_'
async def run(pw, W, H, touch):
    tag = str(W)
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2 if touch else 1, is_mobile=touch, has_touch=touch)
    h = await ctx.new_page(); p = await ctx.new_page(); errs = []
    for pg in (h, p):
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: print('CONSOLE', m.type, m.text[:300]) if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'Failed to load' not in m.text else None)
    press = (lambda pg, sel: pg.tap(sel)) if touch else (lambda pg, sel: pg.click(sel))
    await h.goto('http://127.0.0.1:8765/test.html'); await h.wait_for_timeout(500)
    await press(h, '#test-mode-btn'); await press(h, '#test-confirm'); await press(h, '#create-room')
    await h.fill('#player-name', '馬修'); await h.press('#player-name', 'Enter'); await h.wait_for_selector('.room-code')
    code = (await h.inner_text('.room-code')).strip()
    await p.goto('http://127.0.0.1:8765/test.html'); await p.wait_for_timeout(400)
    await p.fill('#join-code', code); await p.press('#join-code', 'Enter'); await p.wait_for_selector('#player-name')
    await p.fill('#player-name', '彼得'); await p.press('#player-name', 'Enter'); await p.wait_for_selector('.room-code')
    await h.wait_for_timeout(1200); await h.evaluate("() => window.__onuw.fillBots(5)")
    await h.evaluate("() => window.__onuw.hostCfg({ pool: [16, 0, 0, 4, 6, 14, 14, 11], tn: 8, dd: 120 }, true)")
    await h.wait_for_timeout(300); await press(h, '#start-game')
    await h.evaluate("""() => { const s = window.__onuw.engine.s;
      const put = (seat, role) => { let i = s.start.indexOf(role); if (i === seat) return;
        if (i < 0) { const c = s.center.indexOf(role); s.center[c] = s.start[seat]; s.center0[c] = s.start[seat]; }
        else { s.start[i] = s.start[seat]; s.cards[i] = s.start[seat]; }
        s.start[seat] = role; s.cards[seat] = role; };
      put(0, 16); s.lastStart = s.start.slice(); s.sq++; }""")
    await h.wait_for_selector('#flip-card'); await press(h, '#flip-card'); await h.wait_for_timeout(800); await h.screenshot(path=SHOT + tag + '_reveal.png')
    await press(h, '#ready-btn'); await p.wait_for_selector('#flip-card'); await press(p, '#flip-card'); await press(p, '#ready-btn')
    for _ in range(150):
        if await h.query_selector('.theater-title') and '守夜鴉' in await h.inner_text('.theater-title') and await h.query_selector('.theater.is-mine'): break
        await h.wait_for_timeout(400)
    await h.wait_for_timeout(3400); await h.screenshot(path=SHOT + tag + '_raven_fly.png')
    await h.wait_for_timeout(1600); await h.screenshot(path=SHOT + tag + '_raven_count.png')
    real = await h.evaluate("() => window.__onuw.engine.s.cards.filter(r => r === 0 || r === 1 || r === 15).length")
    shown = await h.evaluate("() => document.querySelector('.raven-count')?.textContent")
    info = await h.evaluate("() => window.__onuw.v.priv.i.filter(i => i.k === 'cnt')")
    print(tag, 'raven count shown', shown, 'actual wolves in front of players', real, 'info', info)
    await h.wait_for_selector('.day', timeout=60000); await p.wait_for_selector('.day', timeout=10000); await h.wait_for_timeout(800)
    # host gives flowers to Peter (seat of 彼得)
    ps = await h.evaluate("() => window.__onuw.engine.s.seats.findIndex(x => x.name === '彼得')")
    if touch: await press(h, '.armory-tab')
    else: await h.hover('.armory-tab')
    await h.wait_for_timeout(350); await h.screenshot(path=SHOT + tag + '_tray.png')
    await press(h, '.armory-item.item-flower'); await h.wait_for_timeout(300)
    await press(h, f'.pcard[data-pseat="{ps}"]')
    await p.wait_for_selector('.gift', timeout=5000); await p.wait_for_timeout(1500)
    print(tag, 'receiver sees:', await p.inner_text('.gift-from'), '| splat shown instead?', bool(await p.query_selector('.fp-splat')))
    await p.screenshot(path=SHOT + tag + '_gift.png')
    await h.wait_for_timeout(900); print(tag, 'spectator bloom on card:', await h.evaluate(f"() => !!document.querySelector('.pcard[data-pseat=\"{ps}\"] .stain-flower')"))
    await h.screenshot(path=SHOT + tag + '_bloom.png')
    await press(p, '.gift-thanks'); await p.wait_for_timeout(200); print(tag, 'gift closed:', not await p.query_selector('.gift'))
    print(tag, 'scrollW', await p.evaluate('document.documentElement.scrollWidth'), 'errors', errs)
    await b.close()
async def main():
    async with async_playwright() as pw:
        await run(pw, 390, 844, True)
        await run(pw, 1280, 820, False)
asyncio.run(main())
