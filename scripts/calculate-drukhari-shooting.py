"""Exact finite-state shooting distributions. Run: uv run python scripts/calculate-drukhari-shooting.py
Profiles reviewed 2026-09-26 (11e); see generated JSON sources and assumptions.
Normal and devastating damage never spill between models. Infantry columns stop at
bodyguard removal, not attached-character death. Fixed allocation: 1W Incubi first.
"""
from collections import defaultdict
from functools import lru_cache
from math import comb
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def dice(n, sides, bonus=0):
    p = {bonus: 1.0}
    for _ in range(n):
        q = defaultdict(float)
        for x, v in p.items():
            for d in range(1, sides+1): q[x+d] += v/sides
        p = dict(q)
    return p

def fixed(n): return {n: 1.0}

def weapon(name, attacks, bs, strength, ap, damage=1, **kw):
    return dict(name=name, attacks=fixed(attacks) if isinstance(attacks,int) else attacks,
                bs=bs, strength=strength, ap=ap, damage=fixed(damage) if isinstance(damage,int) else damage, **kw)

TARGETS = [
 dict(id='venom',name='Venom',t=6,sv=4,inv=6,hp=[6],stealth=True),
 dict(id='raider',name='Raider',t=8,sv=4,inv=6,hp=[10]),
 dict(id='ravager',name='Ravager',t=9,sv=4,inv=6,hp=[11]),
 dict(id='cronos',name='Cronos',t=7,sv=3,inv=6,hp=[7],fnp=5),
 dict(id='scourges',name='5 Scourges',t=3,sv=4,inv=5,hp=[1]*5,inf=True),
 dict(id='wyches',name='10 Wych bodyguards',t=3,sv=6,inv=6,hp=[1]*10,inf=True,character=True),
 dict(id='incubi5',name='5 Incubi bodyguards',t=3,sv=3,inv=5,hp=[1]*4+[2],inf=True,character=True),
 dict(id='incubi10',name='10 Incubi bodyguards',t=3,sv=3,inv=5,hp=[1]*9+[2],inf=True,character=True),
]
for t in TARGETS: t['vehicle'] = t['id'] in ['venom','raider','ravager']; t['monster'] = t['id']=='cronos'

def magnus(burst=False):
    buffs=dict(hit_rr='all',wound_rr='all',wound_mod=1) if burst else {}
    return [weapon('Firestorm',dice(1,6,3),2,6,1,2,psychic=True,blast=True,ignore=True,**buffs),
            weapon('Gaze',dice(3,3),2,11,2,3,psychic=True,dev=True,**buffs)]

def scarabs(close=True):
    common=dict(lethal=True,hit_mod=1)
    return [weapon('9 combi-bolters (8 bodyguard + leader)',36 if close else 18,3,4,2,**common),
            weapon('2 soulreapers',12,3,6,2,dev=True,**common),
            weapon('2 missile racks',4,3,10,2,3,**common),
            weapon('Malefic Curse',3,3,4,3,dev=True,anti_inf=4,psychic=True,**common),
            weapon('Gaze of Hate',3,3,4,3,2,dev=True,anti_vehicle=4,anti_monster=4,psychic=True,**common)]

def rubrics(objective=False,burst=False):
    c=dict(lethal=True,wound_rr='all' if objective else 'ones')
    return [weapon('3 warpflamers',dice(3,6),0,4,1,ignore=True,**c),
            weapon('Soulreaper',6,3,6,2,dev=True,ignore=True,**c),
            weapon('Malefic Curse (not pistol)',3,3,4,3,dev=True,anti_inf=4,psychic=True,ignore=True,**c),
            weapon('Pandaemonic Delusion (not pistol)',9 if burst else 6,3,8 if burst else 5,1,sustained=3,psychic=True,**c)]

def robots(melta=False):
    return [weapon('2 heavy warpflamers',dice(2,6),0,5,2,ignore=True),
            weapon('2 missile racks',4,4,10,2,3),
            weapon('2 meltaguns',2,4,10,4,dice(1,6,2 if melta else 0))]

