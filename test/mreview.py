import asyncio, sys
from playwright.async_api import async_playwright
W = int(sys.argv[1]) if len(sys.argv) > 1 else 360
H = int(sys.argv[2]) if len(sys.argv) > 2 else 740
SHOT = f'test/shots/r{W}_'
errs = []
AUDIT = """() => {
  const vw = innerWidth, out = { overflow: [], small: [], scrollW: document.documentElement.scrollWidth };
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e);
    if (r.right > vw + 1 && cs.position !== 'fixed' && !e.closest('.hscroll,.armory,.lineup,.theater,.fp-splat')) out.overflow.push(e.className.toString().slice(0, 30));
    if ((e.tagName === 'BUTTON' || e.tagName === 'SELECT' || e.tagName === 'INPUT') && !e.disabled && cs.visibility !== 'hidden' && (r.height < 30 || r.width < 30) && r.bottom > 0 && r.top < innerHeight) out.small.push((e.className.toString() || e.tagName).slice(0, 24) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  out.overflow = [...new Set(out.overflow)].slice(0, 6); out.small = [...new Set(out.small)].slice(0, 8);
  return out;
}"""
async def audit(p, tag): print(tag, await p.evaluate(AUDIT))
async def shot(p, name, full=False): await p.screenshot(path=SHOT + name + '.png', full_page=full)
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, is_mobile=True, has_touch=True)
        h = await ctx.new_page(); h.on('pageerror', lambda e: errs.append('h ' + str(e)))
        await h.goto('http://localhost:8765/test.html'); await h.wait_for_timeout(700)
        await audit(h, 'home'); await shot(h, '01_home'); await shot(h, '01b_home_full', True)
        await h.tap('#test-mode-btn'); await h.wait_for_timeout(200); await shot(h, '02_testmodal'); await h.tap('#test-confirm')
        await h.tap('#create-room'); await h.wait_for_selector('#player-name'); await h.wait_for_timeout(300)
        await shot(h, '03_name'); await h.fill('#player-name', '馬修'); await h.tap('text=進入村莊')
        await h.wait_for_selector('.room-code')
        code = (await h.inner_text('.room-code')).strip()
        p = await ctx.new_page(); p.on('pageerror', lambda e: errs.append('p ' + str(e)))
        await p.goto('http://localhost:8765/test.html'); await p.wait_for_timeout(500)
        await p.fill('#join-code', code); await p.tap('text=加入 >> nth=-1')
        await p.wait_for_selector('#player-name'); await p.fill('#player-name', '彼得'); await p.press('#player-name', 'Enter')
        await p.wait_for_selector('.room-code'); await h.wait_for_timeout(1200)
        await h.tap('text=補滿至 5 人'); await h.wait_for_timeout(300)
        await h.evaluate("() => window.__onuw.hostCfg({ pool: [0,0,4,6,7,8,14,11], tn: 12, dd: 180 }, true)")
        await h.wait_for_timeout(400)
        await audit(h, 'lobby'); await shot(h, '04_lobby'); await shot(h, '04b_lobby_full', True); await shot(p, '04c_lobby_player_full', True)
        await h.tap('#start-game')
        await h.evaluate("""() => { const s = window.__onuw.engine.s;
          const put = (seat, role) => { let i = s.start.indexOf(role);
            if (i === seat) return;
            if (i < 0) { const c = s.center.indexOf(role); s.center[c] = s.start[seat]; s.center0[c] = s.start[seat]; }
            else { s.start[i] = s.start[seat]; s.cards[i] = s.start[seat]; }
            s.start[seat] = role; s.cards[seat] = role; };
          put(0, 6); put(1, 7); s.lastStart = s.start.slice(); s.sq++; }""")
        await h.wait_for_selector('#flip-card'); await p.wait_for_selector('#flip-card')
        await shot(h, '05_reveal_back'); await h.tap('#flip-card'); await p.tap('#flip-card'); await h.wait_for_timeout(900)
        await audit(h, 'reveal'); await shot(h, '05b_reveal')
        await h.tap('#ready-btn'); await p.tap('#ready-btn')
        await h.wait_for_selector('.night'); await h.wait_for_timeout(1200); await shot(h, '06_night_intro')
        # wait for robber turn on host
        for _ in range(120):
            if await h.query_selector('#night-confirm'): break
            await h.wait_for_timeout(500)
        await h.wait_for_timeout(300); await audit(h, 'night-robber'); await shot(h, '07_robber_turn'); await shot(h, '07b_robber_full', True)
        await h.tap('.tcard.is-pickable >> nth=0'); await h.wait_for_timeout(200); await shot(h, '07c_robber_picked')
        await h.tap('#night-confirm'); await h.wait_for_timeout(450); await shot(h, '07d_robber_anim')
        await h.wait_for_timeout(1200); await shot(h, '07e_robber_result'); await shot(h, '07f_robber_result_full', True)
        # witch on p2
        for _ in range(60):
            if await p.query_selector('#night-confirm'): break
            await p.wait_for_timeout(500)
        await p.wait_for_timeout(300); await shot(p, '08_witch_turn')
        await p.tap('.center-pick .btn >> nth=1'); await p.tap('#night-confirm'); await p.wait_for_timeout(1500)
        await shot(p, '08b_witch_peeked', True)
        await p.tap('.tcard.is-pickable >> nth=0'); await p.tap('#night-confirm'); await p.wait_for_timeout(1500)
        await shot(p, '08c_witch_done')
        await h.wait_for_selector('.day', timeout=120000); await p.wait_for_selector('.day', timeout=20000); await h.wait_for_timeout(6000)
        await audit(h, 'day'); await shot(h, '09_day_top'); await shot(h, '09b_day_full', True)
        await h.tap('.claim-btn >> nth=2'); await h.wait_for_timeout(250); await shot(h, '09c_claim_toast')
        await h.select_option('#mk-s-1', '4'); await h.tap('.pcard[data-pseat="1"] .pin >> nth=2')
        await h.fill('#mk-s-1-n', '說自己是女巫，但很可疑'); await h.wait_for_timeout(200)
        el = await h.query_selector('.pcard[data-pseat="1"]'); await el.scroll_into_view_if_needed(); await shot(h, '09d_player_card')
        cb = await h.query_selector('.center-box'); await cb.scroll_into_view_if_needed(); await h.wait_for_timeout(200); await shot(h, '09e_center_boxes')
        await h.tap('#chat-open'); await h.fill('#chat-input', '我是強盜，我搶了 Rowan'); await h.press('#chat-input', 'Enter'); await h.wait_for_timeout(300)
        await audit(h, 'chat'); await shot(h, '10_chat'); await h.tap('text=收起')
        await h.tap('.armory-tab'); await h.wait_for_timeout(350); await shot(h, '11_armory')
        await h.tap('.armory-item.item-poo'); await h.wait_for_timeout(450); await shot(h, '11b_aim')
        print('flashing icons', await h.evaluate("() => document.querySelectorAll('.pcard-aim').length"), 'banner', await h.evaluate("() => !!document.querySelector('.aim-banner')"))
        await h.tap('.pcard[data-pseat="1"]'); await p.wait_for_timeout(900); await shot(p, '11c_splat_on_player')
        await h.wait_for_timeout(400); await shot(h, '11d_after_throw')
        await h.evaluate("() => window.scrollTo(0,0)"); await h.tap('#start-vote')
        await h.wait_for_selector('.ballot'); await h.wait_for_timeout(500); await audit(h, 'vote'); await shot(h, '12_vote'); await shot(h, '12b_vote_full', True)
        await h.tap('.ballot-card >> nth=0'); await h.tap('#lock-vote'); await shot(h, '12c_vote_locked')
        await p.wait_for_selector('.ballot'); await p.tap('.ballot-peace'); await p.tap('#lock-vote')
        await h.wait_for_selector('.end', timeout=60000); await h.wait_for_timeout(1500)
        await audit(h, 'end'); await shot(h, '13_end'); await shot(h, '13b_end_full', True)
        await h.tap('#test-mode-btn'); await h.wait_for_timeout(200)
        await h.keyboard.press('Escape')
        await h.tap('button[aria-label="規則"]'); await h.wait_for_timeout(300); await shot(h, '14_rules')
        print('errors', errs)
        await b.close()
asyncio.run(main())
