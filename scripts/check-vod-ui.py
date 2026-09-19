"""Static-export UI smoke test. uv run --with playwright python scripts/check-vod-ui.py"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import os
import json
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
out = root / ".cache/vod-ui"
out.mkdir(parents=True, exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/40k-planner/'):
            self.path = self.path[len('/40k-planner'):]
        try:
            super().do_GET()
        except (BrokenPipeError, ConnectionResetError):
            pass  # Browser navigation can cancel an in-flight prefetch.
    def do_HEAD(self):
        if self.path.startswith('/40k-planner/'):
            self.path = self.path[len('/40k-planner'):]
        super().do_HEAD()
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(root / 'out')))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('VOD_TEST_BROWSER'))
        page = browser.new_page(viewport={"width":1440,"height":1100}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda error: errors.append(f'{page.url}: {error}'))
        page.on('response', lambda response: errors.append(f'HTTP {response.status}: {response.url}') if response.status >= 400 else None)
        page.goto(os.environ.get('VOD_TEST_URL', f'http://127.0.0.1:{server.server_port}/40k-planner/'), wait_until='networkidle')
        page.get_by_role('heading', name='Grand Coven · Magnus', exact=True).wait_for()
        games = [json.loads(path.read_text()) for path in sorted((root / 'public/vod').glob('*/game.json'))]
        assert page.locator('.vod-game-table tbody tr').count() == len(games)
        assert '1 on-board · 1 in reserve' in page.locator('.vod-reserve-summary').inner_text()
        page.screenshot(path=str(out / 'desktop.png'), full_page=True)
        assert page.locator('.vod-game-table .vod-board').count() == len(games)
        assert 'Unknown' in page.locator('#yarin-iyer').inner_text()
        assert 'explicitly declared' in page.locator('#fowler-power').inner_text()
        assert page.locator('[id]').evaluate_all('(els) => new Set(els.map(e => e.id)).size === els.length')
        assert page.locator('.vod-game-table .vod-board circle[stroke="#f8a5c5"]').count() == 0
        index_url = page.url
        for game in games:
            page.set_viewport_size({"width":1440,"height":1100})
            page.goto(index_url + 'vod/' + game['id'] + '/', wait_until='networkidle')
            assert page.locator('.vod-game').count() == 1
            assert page.locator('.vod-moment').count() == len(game['frames'])
            assert page.locator('.vod-reserves').count() == 1
            assert page.locator('button, details').count() == 0
            assert page.locator('[id]').evaluate_all('(els) => new Set(els.map(e => e.id)).size === els.length')
            assert page.locator('img').evaluate_all('(images) => images.every(i => i.complete && i.naturalWidth > 0)')
            if game.get('analysis'):
                assert page.locator('.vod-review-text h3').count() == len(game['analysis'])
            first_board = next(f for f in game['frames'] if 'board' in f)
            page.locator(f"#{game['id']}-{first_board['second']}").screenshot(path=str(out / f"{game['id']}.png"))
            page.screenshot(path=str(out / f"{game['id']}-page.png"), full_page=False)
            page.set_viewport_size({"width":390,"height":844})
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            page.screenshot(path=str(out / f"{game['id']}-mobile.png"))
            page.get_by_role('link', name='← All game analyses', exact=True).click()
            page.get_by_role('heading', name='Grand Coven · Magnus', exact=True).wait_for()
        page.screenshot(path=str(out / 'mobile.png'), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        page.goto(index_url+'matchups/world-eaters/', wait_until='networkidle')
        assert page.locator('svg[role="img"]').count() == 3
        assert '27.8%' in page.get_by_role('status').inner_text()
        page.get_by_label('Re-roll a failed charge roll').check()
        assert '47.8%' in page.get_by_role('status').inner_text()
        page.get_by_label('Initial base-to-base gap').fill('27')
        assert 'no direct charge' in page.get_by_role('status').inner_text()
        page.get_by_role('combobox').select_option('eightbound')
        assert '30.6%' in page.get_by_role('status').inner_text()
        page.get_by_label('Initial base-to-base gap').fill('29')
        assert 'no direct charge' in page.get_by_role('status').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        page.screenshot(path=str(out / 'world-eaters-mobile.png'))
        page.set_viewport_size({"width":1440,"height":1100})
        for variant in 'abc':
            page.locator('#layout-'+variant).screenshot(path=str(out / ('deployment-'+variant+'.png')))
        for slug in ['screen-shape','angron-landings','after-the-screen-dies']:
            page.goto(index_url+'tactics/screening/'+slug+'/', wait_until='networkidle')
            assert page.locator('svg[role="img"]').count() == 2
            assert page.locator('details').count() == 0
            assert page.locator('[id]').evaluate_all('(els) => new Set(els.map(e => e.id)).size === els.length')
            page.locator('.screen-example').first.screenshot(path=str(out / ('screening-'+slug+'.png')))
            page.set_viewport_size({"width":390,"height":844})
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            page.set_viewport_size({"width":1440,"height":1100})
        page.goto(index_url, wait_until='networkidle')
        page.get_by_role('link', name='Missions' , exact=True).click()
        page.get_by_role('heading', name='40k 11th edition missions', exact=True).wait_for()
        assert '/40k-planner/missions/' in page.url
        assert not errors, errors
        browser.close()
        print('PASS: desktop/mobile, game pages, deployment maps, charge probabilities, screening diagrams, links, unique IDs, images, no HTTP or JS errors')
finally:
    server.shutdown()
