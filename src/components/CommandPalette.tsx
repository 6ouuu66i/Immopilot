import {
  ArrowLeftRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ContactRound,
  Home,
  ListChecks,
  Search,
  Settings,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatEuro } from '../lib/formatCurrency';
import { sentenceCaseIfShouty, titleCaseIfShouty } from '../lib/formatText';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSearchBiens: (query: string) => void;
}

interface PropertyHit {
  listing_id: string;
  property_id: string | null;
  title_fr: string | null;
  locality: string | null;
  postal_code: string | null;
  price: number | null;
  primary_photo_url: string | null;
  seller_score: number | null;
}

interface PaletteEntry {
  id: string;
  group: 'biens' | 'navigation' | 'actions';
  label: string;
  sublabel?: string;
  photo?: string | null;
  score?: number | null;
  icon?: typeof Home;
  run: () => void;
}

const NAV_TARGETS: Array<{ label: string; hash: string; icon: typeof Home; keywords: string }> = [
  { label: 'Tableau de bord', hash: '#dashboard', icon: Home, keywords: 'dashboard accueil tableau' },
  { label: 'Biens', hash: '#biens', icon: Building2, keywords: 'biens propriétés annonces liste' },
  { label: 'Opportunités', hash: '#pipeline', icon: BriefcaseBusiness, keywords: 'pipeline deals opportunités mandats' },
  { label: 'Contacts', hash: '#contacts', icon: ContactRound, keywords: 'contacts vendeurs clients' },
  { label: 'Tâches', hash: '#agenda', icon: ListChecks, keywords: 'tâches agenda rappels' },
  { label: 'Transferts', hash: '#transfers', icon: ArrowLeftRight, keywords: 'transferts équipe' },
  { label: 'Commissions', hash: '#commissions', icon: CircleDollarSign, keywords: 'commissions revenus' },
  { label: 'Paramètres', hash: '#settings', icon: Settings, keywords: 'paramètres réglages profil' },
];

function sanitizeQuery(raw: string): string {
  return raw.replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function searchProperties(query: string): Promise<PropertyHit[]> {
  if (!supabase) return [];
  const sanitized = sanitizeQuery(query);
  if (sanitized.length < 2) return [];

  const { data, error } = await supabase
    .from('active_properties_canonical_mat')
    .select('listing_id, property_id, title_fr, locality, postal_code, price, primary_photo_url, seller_score')
    .or(`title_fr.ilike.%${sanitized}%,locality.ilike.%${sanitized}%,postal_code.ilike.%${sanitized}%`)
    .order('last_seen_at', { ascending: false })
    .limit(6)
    .returns<PropertyHit[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function CommandPalette({ open, onClose, onSearchBiens }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PropertyHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHits([]);
    setActiveIndex(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Recherche biens débouncée (250 ms), bornée à 6 résultats côté serveur.
  useEffect(() => {
    if (!open) return;
    const sanitized = sanitizeQuery(query);
    if (sanitized.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchProperties(sanitized)
        .then((results) => {
          if (!cancelled) setHits(results);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const needle = query.trim().toLowerCase();
    const list: PaletteEntry[] = [];

    for (const hit of hits) {
      list.push({
        id: `bien-${hit.listing_id}`,
        group: 'biens',
        label: sentenceCaseIfShouty(hit.title_fr?.trim() || [hit.locality, hit.postal_code].filter(Boolean).join(' ') || 'Bien sans titre'),
        sublabel: [hit.locality ? titleCaseIfShouty(hit.locality) : null, hit.postal_code, hit.price !== null ? formatEuro(hit.price) : null]
          .filter(Boolean)
          .join(' · '),
        photo: hit.primary_photo_url,
        score: hit.seller_score,
        run: () => {
          window.location.hash = hit.property_id ? `#biens?propertyId=${hit.property_id}` : '#biens';
        },
      });
    }

    const navMatches = needle
      ? NAV_TARGETS.filter((target) => `${target.label} ${target.keywords}`.toLowerCase().includes(needle))
      : NAV_TARGETS.slice(0, 5);
    for (const target of navMatches) {
      list.push({
        id: `nav-${target.hash}`,
        group: 'navigation',
        label: target.label,
        icon: target.icon,
        run: () => {
          window.location.hash = target.hash;
        },
      });
    }

    if (needle.length >= 2) {
      list.push({
        id: 'action-search-biens',
        group: 'actions',
        label: `Rechercher « ${query.trim()} » dans les biens`,
        icon: Search,
        run: () => onSearchBiens(query.trim()),
      });
    }
    list.push({
      id: 'action-create-task',
      group: 'actions',
      label: 'Créer une tâche',
      icon: CalendarDays,
      run: () => {
        window.location.hash = '#agenda';
      },
    });

    return list;
  }, [hits, query, onSearchBiens]);

  useEffect(() => {
    setActiveIndex(0);
  }, [entries.length]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const runEntry = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    onClose();
    entry.run();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(entries.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runEntry(entries[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let renderedGroup: PaletteEntry['group'] | null = null;
  const groupTitles: Record<PaletteEntry['group'], string> = {
    biens: 'Biens',
    navigation: 'Navigation',
    actions: 'Actions',
  };

  return (
    <div className="ip-palette-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="ip-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Recherche rapide"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <label className="ip-palette-input">
          <Search size={16} strokeWidth={1.9} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Rechercher un bien, une ville, un code postal..."
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Recherche rapide"
          />
          {searching && <span className="ip-palette-spinner" aria-hidden="true" />}
        </label>

        <div className="ip-palette-list" ref={listRef}>
          {entries.length === 0 && !searching && (
            <p className="ip-palette-empty">
              {sanitizeQuery(query).length >= 2 ? 'Aucun résultat.' : 'Tapez pour rechercher un bien ou naviguer.'}
            </p>
          )}
          {entries.map((entry, index) => {
            const showGroup = entry.group !== renderedGroup;
            renderedGroup = entry.group;
            const Icon = entry.icon;
            return (
              <div key={entry.id}>
                {showGroup && <p className="ip-palette-group">{groupTitles[entry.group]}</p>}
                <button
                  type="button"
                  className="ip-palette-item"
                  data-active={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runEntry(entry)}
                >
                  {entry.photo !== undefined ? (
                    entry.photo ? (
                      <img src={entry.photo} alt="" loading="lazy" />
                    ) : (
                      <span className="ip-palette-thumb" aria-hidden="true" />
                    )
                  ) : Icon ? (
                    <span className="ip-palette-icon" aria-hidden="true">
                      <Icon size={15} strokeWidth={1.8} />
                    </span>
                  ) : null}
                  <span className="ip-palette-copy">
                    <strong>{entry.label}</strong>
                    {entry.sublabel && <small>{entry.sublabel}</small>}
                  </span>
                  {typeof entry.score === 'number' && entry.score > 0 && (
                    <span className="ip-palette-score">{Math.round(entry.score)}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <footer className="ip-palette-foot">
          <span><kbd>↑↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> ouvrir</span>
          <span><kbd>échap</kbd> fermer</span>
        </footer>
      </div>
    </div>
  );
}
