import React, { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { cn } from 'cn';
import { ArrowRightIcon, CheckIcon, ChevronRightIcon, RotateCcwIcon, SearchIcon, ShieldIcon, XIcon } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { createArmoryEntries, categoriesFor, filterArmoryEntries } from './catalog.js';
import './styles.css';

type Kind = 'gun' | 'melee';
type Entry = {
  id: string; name: string; label: string; category: string; categoryLabel: string;
  description: string; image: string; disabled: boolean;
  weapon: { valorant?: boolean; pellets?: number; projectile?: boolean; magazine?: number; mode?: string } | null;
  stats: { label: string; value: string; note: string }[];
};
const descriptionSummary = (description: string) => description.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() || description;

type Snapshot = { value: string; disabled: boolean; entries: Entry[] };
type PreviewController = { setWeapon(id: string, kind?: Kind): void; reset(): void; destroy(): void };
type ArmoryCommands = { close(): void; isOpen(): boolean; focus(): void };
export type WeaponArmoryOptions = { select: HTMLSelectElement; title?: string; kind?: Kind; portalContainer?: HTMLElement };
export type WeaponArmoryController = { sync(): void; close(): void; destroy(): void; isOpen(): boolean; focus(): void };

function WeaponImage({ entry, hero = false, eager = false }: { entry: Entry; hero?: boolean; eager?: boolean }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [entry.image]);
  return missing ? <span className="armory-image-fallback">{entry.label}</span> :
    <img src={entry.image} alt="" className={cn('armory-weapon-image', hero && 'armory-weapon-image-hero')} loading={hero || eager ? 'eager' : 'lazy'} draggable={false} onError={() => setMissing(true)} />;
}

