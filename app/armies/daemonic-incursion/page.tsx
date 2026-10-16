import type { Metadata } from 'next';
import Link from 'next/link';
import research from '@/public/daemonic-incursion/research-2026-10-16.json';
import './daemons.css';

export const metadata: Metadata = {
  title: 'Daemonic Incursion · Lists, wins & VODs · 40k Field Notes',
  description: 'Dated Daemonic Incursion tournament rosters, confirmed winning broadcasts, and Monster Mash rules reminders.',
};

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const faction = 'https://wahapedia.ru/wh40k11ed/factions/chaos-daemons/';
const core = 'https://wahapedia.ru/wh40k11ed/the-rules/core-rules/';
const pack = 'https://assets.warhammer-community.com/eng_22-07_warhammer_40%2C000_faction_pack_chaos_daemons-lycqqrymwe-qogh4b5yly.pdf';
const notes: Record<string, { id: string; result: string; monsters: string; support: string; comparison: string }> = {
  'Mike Pestilens': {
    id: 'mike', result: '6th / 105 · 5–1',
    monsters: 'Be’lakor · Great Unclean One / Endless Gift · Lord of Change / Everstave · Rotigus',
    support: 'Sloppity Bilepiper; two Plaguebearer squads; Nurglings; two Flesh Hound squads; two Skull Cannons.',
    comparison: 'Four big monsters with more supporting units. No Kairos or Skarbrand. The Bilepiper and Skull Cannons also provide ways to force Battle-shock.',
  },
  'Mark Cable': {
    id: 'mark', result: '4–1 · dropped after five games',
    monsters: 'Be’lakor · Kairos · Lord of Change / Everstave · Rotigus · Skarbrand',
    support: 'Two Plaguebearer squads; Nurglings; one Beast of Nurgle.',
    comparison: 'Closest to your five-monster army. Uses Rotigus in the GUO slot, with an extra Plaguebearer squad, Nurglings and a Beast instead of your Flamers and Screamers. This is a comparison, not a current-points swap.',
  },
  'Brendan Healy': {
    id: 'brendan', result: '11th / 59 · 4–1',
    monsters: 'Bloodthirster / A’rgath · Great Unclean One · Skarbrand',
    support: 'Slimux with two Beasts; Skullmaster with six Bloodcrushers; Bilepiper; two Plaguebearer squads; six Nurglings; two Flesh Hound squads.',
    comparison: 'A Khorne/Nurgle alternative with three big monsters and several attached units. No Be’lakor or birds. His winning Black Templars game is linked below.',
  },
  'Daniel Roman': {
    id: 'daniel', result: '1st / 20 · 5–0',
    monsters: 'Kairos · Lord of Change / Everstave · Great Unclean One / Endless Gift · Rotigus',
    support: 'Changecaster; Plaguebearers; two Nurglings squads; one Beast; two Flamer squads; three Flesh Hound squads; Seekers.',
    comparison: 'The undefeated event winner in this sample. Keeps both birds and both large Nurgle monsters, with a wider supporting cast. Uses Disruption rather than Take and Hold.',
  },
};

