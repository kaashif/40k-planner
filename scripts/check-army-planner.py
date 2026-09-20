"""uv run --with playwright python scripts/check-army-planner.py"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json, os, threading
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/40k-planner/'): self.path=self.path[len('/40k-planner'):]
        try: super().do_GET()
        except (BrokenPipeError,ConnectionResetError): pass
    def do_HEAD(self):
        if self.path.startswith('/40k-planner/'): self.path=self.path[len('/40k-planner'):]
        super().do_HEAD()
    def log_message(self,*_): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(root/'out')))
threading.Thread(target=server.serve_forever,daemon=True).start()
out=root/'.cache/army-planner';out.mkdir(parents=True,exist_ok=True)
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('VOD_TEST_BROWSER'))
        page=browser.new_page(viewport={'width':1440,'height':1100})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('response',lambda r:errors.append(f'{r.status}: {r.url}') if r.status>=400 else None)
        origin=f'http://127.0.0.1:{server.server_port}/40k-planner/'
        page.goto(origin+'planner/',wait_until='networkidle')
        assert page.locator('.base-marker').count()==0
        assert page.locator('.army-roster-unit').count()==14
        assert page.get_by_label('Army',exact=True).input_value()=='thousand-sons'
        assert '46 army models not placed' in page.locator('.army-warning').inner_text()
        scarabs=page.get_by_label('Deep strike Scarab Occult Terminators',exact=True)
        leader=page.get_by_label('Deep strike Terminator Sorcerer · Umbralefic Crystal',exact=True)
        prince=page.get_by_label('Deep strike Winged Daemon Prince · Eldritch Vortex of E’Taph',exact=True)
        scarabs.check();prince.check()
        assert leader.is_checked()
        assert page.get_by_role('button',name='Add Scarab Occult Terminators',exact=True).is_disabled()
        assert page.locator('.base-marker').count()==0
        assert '12 in deep strike' in page.locator('.deep-strike-status').inner_text()
        for name in ['Magnus the Red','Exalted Sorcerer on Disc · Incandaeum','Bow Enlightened']:
            page.get_by_role('button',name='Add '+name,exact=True).click()
        assert page.locator('.base-marker').count()==5
        disc=page.get_by_label('Deep strike Exalted Sorcerer on Disc · Incandaeum',exact=True)
        disc.check()
        assert page.get_by_role('button',name='Bow Enlightened, 40mm, blue',exact=True).count()==3
        assert '13 in deep strike' in page.locator('.deep-strike-status').inner_text()
        disc.uncheck()
        page.get_by_role('button',name='Add Exalted Sorcerer on Disc · Incandaeum',exact=True).click()
        leader.uncheck();assert not scarabs.is_checked();leader.check();assert scarabs.is_checked()
        key='deployment-planner:v3:thousand-sons:purge-the-foe-vs-priority-assets-a'
        page.reload(wait_until='networkidle')
        assert page.locator('.base-marker').count()==5
        assert '12 in deep strike' in page.locator('.deep-strike-status').inner_text()
        assert page.locator('.deep-strike-list').count()==0
        assert page.locator('.army-roster').evaluate('(e)=>e.scrollHeight <= e.clientHeight+1')
        assert page.locator('.planner-context-row select[aria-label="Army"]').count()==1
        assert page.locator('.army-sidebar-title,.planner-roster-note').count()==0
        for width,height in [(1440,1100),(1366,768)]:
            page.set_viewport_size({'width':width,'height':height})
            assert page.evaluate('document.documentElement.scrollHeight <= innerHeight'), (width,height)
            assert page.locator('.army-roster').evaluate('(e)=>e.scrollHeight <= e.clientHeight+1')
            for control in page.locator('.army-roster button,.army-roster input').all():
                bounds=control.bounding_box()
                assert bounds['y']>=0 and bounds['y']+bounds['height']<=height
            page.screenshot(path=str(out/f'roster-{width}.png'))
        page.set_viewport_size({'width':1440,'height':1100})
        saved=page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',key)
        page.get_by_label('Army',exact=True).select_option('necrons')
        page.wait_for_function('document.querySelectorAll(".army-roster-unit").length === 12 && document.querySelectorAll(".base-marker").length === 0')
        assert page.locator('.base-marker').count()==0
        page.get_by_label('Army',exact=True).select_option('thousand-sons')
        page.wait_for_function('document.querySelectorAll(".base-marker").length === 5')
        restored=page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',key)
        assert restored['markers']==saved['markers'] and restored['deepStrikeMarkers']==saved['deepStrikeMarkers']
        page.get_by_role('button',name='Enemy models',exact=True).click()
        for opponent in ['joe','zak']:
            page.get_by_label('Opponent list',exact=True).select_option(opponent)
            page.set_viewport_size({'width':1366,'height':768})
            page.screenshot(path=str(out/f'opponent-{opponent}.png'))
            assert page.locator('.opponent-roster').evaluate('(e)=>e.scrollHeight <= e.clientHeight+1')
            for control in page.locator('.opponent-roster button,.opponent-roster input').all():
                bounds=control.bounding_box()
                assert bounds['y']>=0 and bounds['y']+bounds['height']<=768
        page.get_by_label('Opponent list',exact=True).select_option('joe')
        page.set_viewport_size({'width':1440,'height':1100})
        page.get_by_role('button',name='Add Angron',exact=True).click()
        assert page.locator('.base-marker.red').count()==1
        page.get_by_role('button',name='Threat ranges',exact=True).click()
        assert 'Charge threat 26″' in page.locator('.threat-results').inner_text()
        page.get_by_label('Include Advance',exact=True).check()
        assert 'Advance 20″' in page.locator('.threat-results').inner_text()
        assert 'Charge threat 26″' in page.locator('.threat-results').inner_text()
        page.get_by_label('Advance and charge permitted',exact=True).check()
        assert 'Charge threat 32″' in page.locator('.threat-results').inner_text()
        page.get_by_label('Advance and charge permitted',exact=True).uncheck()
        assert page.locator('.threat-overlay path').count()==6
        page.get_by_label('Plan name',exact=True).fill('PA A with Angron')
        page.get_by_role('button',name='Save new plan',exact=True).click()
        assert 'Saved PA A with Angron' in page.locator('.plan-manager-message').inner_text()
        with page.expect_download() as event:
            page.get_by_role('button',name='Export JSON',exact=True).click()
        download=event.value
        download.save_as(out/'export.json')
        exported=json.loads((out/'export.json').read_text())
        assert sum(m['side']=='red' for m in exported['markers'])==1
        assert len(exported['deepStrikeMarkers'])==12
        page.screenshot(path=str(out/'threat-planner.png'),full_page=True)
        page.get_by_label('Layout',exact=True).select_option('B')
        page.wait_for_url('**layout=purge-the-foe-vs-priority-assets-b**')
        page.get_by_role('button',name='Load saved plan',exact=True).click()
        page.wait_for_url('**layout=purge-the-foe-vs-priority-assets-a**plan=**')
        page.wait_for_function('document.querySelectorAll(".base-marker.red").length === 1')
        assert page.locator('.base-marker').count()==6
        page.get_by_label('Import deployment JSON',exact=True).set_input_files(out/'export.json')
        page.wait_for_function('document.querySelector(".plan-manager-message").textContent.includes("Imported")')
        assert page.locator('.base-marker.red').count()==1
        page.get_by_role('button',name='Angron, 100mm, red',exact=True).click()
        page.screenshot(path=str(out/'desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(out/'mobile.png'),full_page=True)
        if not page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'):
            print(page.evaluate('''Array.from(document.querySelectorAll("body *")).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.getBoundingClientRect().width]).slice(0,30)'''))
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        page.goto(origin+'plans/',wait_until='networkidle')
        assert page.get_by_label('Army',exact=True).input_value()=='thousand-sons'
        assert '2 layouts saved locally' in page.locator('.plan-library-summary').inner_text()
        page.get_by_label('Army',exact=True).select_option('necrons')
        assert '1 layouts saved locally' in page.locator('.plan-library-summary').inner_text()
        assert page.locator('.named-plan-library li').count()==2
        page.goto(origin,wait_until='networkidle')
        assert page.locator('.tool-directory a').count()==9
        assert page.locator('.vod-game-table tbody tr').count()==5
        page.screenshot(path=str(out/'homepage.png'),full_page=True)
        page.goto(origin+'threat-ranges/',wait_until='networkidle')
        assert 'Charge threat 26″' in page.locator('.threat-results').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        page.get_by_label('Threat unit',exact=True).select_option('joe:spawn')
        assert 'Max charge: 36″' in page.locator('.threat-legend').inner_text()
        page.set_viewport_size({'width':1440,'height':1100})
        page.goto(origin+'planner/',wait_until='networkidle')
        page.get_by_role('button',name='Reset army off board',exact=True).click()
        page.get_by_role('button',name='Enemy models',exact=True).click()
        enemy_reserve=page.get_by_label('Deep strike Slaughterbound with Battle-lust + 3 Exalted Eightbound',exact=True)
        enemy_reserve.check()
        assert page.locator('.base-marker.red').count()==1
        assert '4 in deep strike' in page.locator('.deep-strike-status').inner_text()
        enemy_reserve.uncheck()
        page.get_by_role('button',name='Add whole opponent list',exact=True).click()
        assert page.locator('.base-marker.red').count()==59
        page.get_by_role('button',name='Add whole opponent list',exact=True).click()
        assert page.locator('.base-marker.red').count()==59
        page.get_by_role('button',name='Slaughterbound, 50mm, red',exact=True).first.click()
        if page.get_by_role('button',name='Threat ranges',exact=True).get_attribute('aria-pressed')!='true':page.get_by_role('button',name='Threat ranges',exact=True).click()
        page.get_by_label('Unbridled Bloodlust active:',exact=False).check()
        assert '50% charge: 20″' in page.locator('.threat-legend').inner_text()
        assert '80% charge: 19″' in page.locator('.threat-legend').inner_text()
        page.get_by_label('Opponent list',exact=True).select_option('zak')
        page.get_by_label('Rangers include one arquebus',exact=True).check()
        page.get_by_role('button',name='Add whole opponent list',exact=True).click()
        assert page.locator('.base-marker.red').count()==97
        assert page.get_by_role('button',name='Ranger with arquebus, 60×35.5mm, red',exact=True).count()==1
        page.get_by_role('button',name='Kastelan Robot, 60mm, red',exact=True).first.click()
        page.get_by_label('Motive Imperative',exact=False).check()
        assert 'Max charge: 23″' in page.locator('.threat-legend').inner_text()
        assert 'Max advance: 18″' in page.locator('.threat-legend').inner_text()
        page.get_by_role('button',name='Pivot sight line',exact=True).click()
        board=page.locator('.battlefield');board.scroll_into_view_if_needed();rect=board.bounding_box()
        x,y=rect['x']+rect['width']*.5,rect['y']+rect['height']*.5
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+100,y+70,steps=10);page.mouse.up()
        assert page.locator('[data-pivot]').count()==1
        before=page.locator('[data-pivot] circle').get_attribute('cx')
        page.mouse.move(x+80,y);page.mouse.down();page.mouse.move(x,y+100,steps=10);page.mouse.up()
        assert page.locator('[data-pivot] circle').get_attribute('cx')==before
        line=page.locator('[data-pivot] line');assert abs(float(line.get_attribute('x1'))-float(line.get_attribute('x2')))<.05
        page.get_by_label('Plan name',exact=True).fill('Both enemies with pivot')
        page.get_by_role('button',name='Save new plan',exact=True).click()
        page.reload(wait_until='networkidle')
        assert page.locator('[data-pivot]').count()==1
        assert page.locator('.base-marker.red').count()==97
        assert 'Max charge: 23″' in page.locator('.threat-legend').inner_text()
        page.screenshot(path=str(out/'opponents-pivot.png'),full_page=True)
        # Upgrade an old auto-draft, with both bow units and the incorrect attached Disc.
        legacy={'markers':[], 'deepStrikeMarkers':[], 'markupPaths':[], 'sightLines':[], 'planName':'Legacy test'}
        for i in range(7):
            unit='ts-disc' if i==0 else 'ts-bows-1' if i<4 else 'ts-bows-2'
            legacy['markers'].append({'id':i+1,'x':.2+i*.06,'y':.5,'widthMm':40,'heightMm':40,'side':'blue','label':'Disc' if i==0 else 'Bow','rosterUnitId':unit,'unitId':'ts-bows-1' if i<4 else 'ts-bows-2','moveInches':10})
        page.evaluate('(v)=>localStorage.setItem(v.key,JSON.stringify(v.data))',{'key':key,'data':legacy})
        page.reload(wait_until='networkidle')
        assert page.locator('.base-marker').count()==4
        fixed=page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',key)
        assert fixed['rosterRevision']==2
        assert fixed['markers'][0]['unitId']=='ts-disc'
        assert sum(m['rosterUnitId']=='ts-bows-2' for m in fixed['markers'])==3
        page.get_by_role('button',name='Reset army off board',exact=True).click()
        assert page.locator('.base-marker').count()==0
        # Persistent measured arrows use board inches, including at resized viewports.
        for width,height,color in [(1440,1100,'#00ffff'),(1366,768,'#ff33cc')]:
            page.set_viewport_size({'width':width,'height':height})
            page.get_by_label('Markup colour',exact=True).fill(color)
            if page.get_by_role('button',name='Arrow',exact=True).get_attribute('aria-pressed')!='true':
                page.get_by_role('button',name='Arrow',exact=True).click()
            rect=page.locator('.battlefield').bounding_box()
            x,y=rect['x']+rect['width']*(.3 if color=='#00ffff' else .5),rect['y']+rect['height']*.3
            page.mouse.move(x,y);page.mouse.down()
            page.mouse.move(x+rect['width']*3/44,y+rect['height']*4/60,steps=10);page.mouse.up()
            arrow=page.locator('.measured-arrow').last
            assert arrow.get_attribute('data-length')=='5.0'
            assert arrow.locator('text').text_content()=='5.0″'
            assert arrow.locator('polygon').get_attribute('fill')==color
        page.get_by_label('Plan name',exact=True).fill('Measured arrows')
        page.get_by_role('button',name='Save new plan',exact=True).click()
        page.reload(wait_until='networkidle')
        assert page.locator('.measured-arrow').count()==2
        page.screenshot(path=str(out/'measured-arrows.png'))
        page.get_by_role('button',name='Undo ink',exact=True).click()
        assert page.locator('.measured-arrow').count()==1
        page.get_by_role('button',name='Clear ink',exact=True).click()
        assert page.locator('.measured-arrow').count()==0
        arrow_save=page.locator('.plan-manager select option').filter(has_text='Measured arrows').get_attribute('value')
        page.locator('.plan-manager select').select_option(arrow_save)
        page.get_by_role('button',name='Load saved plan',exact=True).click()
        page.wait_for_function('document.querySelectorAll(".measured-arrow").length === 2')
        with page.expect_download() as event:
            page.get_by_role('button',name='Export JSON',exact=True).click()
        event.value.save_as(out/'arrows.json')
        page.get_by_role('button',name='Clear ink',exact=True).click()
        page.get_by_label('Import deployment JSON',exact=True).set_input_files(out/'arrows.json')
        page.wait_for_function('document.querySelectorAll(".measured-arrow").length === 2')
        assert not errors,errors
        browser.close()
        print('PASS: corrected roster/migration, empty board, inline reserves, no-scroll roster, opponents, rules, pivots, measured arrows and saved plans')
finally: server.shutdown()