function WeaponPreview({ entry, kind }: { entry: Entry; kind: Kind }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<PreviewController | null>(null);
  const latest = useRef(entry.id);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  latest.current = entry.id;
  useEffect(() => {
    let cancelled = false;
    setReady(false); setFailed(false);
    void import('./voxel-armory-preview.js').then(async ({ createWeaponPreview }) => {
      if (cancelled || !canvas.current) return;
      const preview: PreviewController = await createWeaponPreview(canvas.current, {
        weaponId: latest.current, kind,
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
        onError: () => { if (!cancelled) { setReady(false); setFailed(true); } },
      });
      if (cancelled) { preview.destroy(); return; }
      controller.current = preview;
      preview.setWeapon(latest.current, kind);
      setReady(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; controller.current?.destroy(); controller.current = null; };
  }, [kind]);
  useEffect(() => { controller.current?.setWeapon(entry.id, kind); }, [entry.id, kind]);
  return <div className="armory-inspection">
    <div className="armory-hero-stage" data-preview-ready={ready}>
      <div className="armory-hero-grid" aria-hidden="true" />
      <div className="armory-hero-caption" aria-hidden="true">{kind === 'melee' ? 'CLOSE QUARTERS' : 'WEAPON INSPECTION'}</div>
      {!ready && <WeaponImage entry={entry} hero />}
      <canvas ref={canvas} data-armory-preview tabIndex={ready ? 0 : -1} aria-hidden={!ready} aria-label={`Inspect ${entry.name}. Drag or use arrow keys to rotate. Home resets.`} />
      <Badge variant="outline" className="armory-preview-badge">{ready ? '3D model' : failed ? 'Weapon model' : 'Loading 3D'}</Badge>
    </div>
    <div className="armory-inspection-tools">
      <span>{ready ? 'Drag to rotate · arrow keys when focused' : 'Actual in-game weapon model'}</span>
      {ready && <Button variant="ghost" size="sm" aria-label="Reset weapon preview" data-armory-action="reset-preview" onClick={() => controller.current?.reset()}><RotateCcwIcon data-icon="inline-start" />Reset</Button>}
    </div>
  </div>;
}

function StatList({ entry }: { entry: Entry }) {
  if (!entry.stats.length) return null;
  return <dl className="armory-stats">{entry.stats.map(stat => <div key={stat.label} className="armory-stat">
    <dt>{stat.label}</dt><dd>{stat.value}</dd>{stat.note && <span>{stat.note}</span>}
  </div>)}</dl>;
}

function SelectionCard({ entry, kind, disabled, triggerRef }: { entry?: Entry; kind: Kind; disabled: boolean; triggerRef: React.RefObject<HTMLButtonElement | null> }) {
  return <Card variant="loadout" size="sm">
    <CardHeader>
      <CardDescription>{entry?.categoryLabel || (kind === 'melee' ? 'Melee weapon' : 'Starting gun')}</CardDescription>
      <CardTitle>{entry?.name || 'Choose your weapon'}</CardTitle>
    </CardHeader>
    <CardContent><div className="armory-loadout-art">{entry && <WeaponImage entry={entry} />}</div></CardContent>
    <CardFooter>
      <span className="armory-loadout-facts">{entry?.stats.length ? kind === 'melee' ? `${entry.stats[0].value} damage · ${entry.stats[1].value} reach` : `${entry.stats[1].value} ${entry.weapon?.projectile ? 'bolt' : entry.weapon?.pellets ? 'shells' : 'rounds'} · ${entry.stats[3].value} reload` : 'Explore the armory'}</span>
      <DialogTrigger ref={triggerRef} render={<Button variant="outline" size="sm" data-armory-action="open" disabled={disabled} />} aria-label={`Open ${kind === 'melee' ? 'melee ' : ''}armory${entry ? `, equipped ${entry.name}` : ''}`}>
        Armory<ChevronRightIcon data-icon="inline-end" />
      </DialogTrigger>
    </CardFooter>
  </Card>;
}

function WeaponTile({ entry, selected, equipped, choiceId }: { entry: Entry; selected: boolean; equipped: boolean; choiceId: string }) {
  const damage = entry.stats[0];
  return <Field data-disabled={entry.disabled || undefined} className="armory-choice">
    <FieldLabel htmlFor={choiceId} className="armory-choice-label">
      <Card variant="weapon" size="sm" className="armory-tile" data-selected={selected} data-equipped={equipped} data-entry-id={entry.id}>
        <CardHeader>
          <CardDescription>{entry.label === entry.name.toUpperCase() ? entry.categoryLabel : entry.label.toLowerCase()}</CardDescription>
          <CardTitle>{entry.name}</CardTitle>
        </CardHeader>
        <CardContent><div className="armory-thumbnail-stage"><WeaponImage entry={entry} eager /></div></CardContent>
        <CardFooter>
          <span>{equipped ? <Badge variant="secondary"><CheckIcon data-icon="inline-start" />Equipped</Badge> : damage ? `${damage.value} ${entry.weapon?.pellets ? 'per pellet' : 'damage'}` : entry.categoryLabel}</span>
          <RadioGroupItem id={choiceId} value={entry.id} disabled={entry.disabled} aria-label={`Preview ${entry.name}`} data-weapon-id={entry.id} />
        </CardFooter>
      </Card>
    </FieldLabel>
  </Field>;
}

function Armory({ snapshot, kind, title, portalContainer, onCommit, commandRef }: { snapshot: Snapshot; kind: Kind; title: string; portalContainer?: HTMLElement; onCommit(id: string): boolean; commandRef: React.Ref<ArmoryCommands> }) {
  const uid = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(snapshot.value);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const selected = snapshot.entries.find(entry => entry.id === snapshot.value);
  const previewed = snapshot.entries.find(entry => entry.id === draft);
  const categories = categoriesFor(snapshot.entries, kind);
  const visible = filterArmoryEntries(snapshot.entries, category, query) as Entry[];
  useImperativeHandle(commandRef, () => ({ close: () => setOpen(false), isOpen: () => open, focus: () => triggerRef.current?.focus() }), [open]);
  useEffect(() => {
    if (!open) setDraft(snapshot.value);
    if (snapshot.disabled) setOpen(false);
  }, [snapshot.value, snapshot.disabled, open]);
  useEffect(() => {
    if (!categories.some(item => item.id === category)) setCategory('all');
    if (draft && !snapshot.entries.some(entry => entry.id === draft)) setDraft(snapshot.value);
  }, [snapshot.entries, category, draft, snapshot.value]);
  const changeOpen = (next: boolean) => {
    if (next && snapshot.disabled) return;
    if (next) { setDraft(snapshot.value); setCategory('all'); setQuery(''); }
    setOpen(next);
  };
  return <Dialog open={open} onOpenChange={changeOpen}>
    <SelectionCard triggerRef={triggerRef} entry={selected} kind={kind} disabled={snapshot.disabled || !snapshot.entries.some(entry => !entry.disabled)} />
    <DialogContent variant="armory" portalContainer={portalContainer} data-voxel-armory="" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); changeOpen(false); } }} onKeyUp={event => event.stopPropagation()} data-kind={kind} data-draft-weapon={draft} showCloseButton={false} initialFocus={() => document.getElementById(`${uid}-search`)}>
      <DialogHeader className="armory-dialog-header">
        <div className="armory-dialog-heading">
          <div className="armory-heading-copy"><div className="armory-eyebrow"><ShieldIcon aria-hidden="true" />THE ARMORY<Badge variant="outline">{snapshot.entries.length} {kind === 'melee' ? 'melee weapons' : 'weapons'}</Badge></div><DialogTitle>{title}</DialogTitle><DialogDescription>Find your style. Inspect a weapon, then equip it.</DialogDescription></div>
          <Button variant="ghost" size="icon-lg" data-armory-action="cancel" aria-label="Close armory" onClick={() => changeOpen(false)}><XIcon /></Button>
        </div>
      </DialogHeader>
      <Tabs value={category} onValueChange={value => setCategory(String(value))} className="armory-tabs">
        <div className="armory-browser-toolbar">
          <div className="armory-category-scroll"><TabsList variant="armory" aria-label="Weapon categories">{categories.map(item => <TabsTrigger key={item.id} value={item.id} data-category={item.id}>{item.label}<span className="armory-category-count">{item.count}</span></TabsTrigger>)}</TabsList></div>
          <FieldGroup className="armory-search-group"><Field><FieldLabel htmlFor={`${uid}-search`} className="va:sr-only">Search weapons</FieldLabel><div className="armory-search-box"><SearchIcon aria-hidden="true" /><Input id={`${uid}-search`} data-armory-search type="search" placeholder="Search weapons…" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" /></div></Field></FieldGroup>
        </div>
        <div className="armory-body">
          <div className="armory-catalog">
            <div className="armory-results-line"><span>{visible.length} {visible.length === 1 ? 'weapon' : 'weapons'}{category === 'all' ? ' in your armory' : ` · ${categories.find(item => item.id === category)?.label}`}</span><span>Choose to inspect</span></div>
            {categories.map(item => <TabsContent key={item.id} value={item.id} hidden={category !== item.id} className="armory-catalog-panel">
              {visible.length ? <FieldSet className="armory-weapon-fieldset"><FieldLegend className="va:sr-only">Choose a {kind === 'melee' ? 'melee weapon' : 'gun'} to preview</FieldLegend><RadioGroup value={draft} onValueChange={value => setDraft(String(value))} className="armory-weapon-grid" aria-label="Weapon preview selection">{visible.map(entry => <WeaponTile key={entry.id} entry={entry} selected={draft === entry.id} equipped={snapshot.value === entry.id} choiceId={`${uid}-${item.id}-${entry.id}`} />)}</RadioGroup></FieldSet> : <Empty className="armory-empty"><EmptyHeader><EmptyTitle>No weapons found</EmptyTitle><EmptyDescription>Try another name or weapon category.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={() => { setQuery(''); setCategory('all'); }}>Clear filters</Button></EmptyContent></Empty>}
            </TabsContent>)}
          </div>
          <aside className="armory-detail" aria-label="Selected weapon details">
            {previewed ? <Card variant="detail">
              <CardHeader><div className="armory-detail-badges"><Badge variant="outline">{previewed.categoryLabel}</Badge>{previewed.weapon?.valorant && <Badge variant="secondary">VALORANT collection</Badge>}{snapshot.value === previewed.id && <Badge variant="secondary">Equipped</Badge>}</div><CardTitle>{previewed.name}</CardTitle><CardDescription>{descriptionSummary(previewed.description) || 'Inspect the weapon before adding it to your loadout.'}</CardDescription></CardHeader>
              <CardContent>{open && <WeaponPreview entry={previewed} kind={kind} />}<div className="armory-desktop-stats"><StatList entry={previewed} /></div><Accordion className="armory-mobile-details" key={previewed.id}><AccordionItem value="details"><AccordionTrigger data-armory-action="details"><span className="armory-mobile-only">Weapon details & stats</span><span className="armory-desktop-only">Handling notes</span></AccordionTrigger><AccordionContent><CardDescription>{previewed.description || 'Inspect the weapon before adding it to your loadout.'}</CardDescription><div className="armory-mobile-stats"><StatList entry={previewed} /></div></AccordionContent></AccordionItem></Accordion></CardContent>
              <CardFooter><span>{kind === 'gun' ? 'Damage shown at close range. Range and aim affect each hit.' : 'Stats describe the primary strike.'}</span></CardFooter>
            </Card> : <Empty><EmptyHeader><EmptyTitle>Choose a weapon</EmptyTitle><EmptyDescription>Select a card to inspect its model and stats.</EmptyDescription></EmptyHeader></Empty>}
          </aside>
        </div>
      </Tabs>
      <DialogFooter className="armory-dialog-footer">
        <div className="armory-equipped-note"><span>Current loadout</span><strong>{selected?.name || 'No weapon selected'}</strong></div>
        <div className="armory-footer-actions"><Button variant="outline" data-armory-action="cancel" onClick={() => changeOpen(false)}>Cancel</Button><Button variant="equip" size="lg" data-armory-action="equip" disabled={!previewed || previewed.disabled || snapshot.disabled} onClick={() => { if (previewed && onCommit(previewed.id)) changeOpen(false); }}>Equip {previewed?.name || 'weapon'}<ArrowRightIcon data-icon="inline-end" /></Button></div>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

