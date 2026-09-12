import { useEffect } from 'react';
import overview from '../../../docs/architecture.svg?url';
import { code, deployment, sections } from './data.ts';
import type { ArchitectureSection } from './data.ts';
import { diagrams } from './Diagrams.tsx';
import { useDiagramProgress } from './useDiagramProgress.ts';
import './architecture.css';

const sectionAnchor = (id: string) => location.pathname === '/' ? `#/architecture/${id}` : `#${id}`;

function Section({ section, index }: { section: ArchitectureSection; index: number }) {
  const { host, progress, reduced, replay, showAll } = useDiagramProgress(section.steps, index === 0 ? 'scroll' : 'enter');
  const Diagram = diagrams[index];
  return <section className="architecture-section" id={section.slug} aria-labelledby={`${section.slug}-title`}>
    <div className="architecture-section-heading"><span className="architecture-number">{String(index + 1).padStart(2, '0')}</span><div><p className="architecture-question">{section.question}</p><h2 id={`${section.slug}-title`}>{section.title}</h2><p className="architecture-description">{section.description}</p></div></div>
    <div className="architecture-toolbar"><span>{section.boundary}</span><div><button type="button" onClick={replay} aria-label={`Replay section ${index + 1}`}>{reduced ? 'Static view' : 'Replay'}</button><button type="button" onClick={showAll} aria-label={`Show all of section ${index + 1}`}>Show all</button></div></div>
    <div ref={host} className="architecture-diagram-scroll" tabIndex={0} role="region" aria-label={`${section.title} Scroll diagram horizontally on small screens.`}><Diagram progress={progress} /></div>
    <div className="architecture-source-row"><a href={section.source} target="_blank" rel="noreferrer">{section.sourceLabel} <span aria-hidden="true">↗</span></a><a href={code(`docs/architecture/${index + 1}-${section.slug}.svg`)} target="_blank" rel="noreferrer">Static SVG <span aria-hidden="true">↗</span></a></div>
  </section>;
}
export default function ArchitecturePage() {
  useEffect(() => {
    const previous = document.title; document.title = 'Cascade — Architecture';
    const scrollFallback = () => {
      if (location.pathname !== '/') return;
      const id = location.hash.match(/^#\/architecture\/([a-z0-9-]+)$/)?.[1];
      if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
    };
    scrollFallback(); window.addEventListener('hashchange', scrollFallback);
    return () => { document.title = previous; window.removeEventListener('hashchange', scrollFallback); };
  }, []);
  return <main className="architecture-page" id="architecture-top">
    <a className="architecture-skip" href={sectionAnchor('one-deposit')}>Skip to diagrams</a>
    <header className="architecture-header"><a href="/" className="architecture-wordmark">cascade<span>.</span></a><span>ARCHITECTURE</span><a href="/">Back to the globe <span aria-hidden="true">↗</span></a></header>
    <div className="architecture-content">
      <section className="architecture-intro" aria-labelledby="architecture-title"><div><p className="architecture-kicker">ARC BY CIRCLE / BEST DEFI &amp; ONCHAIN FINANCE</p><h1 id="architecture-title">One dollar.<br />A chain of payments.</h1><p className="architecture-lead">Follow the principal, the right to yield, and the evidence. Six questions about how Cascade works.</p><div className="architecture-legend" aria-label="Diagram color key"><span><i className="architecture-money" />Principal &amp; money</span><span><i className="architecture-yield" />Time &amp; yield</span><span><i className="architecture-control" />Control &amp; evidence</span></div></div><a className="architecture-proof" href={deployment.verified} target="_blank" rel="noreferrer"><span>VERIFIED ON ARC TESTNET</span><strong>$10 <span aria-hidden="true">→</span> $40</strong><p>Principal deposited → invoices settled</p><small>Inspect the vault and receipts ↗</small></a></section>
      <nav className="architecture-contents" aria-label="Architecture sections">{sections.map((section, i) => <a key={section.slug} href={sectionAnchor(section.slug)}><span>0{i + 1}</span>{['Circulation', 'Yield ownership', 'Storage', 'Trust & deployment', 'Loss & recovery', 'Playback & evidence'][i]}</a>)}</nav>
      {sections.map((section, index) => <Section key={section.slug} section={section} index={index} />)}
      <section className="architecture-inventory" aria-labelledby="inventory-title"><p className="architecture-kicker">OPTIONAL / FULL COMPONENT MAP</p><h2 id="inventory-title">Component inventory</h2><details><summary>Open the existing overview diagram</summary><div className="architecture-diagram-scroll" tabIndex={0} role="region" aria-label="Component inventory, scroll horizontally"><img src={overview} width="1730" height="1200" alt="Cascade component inventory: backing, vault, date ledger, interfaces, entitlement ledger, reference events and separate participant-funded discount window." /></div><div className="architecture-source-row"><a href={overview} download="cascade-component-inventory.svg">Download overview SVG</a><a href={code('docs/architecture.md')} target="_blank" rel="noreferrer">Component map source ↗</a></div></details></section>
      <footer className="architecture-footer"><a href="/">Return to the globe</a><a href={code('docs/spec-tier1-v3.1.md')} target="_blank" rel="noreferrer">Read the dated-dollar specification ↗</a><a href={sectionAnchor('architecture-top')}>Back to top ↑</a></footer>
    </div>
  </main>;
}
