import missionsData from '../public/reference/11th-edition/data/missions.json';
import layoutsData from '../public/reference/11th-edition/data/event-layouts.json';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const referenceRoot = `${basePath}/reference/11th-edition`;

type Layout = (typeof layoutsData.layouts)[number];

function sourceUrl(path: string) {
  return `${referenceRoot}/${path}`;
}

function groupLayouts(layouts: Layout[]) {
  const groups = new Map<string, Layout[]>();
  for (const layout of layouts) {
    const key = [layout.attacker.forceDisposition, layout.defender.forceDisposition].join(' vs ');
    groups.set(key, [...(groups.get(key) ?? []), layout]);
  }
  return [...groups.entries()];
}

export default function Home() {
  const layoutGroups = groupLayouts(layoutsData.layouts);
  const primaryCount = missionsData.forceDispositions.reduce(
    (total, disposition) => total + Object.keys(disposition.primaryMissionsByOpponent).length,
    0,
  );

  return (
    <main>
      <header className="hero">
        <nav className="nav shell" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="Mission Control home">
            <span className="brand-mark">XI</span>
            <span>Mission Control</span>
          </a>
          <div className="nav-links">
            <a href="#missions">Missions</a>
            <a href="#layouts">Layouts</a>
            <a href="#secondaries">Secondaries</a>
            <a href="#sources">Sources</a>
          </div>
        </nav>

        <div className="hero-content shell" id="top">
          <p className="eyebrow">Warhammer 40,000 · 11th Edition · 2026–27</p>
          <h1>Know the mission.<br /><span>Own the table.</span></h1>
          <p className="lede">
            Every Force Disposition matchup, primary mission and official event layout—indexed from the current rules in one field reference.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#missions">Explore missions</a>
            <a className="button secondary" href={sourceUrl('official/event-companion.pdf')}>Open Event Companion ↗</a>
          </div>
        </div>

        <div className="stats shell" aria-label="Reference totals">
          <Stat value={missionsData.forceDispositions.length} label="Force dispositions" />
          <Stat value={primaryCount} label="Primary missions" />
          <Stat value={layoutsData.layouts.length} label="Measured layouts" />
          <Stat value={missionsData.secondaryMissions.length} label="Secondary cards" />
        </div>
      </header>

      <section className="section shell" id="missions">
        <SectionHeading
          index="01"
          title="Mission matrix"
          description="Your Force Disposition and your opponent’s disposition determine a different primary mission for each player."
        />

        <div className="disposition-grid">
          {missionsData.forceDispositions.map((disposition) => (
            <article className="disposition-card" key={disposition.id}>
              <span className="card-code">{String(missionsData.forceDispositions.indexOf(disposition) + 1).padStart(2, '0')}</span>
              <h3>{disposition.name}</h3>
              <p>{disposition.summary}</p>
              <a href={disposition.referenceUrl}>Community card reference ↗</a>
            </article>
          ))}
        </div>

        <div className="matrix-wrap">
          <table className="matrix">
            <caption>Your primary mission (rows) against the opponent’s disposition (columns)</caption>
            <thead>
              <tr>
                <th scope="col">You play ↓ / Opponent →</th>
                {missionsData.forceDispositions.map((disposition) => (
                  <th scope="col" key={disposition.id}>{disposition.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {missionsData.forceDispositions.map((disposition) => (
                <tr key={disposition.id}>
                  <th scope="row">{disposition.name}</th>
                  {missionsData.forceDispositions.map((opponent) => (
                    <td key={opponent.id}>
                      {disposition.primaryMissionsByOpponent[opponent.id as keyof typeof disposition.primaryMissionsByOpponent]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section section-dark" id="layouts">
        <div className="shell">
          <SectionHeading
            index="02"
            title="Official event layouts"
            description="All 15 disposition matchups have three measured layouts. Each entry links directly to its authoritative page in the Event Companion."
            inverted
          />

          <div className="layout-groups">
            {layoutGroups.map(([matchup, layouts], groupIndex) => (
              <article className="layout-group" key={matchup}>
                <div className="layout-group-heading">
                  <span>{String(groupIndex + 1).padStart(2, '0')}</span>
                  <h3>{matchup}</h3>
                </div>
                <div className="layout-cards">
                  {layouts.map((layout) => (
                    <a
                      className="layout-card"
                      href={`${sourceUrl('official/event-companion.pdf')}#page=${layout.pdfPage}`}
                      key={layout.id}
                    >
                      <div className="layout-card-top">
                        <strong>Layout {layout.layout}</strong>
                        <span>PDF p.{layout.printedPage} ↗</span>
                      </div>
                      <div className="mission-pair">
                        <p><small>{layout.attacker.forceDisposition}</small>{layout.attacker.primaryMission}</p>
                        <span>VS</span>
                        <p><small>{layout.defender.forceDisposition}</small>{layout.defender.primaryMission}</p>
                      </div>
                      <div className="measurement-row">
                        {layout.measurementsInches.slice(0, 7).map((measurement) => (
                          <span key={measurement}>{measurement}&quot;</span>
                        ))}
                        {layout.measurementsInches.length > 7 && <span>+{layout.measurementsInches.length - 7}</span>}
                      </div>
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section shell" id="secondaries">
        <SectionHeading
          index="03"
          title="Secondary missions"
          description="The complete 18-card name index for the Chapter Approved 2026–27 secondary deck. Fixed-capable cards are marked."
        />
        <div className="secondary-grid">
          {missionsData.secondaryMissions.map((mission, index) => (
            <a
              className="secondary-card"
              href={missionsData.secondaryMissionReferenceUrl}
              key={mission.id}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{mission.name}</strong>
              {mission.fixed && <em>Fixed</em>}
            </a>
          ))}
        </div>
      </section>

      <section className="section sources-section" id="sources">
        <div className="shell">
          <SectionHeading
            index="04"
            title="Source library"
            description="Original official PDFs, searchable text extractions, and normalized JSON are included with the site."
            inverted
          />
          <div className="source-grid">
            <SourceCard title="Core Rules" meta="Official · PDF · 88 pages" href={sourceUrl('official/core-rules.pdf')} />
            <SourceCard title="Event Companion" meta="Official · PDF · 93 pages" href={sourceUrl('official/event-companion.pdf')} />
            <SourceCard title="Terrain Footprints" meta="Official · PDF · 3 pages" href={sourceUrl('official/terrain-area-footprints.pdf')} />
            <SourceCard title="Mission data" meta="Normalized · JSON" href={sourceUrl('data/missions.json')} />
            <SourceCard title="Layout data" meta="45 entries · JSON" href={sourceUrl('data/event-layouts.json')} />
            <SourceCard title="Source manifest" meta="URLs · checksums · JSON" href={sourceUrl('data/sources.json')} />
            <SourceCard title="Core Rules text" meta="Searchable · plain text" href={sourceUrl('extracted/core-rules.txt')} />
            <SourceCard title="Event Companion text" meta="Searchable · plain text" href={sourceUrl('extracted/event-companion.txt')} />
          </div>
        </div>
      </section>

      <footer className="footer shell">
        <span>Mission Control · 11th Edition</span>
        <p>Unofficial fan reference. Warhammer 40,000 and associated marks belong to Games Workshop.</p>
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}

function SectionHeading({ index, title, description, inverted = false }: {
  index: string;
  title: string;
  description: string;
  inverted?: boolean;
}) {
  return (
    <div className={`section-heading${inverted ? ' inverted' : ''}`}>
      <span>{index}</span>
      <div><h2>{title}</h2><p>{description}</p></div>
    </div>
  );
}

function SourceCard({ title, meta, href }: { title: string; meta: string; href: string }) {
  return (
    <a className="source-card" href={href}>
      <span>↗</span><strong>{title}</strong><small>{meta}</small>
    </a>
  );
}
