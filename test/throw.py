import asyncio, sys
from playwright.async_api import async_playwright
SHOT = 'test/shots/t_'
async def run(pw, W, H, touch):
    tag = f'{W}'
    b = await pw.chromium.launch()
    ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2 if touch else 1, is_mobile=touch, has_touch=touch)
    h = await ctx.new_page(); errs = []; h.on('pageerror', lambda e: errs.append(str(e)))
    press = (lambda sel: h.tap(sel)) if touch else (lambda sel: h.click(sel))
    await h.goto('http://localhost:8765/test.html'); await h.wait_for_timeout(500)
    await press('#test-mode-btn'); await press('#test-confirm'); await press('#create-room')
    await h.fill('#player-name', 'Matt'); await h.press('#player-name', 'Enter')
    await h.wait_for_selector('.room-code'); await h.evaluate("() => window.__onuw.fillBots(6)")
    await press('#start-game'); await h.wait_for_timeout(300)
    await h.evaluate("() => { const e = window.__onuw.engine; e.s.ph = 'night'; e.s.ti = e.s.turns.length - 1; e.s.te = Date.now(); e.s.sq++; }")
    await h.wait_for_selector('.day', timeout=10000); await h.wait_for_timeout(600)
    if touch: await press('.armory-tab')
    else: await h.hover('.armory-tab')
    await h.wait_for_timeout(350)
    await press('.armory-item.item-tomato'); await h.wait_for_timeout(500)
    st = await h.evaluate("() => ({ banner: !!document.querySelector('.aim-banner'), targets: document.querySelectorAll('.pcard.is-target').length, badges: document.querySelectorAll('.pcard-aim').length, anim: getComputedStyle(document.querySelector('.pcard.is-target')).animationName, armed: !!document.querySelector('.armory-tab.is-armed') })")
    print(tag, 'armed state', st)
    await h.screenshot(path=SHOT + tag + '_aiming.png')
    # tap somewhere neutral: cancels
    await press('.day-title'); await h.wait_for_timeout(200)
    print(tag, 'after tapping elsewhere, still aiming:', await h.evaluate("() => !!document.querySelector('.is-aiming')"))
    # arm again and cancel with the armed button
    if touch: await press('.armory-tab')
    else: await h.hover('.armory-tab')
    await h.wait_for_timeout(300); await press('.armory-item.item-egg'); await h.wait_for_timeout(200)
    await press('.armory-tab'); await h.wait_for_timeout(200)
    print(tag, 'after tapping armed button, still aiming:', await h.evaluate("() => !!document.querySelector('.is-aiming')"))
    # arm and throw at a player
    if touch: await press('.armory-tab')
    else: await h.hover('.armory-tab')
    await h.wait_for_timeout(300); await press('.armory-item.item-poo'); await h.wait_for_timeout(600)
    await press('.pcard.is-target >> nth=1'); await h.wait_for_timeout(1300)
    await h.screenshot(path=SHOT + tag + '_thrown.png')
    print(tag, 'after throw, still aiming:', await h.evaluate("() => !!document.querySelector('.is-aiming')"), 'stains:', await h.evaluate("() => document.querySelectorAll('.stain').length"), 'errors', errs)
    await b.close()
async def main():
    async with async_playwright() as pw:
        await run(pw, 390, 844, True)
        await run(pw, 1280, 800, False)
asyncio.run(main())