ROWS = [
 dict(id='magnus',name='Magnus',range='≤24″',weapons=magnus(),note='Both guns; no ritual, stratagem or offensive Kindred Sorcery.'),
 dict(id='magnus-burst',name='Magnus · Maelstrom + Devastating Sorcery',range='≤24″',weapons=magnus(True),note='Psychic +1 to wound and full hit/wound rerolls (failed rolls rerolled). 2CP, or 3CP if Egotistical Power is needed to select/reuse Maelstrom. No ritual required.'),
 dict(id='scarabs12',name='10 Scarabs + Terminator Sorcerer',range='≤12″',weapons=scarabs(),note='Marked by Fate +1 to hit, Lethal Hits; 9 combi-bolters total with Rapid Fire. Gaze of Hate included.'),
 dict(id='scarabs18',name='10 Scarabs + Terminator Sorcerer',range='>12–18″',weapons=scarabs(False),note='Same buffs; no Rapid Fire. Beyond 18″ Gaze of Hate is out of range, so do not use this row.'),
 dict(id='scarabs24',name='10 Scarabs + Terminator Sorcerer',range='>18–24″',weapons=scarabs(False)[:-1],note='No Rapid Fire; Gaze of Hate cannot reach. Marked by Fate and Lethal Hits included.'),
 dict(id='rubrics24',name='5 Rubrics + Sorcerer',range='>12–24″',weapons=rubrics()[1:],note='Flamers out of range; soulreaper, Malefic Curse and Delusion only. Wound rerolls of 1 and Lethal Hits included.'),
 dict(id='rubrics',name='5 Rubrics + Sorcerer',range='≤12″',weapons=rubrics(),note='Three flamers, soulreaper, Malefic Curse and Delusion; Lethal Hits and wound rerolls of 1. No pistols alongside that model’s other guns.'),
 dict(id='rubrics-objective',name='Rubrics + Sorcerer · enemy objective',range='≤12″',weapons=rubrics(True),note='Target within an objective you do not control: full failed-wound rerolls replace rerolls of 1.'),
 dict(id='rubrics-burst',name='Rubrics + Sorcerer · objective + once-per-battle burst',range='≤12″',weapons=rubrics(True,True),note='As above, plus Twisted Sorceries makes Delusion 9 attacks at S8. Does not spend CP; once per battle per Sorcerer.'),
 dict(id='robots36',name='2 Sekhetar Robots · missiles only',range='>12–36″',weapons=[robots()[1]],note='Four missile shots; flamers and meltaguns cannot reach.'),
 dict(id='robots12',name='2 Sekhetar Robots',range='>6–12″',weapons=robots(),note='Both flamers, both missile racks and both meltaguns; no Melta bonus.'),
 dict(id='robots6',name='2 Sekhetar Robots · Melta',range='≤6″',weapons=robots(True),note='Same guns; meltaguns deal D6+2 damage.'),
 dict(id='prince',name='Winged Prince · Eldritch Vortex',range='≤24″',weapons=[weapon('Dark Blessing + Vortex',9,2,5,1,2,psychic=True,ignore=True,sustained=1),weapon('Infernal cannon',3,2,5,2,2)],hunter=True,note='Vortex makes Dark Blessing S5/D2. Hunter of Souls rerolls hit/wound 1s against the attached Character units. No Aetherstride or offensive Kindred Sorcery.'),
 dict(id='disc',name='Exalted Sorcerer on Disc',range='≤18″',weapons=[weapon('Arcane Fire',dice(1,6),0,6,2,dice(1,3),psychic=True,ignore=True)],note='Arcane Fire only; Incandaeum adds a possible extra Doombolt, not a weapon-profile buff. Binding Tendrils slows hit Infantry even when they survive.'),
 dict(id='bows',name='3 bow Enlightened',range='≤30″',weapons=[weapon('3 fatecaster greatbows',6,4,5,2,2,ignore=True,lethal=True)],note='Six shots. Precision is deliberately not used: these columns measure bodyguard removal, not character sniping.'),
]

def wound_threshold(s,t): return 2 if s>=2*t else 3 if s>t else 4 if s==t else 6 if 2*s<=t else 5

def roll_pmf(reroll, fails):
    out=defaultdict(float)
    for r in range(1,7):
        if (reroll=='ones' and r==1) or (reroll=='all' and fails(r)):
            for rr in range(1,7):out[rr]+=1/36
        else:out[r]+=1/6
    return dict(out)