const mounted = new WeakMap<HTMLSelectElement, WeaponArmoryController>();

/** The native selector remains authoritative. Browsing changes only modal draft. */
export function mountWeaponArmory({ select, title, kind = 'gun', portalContainer }: WeaponArmoryOptions): WeaponArmoryController {
  if (!select || select.tagName !== 'SELECT') throw new TypeError('mountWeaponArmory requires a native select');
  const existing = mounted.get(select);
  if (existing) { existing.sync(); return existing; }
  const host = select.ownerDocument.createElement('div');
  host.className = 'voxel-armory-root';
  host.dataset.voxelArmory = '';
  host.dataset.selectId = select.id;
  const previous = { hidden: select.hidden, tabIndex: select.getAttribute('tabindex'), ariaHidden: select.getAttribute('aria-hidden') };
  select.insertAdjacentElement('afterend', host);
  const root = createRoot(host);
  const commands = React.createRef<ArmoryCommands>();
  let destroyed = false;
  let lastValue: string | undefined;
  let lastDisabled: boolean | undefined;
  let optionsChanged = true;
  const onCommit = (id: string) => {
    const option = Array.from(select.options).find(option => option.value === id);
    if (destroyed || select.disabled || !option || option.disabled || (option.parentElement?.tagName === 'OPTGROUP' && (option.parentElement as HTMLOptGroupElement).disabled)) return false;
    if (select.value !== id) {
      select.value = id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    controller.sync();
    return true;
  };
  const render = () => {
    if (destroyed || (!optionsChanged && lastValue === select.value && lastDisabled === select.disabled)) return;
    lastValue = select.value; lastDisabled = select.disabled; optionsChanged = false;
    host.dataset.selectedWeapon = select.value;
    host.dataset.disabled = String(select.disabled);
    const snapshot: Snapshot = { value: select.value, disabled: select.disabled, entries: createArmoryEntries(select, kind) as Entry[] };
    root.render(<Armory snapshot={snapshot} kind={kind} portalContainer={portalContainer} title={title || (kind === 'melee' ? 'Choose your melee weapon' : 'Choose your weapon')} onCommit={onCommit} commandRef={commands} />);
  };
  const observer = new MutationObserver(records => {
    if (records.some(record => record.target !== select || record.type !== 'attributes')) optionsChanged = true;
    render();
  });
  const controller: WeaponArmoryController = {
    sync: render,
    close: () => commands.current?.close(),
    isOpen: () => commands.current?.isOpen() || false,
    focus: () => commands.current?.focus(),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect(); select.removeEventListener('change', render);
      root.unmount(); host.remove(); mounted.delete(select);
      select.hidden = previous.hidden;
      if (previous.tabIndex === null) select.removeAttribute('tabindex'); else select.setAttribute('tabindex', previous.tabIndex);
      if (previous.ariaHidden === null) select.removeAttribute('aria-hidden'); else select.setAttribute('aria-hidden', previous.ariaHidden);
    },
  };
  try {
    flushSync(render);
    select.hidden = true; select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
    select.addEventListener('change', render);
    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected', 'value', 'label'], characterData: true });
    mounted.set(select, controller);
  } catch (error) { controller.destroy(); throw error; }
  return controller;
}
