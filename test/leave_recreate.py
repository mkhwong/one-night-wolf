import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); p=await (await b.new_context(viewport={'width':1280,'height':820})).new_page()
        await p.goto('http://127.0.0.1:8765/test.html'); await p.click('#create-room')
        await p.fill('#player-name','Cosana'); await p.press('#player-name','Enter'); await p.wait_for_selector('.room-code')
        for i in range(5):
            await p.get_by_role('button', name='離開房間').click(); await p.wait_for_selector('#create-room')
            await p.click('#create-room'); await p.wait_for_selector('#player-name'); await p.press('#player-name','Enter'); await p.wait_for_timeout(2500)
            await p.screenshot(path=f'test/shots/leave_recreate_{i}.png'); print('round',i+1,'lobby shown:', await p.locator('.room-code').count()==1, '| blank status screen:', await p.locator('.status-panel').count()==1)
        await p.screenshot(path='test/shots/leave_recreate.png'); await b.close()
asyncio.run(main())
