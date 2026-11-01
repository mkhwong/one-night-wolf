import asyncio
from playwright.async_api import async_playwright
SHOT='test/shots/clip_'
async def run(pw, W, H, touch):
    tag=str(W); b=await pw.chromium.launch(); errs=[]
    h=await (await b.new_context(viewport={'width':W,'height':H},is_mobile=touch,has_touch=touch,device_scale_factor=2 if touch else 1)).new_page()
    h.on('pageerror',lambda e: errs.append(str(e)))
    print(tag,'h264 support:',await h.evaluate("() => document.createElement('video').canPlayType('video/mp4; codecs=\"avc1.640028\"')") if False else '')
    await h.goto('http://127.0.0.1:8765/test.html'); await h.wait_for_timeout(400)
    print(tag,'canPlay mp4:', await h.evaluate("() => document.createElement('video').canPlayType('video/mp4; codecs=\"avc1.64001f\"')"))
    c=lambda s: h.tap(s) if touch else h.click(s)
    await c('#test-mode-btn'); await c('#test-confirm'); await c('#create-room')
    await h.fill('#player-name','M'); await h.press('#player-name','Enter'); await h.wait_for_selector('.room-code')
    await h.evaluate("() => window.__onuw.fillBots(6)")
    await h.evaluate("() => window.__onuw.hostCfg({ pool: [0,15,4,6,8,11,10,16,14], tn: 6, dd: 120 }, true)")
    await c('#start-game'); await c('#flip-card'); await c('#ready-btn')
    seen=set()
    for _ in range(160):
        if await h.query_selector('.day'): break
        t=await h.query_selector('.theater-title')
        if t:
            name=(await t.inner_text()).split('\n')[0]
            if name not in seen and await h.query_selector('.theater-clip video, .theater-hero'):
                await h.wait_for_timeout(1800); seen.add(name)
                st=await h.evaluate("() => { const v=document.querySelector('.theater-clip video'); return v ? {src:v.currentSrc.split('/').pop(), t:+v.currentTime.toFixed(2), ready:v.readyState, err:!!v.error} : 'still art' }")
                print(tag, name, st)
                if name in ('狼人','預言家','搗蛋鬼','守夜鴉'): await h.screenshot(path=f'{SHOT}{tag}_{name}.png')
        await h.wait_for_timeout(400)
    print(tag,'errors',errs); await b.close()
async def main():
    async with async_playwright() as pw:
        await run(pw,1280,820,False); await run(pw,390,844,True)
asyncio.run(main())
