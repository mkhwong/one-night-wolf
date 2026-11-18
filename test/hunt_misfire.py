import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); h=await (await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)).new_page(); errs=[]
        h.on('pageerror',lambda e: errs.append(str(e)))
        await h.goto('http://127.0.0.1:8765/test.html'); await h.wait_for_timeout(500)
        await h.tap('#test-mode-btn'); await h.tap('#test-confirm'); await h.tap('#create-room')
        await h.fill('#player-name','Charis'); await h.press('#player-name','Enter'); await h.wait_for_selector('.room-code')
        await h.evaluate("() => window.__onuw.fillBots(5)"); await h.evaluate("() => window.__onuw.hostCfg({ pool: [12,6,0,0,2,14,14,4], tn: 6, dd: 120, hr: true }, true)")
        await h.tap('#start-game')
        # deal: me Hunter, then pretend a Robber took my card
        await h.evaluate("""() => { const s=window.__onuw.engine.s; const i=s.start.indexOf(12); if(i>0){ s.start[i]=s.start[0]; s.start[0]=12; }
          const j=s.start.indexOf(6); s.cards=s.start.slice(); if(j>0){ s.cards[0]=6; s.cards[j]=12; } else { s.cards[0]=14; } s.sq++; }""")
        await h.tap('#flip-card'); await h.tap('#ready-btn')
        await h.wait_for_selector('.day', timeout=90000); await h.wait_for_timeout(800)
        await h.tap('#hunt-btn'); await h.wait_for_selector('.hunt-overlay')
        await h.tap('.hunt-targets .btn >> nth=2'); await h.tap('#hunt-shoot'); await h.wait_for_timeout(300)
        print('warning shown:', await h.inner_text('.hunt-warn'))
        await h.screenshot(path='test/shots/hunt_confirm.png')
        await h.tap('#hunt-confirm'); await h.wait_for_selector('.end', timeout=8000); await h.wait_for_timeout(800)
        print('result:', (await h.inner_text('.end-title')).replace('\n',' '), '|', await h.inner_text('.end-how >> nth=0'))
        print('anyone dead:', await h.evaluate("() => document.querySelectorAll('.end-seat.is-dead').length"), 'errors', errs)
        await h.screenshot(path='test/shots/hunt_misfire_end.png')
        await b.close()
asyncio.run(main())
