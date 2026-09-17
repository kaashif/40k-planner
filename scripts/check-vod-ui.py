"""Static-export UI smoke test. uv run --with playwright python scripts/check-vod-ui.py"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import os
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
out = root / ".cache/vod-ui"
out.mkdir(parents=True, exist_ok=True)

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/40k-planner/'):
            self.path = self.path[len('/40k-planner'):]
        super().do_GET()
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
        page.on('console', lambda message: print(message.text) if message.type == 'error' else None)
        page.goto(os.environ.get('VOD_TEST_URL', f'http://127.0.0.1:{server.server_port}/40k-planner/'), wait_until='networkidle')
        page.get_by_role('heading', name='Alex Fowler vs Frasier Parry', exact=True).wait_for()
        assert page.locator('.vod-moment').count() == 7
        assert page.locator('.vod-board').count() == 5
        assert page.locator('.vod-pin, .vod-takeaways, button, details').count() == 0
        assert page.locator('.vod-movement').count() >= 4
        assert page.locator('[id]').evaluate_all('(els) => new Set(els.map(e => e.id)).size === els.length')
        assert page.locator('img').evaluate_all('(images) => images.every(i => i.complete && i.naturalWidth > 0)')
        page.screenshot(path=str(out / 'desktop.png'), full_page=True)
        page.locator('#frame-4500').screenshot(path=str(out / 'movement.png'))
        page.set_viewport_size({"width":390,"height":844})
        page.screenshot(path=str(out / 'mobile.png'), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        page.get_by_role('link', name='Missions', exact=True).click()
        page.get_by_role('heading', name='40k 11th edition missions', exact=True).wait_for()
        assert '/40k-planner/missions/' in page.url
        assert not errors, errors
        browser.close()
        print('PASS: desktop/mobile, 7 visible frames, 5 diagrams, movement arrows, unique SVG IDs, no overlays/controls, images, navigation, no JS errors')
finally:
    server.shutdown()
