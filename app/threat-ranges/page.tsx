import Link from 'next/link';
import Calculator from './Calculator';
import '../vod/vod.css';
export default function Page(){return <main className="vod-site"><Link href="/">← All tools</Link><h1>Threat range calculator</h1><p>Compare Scout, normal move, Advance and charge reach. Start with Angron’s 14″ move, or change the inputs for another model. Advance-and-charge is an explicit scenario permission; this tool does not grant it.</p><p><Link href="/planner/">Use these rings on the deployment map with your models →</Link> · <Link href="/matchups/world-eaters/">World Eaters examples and rules →</Link></p><p><a href="https://github.com/kaashif/40k-planner/blob/main/docs/opponent-list-rules.md">Opponent rules audit, base sizes and hull measurements ↗</a></p><Calculator/></main>}