def calculate(row,target,cover=False,shield=False):
    hp=target['hp'];total=sum(hp)
    ends=[];n=0
    for h in hp:n+=h;ends.append(n)
    def advance(progress,damage):
        if progress==total:return total
        end=next(e for e in ends if e>progress)
        return progress+min(end-progress,damage)
    def transition(v,pmf):
        out=defaultdict(float)
        for progress,p in v.items():
            for damage,q in pmf.items():out[advance(progress,damage)]+=p*q
        return dict(out)
    state={0:1.0}
    for raw in row['weapons']:
        w=dict(raw)
        if row.get('hunter') and target.get('character'):
            w['hit_rr']='ones';w['wound_rr']='ones'
        inv=min(target['inv'],4) if shield and target['vehicle'] else target['inv']
        save=max(2,target['sv']+w['ap']-(1 if cover and not w.get('ignore') else 0))
        save=min(save,inv)
        fail_save=min(1,(save-1)/6)
        def damage_pmf(success):
            out=defaultdict(float);out[0]=1-success
            for damage,p in w['damage'].items():
                fnp=target.get('fnp',7);q=min(1,(fnp-1)/6)
                for suffered in range(damage+1):
                    out[suffered]+=success*p*comb(damage,suffered)*q**suffered*(1-q)**(damage-suffered)
            return dict(out)
        normal=damage_pmf(fail_save)
        crit=6
        for typ in ['inf','vehicle','monster']:
            if target.get(typ):crit=min(crit,w.get('anti_'+typ,6))
        need=wound_threshold(w['strength'],target['t'])
        wound_mod=w.get('wound_mod',0)
        def wounded(r):return r!=1 and (r>=crit or r+wound_mod>=need)
        wp=roll_pmf(w.get('wound_rr'),lambda r:not wounded(r))
        success=sum(p*(1 if w.get('dev') and r>=crit else fail_save) for r,p in wp.items() if wounded(r))
        rolled=damage_pmf(success)
        # Lethal is optional: roll instead when the unsaved-wound chance is greater.
        lethal=w.get('lethal') and fail_save>=success
        critical_base=normal if lethal else rolled
        if w['bs']==0:hit={'normal':1.0}
        else:
            mod=max(-1,min(1,w.get('hit_mod',0)-(1 if target.get('stealth') else 0)))
            good=lambda r:r==6 or (r!=1 and r+mod>=w['bs'])
            hit=defaultdict(float)
            for r,p in roll_pmf(w.get('hit_rr'),lambda r:not good(r)).items():hit['critical' if r==6 else 'normal' if good(r) else 'miss']+=p
        @lru_cache(None)
        def shot(progress):
            q=defaultdict(float);q[progress]+=hit.get('miss',0)
            for end,p in transition({progress:1},rolled).items():q[end]+=p*hit.get('normal',0)
            critical=transition({progress:1},critical_base)
            for _ in range(w.get('sustained',0)):critical=transition(critical,rolled)
            for end,p in critical.items():q[end]+=p*hit.get('critical',0)
            return dict(q)
        count=len(hp)+(1 if target.get('character') else 0)
        attacks={n+(count//5 if w.get('blast') else 0):p for n,p in w['attacks'].items()}
        running=state;mixture=defaultdict(float)
        for i in range(max(attacks)+1):
            if i in attacks:
                for x,p in running.items():mixture[x]+=p*attacks[i]
            next_state=defaultdict(float)
            for x,p in running.items():
                for y,q in shot(x).items():next_state[y]+=p*q
            running=dict(next_state)
        state=dict(mixture)
        assert abs(sum(state.values())-1)<1e-9
    return dict(kill=round(state.get(total,0)*100,3),expectedWoundsRemoved=round(sum(x*p for x,p in state.items()),3))

def checks():
    t=dict(t=1,sv=7,inv=7,hp=[1]*3)
    one=dict(weapons=[weapon('one torrent D6 attack',1,0,10,0,6)])
    assert calculate(one,t)['kill']==0, 'Damage must not spill between models'
    t['hp']=[1]
    assert abs(calculate(one,t)['kill']-100*5/6)<.001
    # One wound with reroll failures: 35/36, since torrent auto-hits.
    one['weapons'][0]['wound_rr']='all'
    assert abs(calculate(one,t)['kill']-100*35/36)<.001
    # Correlated sustained hits: one critical creates 4 hits together, never independently.
    one=dict(weapons=[weapon('sustained',1,6,10,0,1,sustained=3)])
    t['hp']=[1]*4
    assert abs(calculate(one,t)['kill']-100/6*(5/6)**4)<.001
    # Anti-vehicle should bypass a 2++ via devastating wounds, declining Lethal.
    one=dict(weapons=[weapon('anti',1,0,1,0,1,lethal=True,dev=True,anti_vehicle=4)])
    t=dict(t=20,sv=2,inv=2,hp=[1],vehicle=True)
    assert abs(calculate(one,t)['kill']-50)<.001

if __name__=='__main__':
    checks()
    data=dict(reviewed='2026-09-26',edition=11,method='Exact finite-state enumeration; not Monte Carlo. Percentages are per full shooting activation.',targets=TARGETS,rows=[])
    for r in ROWS:
        entry={k:v for k,v in r.items() if k not in ['weapons','hunter']}
        entry['results']={mode:{t['id']:calculate(r,t,cover,shield) for t in TARGETS} for mode,cover,shield in [('open',False,False),('cover',True,False),('shield',True,True)]}
        entry['profiles']=r['weapons']
        data['rows'].append(entry)
        print(r['id'], ' '.join(f"{t['id']}={entry['results']['cover'][t['id']]['kill']:.1f}%" for t in TARGETS))
    data['sources']=[{'name':x.replace('-',' '),'url':'https://wahapedia.ru/wh40k11ed/factions/thousand-sons/'+x} for x in ['Magnus-The-Red','Scarab-Occult-Terminators','Sorcerer-In-Terminator-Armour','Rubric-Marines','Sorcerer','Sekhetar-Robots','Daemon-Prince-of-Tzeentch-with-Wings','Exalted-Sorcerer-on-Disc-of-Tzeentch','Tzaangor-Enlightened-with-Fatecaster-Greatbows','']]
    data['sources'] += [{'name':x.replace('-',' '),'url':'https://wahapedia.ru/wh40k11ed/factions/drukhari/'+x} for x in ['Venom','Raider','Ravager','Cronos','Scourges-with-Heavy-Weapons','Wyches','Incubi']]
    data['sources'].append({'name':'Core rules','url':'https://wahapedia.ru/wh40k11ed/the-rules/core-rules/'})
    out=ROOT/'public/matchups/drukhari/shooting-probabilities.json';out.write_text(json.dumps(data,indent=2)+'\n')
    print('Checks passed. Wrote',out)
