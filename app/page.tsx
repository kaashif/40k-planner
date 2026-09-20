import Link from 'next/link';
import VodReview from './vod/VodReview';
import './vod/vod.css';
const tools=[
 ['/matchups/adeptus-mechanicus/','Thousand Sons vs Kastelans','Longways deployment diagrams, screens, AdMech rules, reserve denial and Robot threat ranges.'],
 ['/planner/','Deployment planner','Your Thousand Sons roster, measured bases, enemy models, named saves and threat rings.'],
 ['/threat-ranges/','Threat range calculator','Compare movement, Scout, Advance and charge scenarios, with charge odds.'],
 ['/plans/','Saved deployment plans','Reopen named plans and browse saved boards by army and terrain layout.'],
 ['/missions/','Missions and terrain','Choose a force-disposition matchup and inspect its three terrain layouts.'],
 ['/vod/','VOD game studies','Game-by-game lists, reserve timelines, screenshots and matched terrain diagrams.'],
 ['/matchups/world-eaters/','World Eaters threat examples','Angron and Eightbound reach, distance examples and all three PA vs Purge maps.'],
 ['/matchups/world-eaters/reserve-plan/','Your Thousand Sons reserve plan','Deploy Magnus’s group, stage the screens and plan Scarab/Prince arrivals.'],
 ['/tactics/screening/','Screening tactics','Coherent formations, Angron landing spaces and contact after a screen dies.'],
 ['/reviews/','Battle reviews','Earlier Necron game reviews and linked deployment positions.'],
];
export default function Home(){return <main className="vod-site tools-home"><header><p className="home-eyebrow">Warhammer 40,000 · planning and review</p><h1>40k planner</h1><p>Prepare a deployment, check a threat, or learn from a game.</p></header><nav className="tool-directory" aria-label="All tools">{tools.map(([href,title,description])=><Link href={href} key={href}><h2>{title} <span>↗</span></h2><p>{description}</p></Link>)}</nav><VodReview embedded/></main>}