const vods = [
  { date: '11 Sep 2026', winner: 'Brendan Healy', opponent: 'Mark Vaiasinni · Black Templars', score: '61–49', event: 'Battle in the Bush', time: '4:15:00', watch: 'https://www.youtube.com/watch?v=2H1br6PBSIk&t=15300s', slug: 'mark-vaiasinni-black-templars-vs-brendan-healy-chaos-daemons-15300', list: 'https://listhammer.info/list/107494624f6eeffb91', legacy: false },
  { date: '5 Sep 2026', winner: 'Dave Parker', opponent: 'Daniel Marshall · Adeptus Custodes', score: '76–70', event: 'Nailhammer XII GT', time: '7:30:00', watch: 'https://www.youtube.com/watch?v=6RpQQeGGKoQ&t=27000s', slug: 'dave-parker-chaos-daemons-vs-daniel-marshall-adeptus-custodes-27000', list: 'https://www.bestcoastpairings.com/list/c53d6Ffx7MYE', legacy: false },
  { date: '14 Jun 2026', winner: 'Christopher Langton', opponent: 'Greg Chamberlain · Tyranids', score: '84–76', event: 'Leeds Super Major', time: '3:30:00', watch: 'https://www.youtube.com/watch?v=JGoefoN-1ac&t=12600s', slug: 'christopher-langton-chaos-daemons-vs-greg-chamberlain-tyranids-12600', list: 'https://www.bestcoastpairings.com/list/ThixyxKc77Og', legacy: true },
  { date: '14 Jun 2026', winner: 'Christopher Langton', opponent: 'Michael Duff · Death Guard', score: '74–61', event: 'Leeds Super Major', time: '0:15:00', watch: 'https://www.youtube.com/watch?v=aUMX5ujWQdE&t=900s', slug: 'michael-duff-death-guard-vs-christopher-langton-chaos-daemons-900', list: 'https://www.bestcoastpairings.com/list/ThixyxKc77Og', legacy: true },
];

export default function DaemonicIncursion() {
  return <main className="daemons-page">
    <header className="daemons-header">
      <Link href="/" prefetch={false}>← 40k prep</Link>
      <p className="daemons-eyebrow">Army study · checked 16 October 2026</p>
      <h1>Daemonic Incursion</h1>
      <p className="daemons-intro">What’s succeeding, the exact lists, and winning games to watch.</p>
      <p>Recent results include five-monster armies close to yours, plus builds that trade a monster or two for more supporting units. Start with Mark’s roster for comparison and Brendan’s game for a recent win.</p>
    </header>
    <nav className="daemons-nav" aria-label="On this page">
      <a href="#results">Tournament results</a><a href="#watch">Winning VODs</a><a href="#your-list">Your Monster Mash</a><a href="#rules">Rules reminders</a><a href="#sources">Sources</a>
    </nav>

    <section id="results">
      <div className="daemons-section-heading"><h2>Recent tournament lists</h2><span>August–October 2026 · 11th edition</span></div>
      <p>Selected X–0 and X–1 singles results from Listhammer. A strong record is not necessarily a tournament win; this sample is not a detachment win-rate estimate.</p>
      <div className="daemons-table-wrap"><table>
        <caption>Four recent Daemonic Incursion results</caption>
        <thead><tr><th scope="col">Player / event</th><th scope="col">Record</th><th scope="col">Disposition</th><th scope="col">Exact roster</th></tr></thead>
        <tbody>{research.lists.map(list => <tr key={list.playerName}>
          <th scope="row"><a href={'#'+notes[list.playerName].id}>{list.playerName}</a><small>{list.eventName} · {list.startDate}</small></th>
          <td><strong>{list.wins}–{list.losses}</strong><small>{notes[list.playerName].result}</small></td>
          <td>{list.disposition}</td><td><a href={list.listUrl}>Open list ↗</a><small><a href={list.eventUrl}>Event results</a></small></td>
        </tr>)}</tbody>
      </table></div>
      <div className="daemons-list-grid">{research.lists.map(list => {
        const note = notes[list.playerName];
        return <article className="daemons-card" id={note.id} key={note.id}>
          <div className="daemons-card-title"><h3>{list.playerName}</h3><span className="daemons-record">{list.wins}–{list.losses}</span></div>
          <p className="daemons-meta">{list.startDate} · {list.disposition} · {list.numberOfPlayers} players</p>
          <h4>Monster core</h4><p>{note.monsters}</p>
          <h4>Supporting units</h4><p>{note.support}</p>
          <p className="daemons-comparison">{note.comparison}</p>
          <div className="daemons-links"><a href={list.listUrl}>Exact Listhammer list ↗</a><a href={list.eventUrl}>Event results ↗</a></div>
          <details><summary>Read saved tournament roster</summary><p className="daemons-meta">Original submitted export; historical points and loadouts are retained.</p><pre>{list.listText}</pre></details>
        </article>;
      })}</div>
      <aside className="daemons-note"><strong>What this suggests for practice</strong><p>Mark is the closest match to your five-monster approach. Rotigus appears in three of these four lists; all four bring Plaguebearers and Nurglings, and three bring Flesh Hounds. My inference is to test supporting-unit alternatives alongside the monster core. These lists alone do not establish an optimal build or explain why each game was won.</p></aside>
    </section>

    <section id="watch">
      <div className="daemons-section-heading"><h2>Confirmed winning VODs</h2><span>Timestamped starts · exact event lists</span></div>
      <p>Scores and detachment labels come from 40k VOD Index. These are links for study, not footage analyses. BCP rosters may need a sign-in.</p>
      <div className="daemons-list-grid">{vods.map(game => <article className="daemons-card" key={game.slug}>
        <p className="daemons-eyebrow">{game.date} · {game.legacy ? 'Older rules' : '11th edition'}</p>
        <div className="daemons-card-title"><h3>{game.winner}</h3><span className="daemons-record">{game.score}</span></div>
        <p>Win against {game.opponent}</p><p className="daemons-meta">{game.event} · Daemonic Incursion</p>
        <a className="daemons-watch" href={game.watch}>▶ Watch from {game.time}</a>
        <div className="daemons-links"><a href={game.list}>Exact army list ↗</a><a href={'https://40kvodindex.com/games/'+game.slug}>Result & broadcast source ↗</a></div>
        {game.legacy && <p className="daemons-meta">Predates the 20 June 2026 faction-pack launch. Use for general positioning ideas with the older rules context in mind. Both Leeds games use Langton’s same event roster.</p>}
      </article>)}</div>
    </section>

    <section id="your-list">
      <div className="daemons-section-heading"><h2>Your Monster Mash</h2><span>Daemonic Incursion · Take and Hold</span></div>
      <p>Be’lakor, Great Unclean One with Endless Gift, Kairos, Lord of Change with Everstave, and Skarbrand. Supported by Plaguebearers, Flamers and Screamers.</p>
      <div className="daemons-links"><a href={base+'/daemonic-incursion/monster-mash-reference.pdf'}>Printable reference sheet ↗</a><a href={base+'/daemonic-incursion/monster-mash-list.txt'}>Original New Recruit export ↗</a></div>
      <p className="daemons-meta">Reference sheet copied from the ref-sheet repository on 16 October 2026. Buffed and base values share the profile cells: Kairos Gateway S9 / conditional S10, Plaguebearers T5 / conditional T6.</p>
    </section>

    <section id="rules">
      <div className="daemons-section-heading"><h2>Rules reminders</h2><span>For your supplied army</span></div>
      <div className="daemons-rules">
        <details><summary>Conditional buffs in your list</summary><div>
          <p><strong>Kairos:</strong> Gateway is base S9, or S10 within 6″ of Lord of Change. The LoC aura adds +1 Strength to ranged attacks; it does not improve Kairos’s melee weapon.</p>
          <p><strong>Plaguebearers:</strong> base T5, or T6 within 6″ of Great Unclean One. GUO’s own aura makes it T13.</p>
          <p><strong>Lord of Change:</strong> its own Shadow aura enables Everstave’s +2 Strength / +6″ range. With its own additional +1 Strength ranged aura, rod attacks are S11 and Bolt attacks S12, both at 24″.</p>
          <a href={faction+'datasheets.html'}>Datasheets and aura conditions ↗</a>
        </div></details>
        <details><summary>Kairos CP generation and Leadership</summary><div>
          <p>At the end of your Command phase, if Kairos is on the battlefield, take a Leadership test: pass to gain 1CP. With Ld6+, that is 2D6 ≥ 6: 26/36, or 72.2%, before any external modifiers.</p>
          <p>Your supplied list gives this test no bonus. Shadow of Chaos’s +1 is for Battle-shock rolls, not this Leadership test. Kairos can also tax an opponent’s stratagem use by +1CP once per turn when it targets their unit within 12″.</p>
          <p>Other CP sources outside your roster: Epidemius converts a tally of at least seven enemy models killed by your Nurgle Daemons into 1CP at the start of your Command phase, resetting it; Skulltaker gains 1CP when he destroys an enemy Character unit. Apply the core CP-gain limits.</p>
          <a href={faction+'Kairos-Fateweaver'}>Kairos ↗</a> · <a href={faction+'datasheets.html'}>Other datasheets ↗</a> · <a href={core}>Core rules ↗</a>
        </div></details>
        <details><summary>Terror, forced Battle-shock and the payoff</summary><div>
          <p><strong>Daemonic Terror:</strong> enemy in your Shadow of Chaos and/or within 6″ of GUO, Kairos, LoC or Skarbrand: subtract 1 from its Battle-shock test; failure also causes D3 mortal wounds. Multiple nearby monsters do not multiply this rule. Proximity alone does not force a test.</p>
          <p><strong>Be’lakor:</strong> choose Pall of Despair at battle-round start. In the opponent’s Battle-shock step, enemies within 9″ below Starting Strength must test; for single-model units, any lost wound qualifies. Each enemy failed test within 9″ heals him D3 wounds. His own Shadow area reaches 6″, so an enemy 6–9″ away needs another source to qualify for Terror.</p>
          <p><strong>Normal tests:</strong> in their Command Battle-shock step, units test if at or below half-strength or already Battle-shocked. Normally no more than one test per unit in that step, so Pall does not double the ordinary test.</p>
          <p><strong>Failure:</strong> OC becomes “–”; their owner cannot target them with stratagems; they cannot start or complete actions; Fall Back uses Desperate Escape. They can still shoot, charge and fight. Recovery normally requires a successful roll in their next Command Battle-shock step.</p>
          <p><strong>Draught of Terror, 1CP:</strong> one of your Daemon units not yet selected to shoot/fight gains +1 AP for your Shooting phase or either Fight phase, plus full wound rerolls against Battle-shocked targets. Every unit in your roster can benefit when eligible.</p>
          <p>Other test-forcing options include Skull Cannon after hitting; Changecaster after hitting Infantry; Skullmaster after charging; Sloppity Bilepiper at Fight start near non-Monsters/non-Vehicles; and The Changeling when enemies try to attack it.</p>
          <a href={faction}>Army and stratagem rules ↗</a> · <a href={faction+'Be-lakor'}>Be’lakor ↗</a> · <a href={core}>Battle-shock core rules ↗</a>
        </div></details>
        <details><summary>Books and abbreviations</summary><div>
          <p><strong>Ignores Cover</strong> was previously abbreviated “IC”; it is spelled out on your reference sheet.</p>
          <p>Your mixed-god army uses the free Chaos Daemons faction pack. There is no current standalone Chaos Daemons codex to buy; older books can serve as lore/art references, but their rules are obsolete. God-specific Daemons also appear in the corresponding Chaos Marine codexes.</p>
          <a href={pack}>Official faction pack ↗</a> · <a href="https://www.warhammer-community.com/en-gb/articles/gsdzv0gh/chaos-ascends-with-new-units-and-codexes-for-khorne-tzeentch-and-nurgle/">GW’s codex explanation ↗</a>
        </div></details>
      </div>
    </section>

    <footer id="sources">
      <h2>Sources & scope</h2>
      <p>Checked 16 October 2026. The four full tournament exports are saved with their source URLs and historical points. This is a selected results snapshot, not a live feed, exhaustive search result or causal analysis. No VOD footage has been reviewed for this page.</p>
      <div className="daemons-links"><a href="https://listhammer.info/?faction=Chaos+Daemons">Listhammer: Chaos Daemons ↗</a><a href="https://40kvodindex.com/factions/chaos-daemons">40k VOD Index: Chaos Daemons ↗</a><a href={base+'/daemonic-incursion/research-2026-10-16.json'}>Saved research data ↗</a><a href={pack}>Official faction pack v1.1 ↗</a></div>
      <p className="daemons-meta">The September broadcasts are current-edition examples; the June Leeds broadcasts are explicitly marked as older rules. Roster comparisons and practice suggestions are interpretation, separate from event records.</p>
    </footer>
  </main>;
}
