import biensBanner from '../assets/biens-banner.png..png';
import biensBannerRight from '../assets/biens-banner-right.png';
import {
  Bath,
  Bed,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Heart,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PropertyCard } from '../components/biens/PropertyCard';
import type { store as appStore } from '../lib/store';
import type { Property } from '../types';

type Store = typeof appStore;

interface BiensProps {
  store: Store;
}

type ViewMode = 'grid' | 'list';
type SortKey = 'recent' | 'price_asc' | 'price_desc' | 'score';

const PAGE_SIZE = 16;

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Plus récents',
  price_asc: 'Prix croissant',
  price_desc: 'Prix décroissant',
  score: 'Meilleur score',
};

export function Biens({ store }: BiensProps) {
  const [, forceUpdate] = useState(0);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortKey>('recent');
  const [filterCommune, setFilterCommune] = useState('Toutes');
  const [filterSource, setFilterSource] = useState('Toutes');
  const [filterSignal, setFilterSignal] = useState('Tous');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [carouselMap, setCarouselMap] = useState<Record<number, number>>({});
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [panelPhotoIndex, setPanelPhotoIndex] = useState(0);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1);
    window.addEventListener('ip-state-changed', handler);
    return () => window.removeEventListener('ip-state-changed', handler);
  }, []);

  const allProps = store.getProperties();
  const currentAgent = store.getCurrentAgent();

  const communes = useMemo(() => {
    const set = new Set(allProps.map((p) => p.city));
    return ['Toutes', ...Array.from(set).sort()];
  }, [allProps]);

  const sources = useMemo(() => {
    const set = new Set(allProps.map((p) => p.source));
    return ['Toutes', ...Array.from(set).sort()];
  }, [allProps]);

  const filtered = useMemo(() => {
    let list = allProps;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q) ||
          p.source.toLowerCase().includes(q)
      );
    }
    if (filterCommune !== 'Toutes') list = list.filter((p) => p.city === filterCommune);
    if (filterSource !== 'Toutes') list = list.filter((p) => p.source === filterSource);
    if (filterSignal === 'FSBO') list = list.filter((p) => p.fsbo);
    if (filterSignal === 'Baisse de prix') list = list.filter((p) => p.tag === 'Baisse de prix');
    if (favoritesOnly) list = list.filter((p) => store.getMarks(p.id).favorite);

    switch (sort) {
      case 'price_asc': list = [...list].sort((a, b) => a.price - b.price); break;
      case 'price_desc': list = [...list].sort((a, b) => b.price - a.price); break;
      case 'score': list = [...list].sort((a, b) => b.score - a.score); break;
      default: list = [...list].sort((a, b) => b.publishedDays - a.publishedDays); break;
    }

    return list;
  }, [allProps, search, filterCommune, filterSource, filterSignal, favoritesOnly, sort, store]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedProperty = selectedPropertyId ? allProps.find((property) => property.id === selectedPropertyId) : undefined;
  const panelOpen = Boolean(selectedProperty);

  const favCount = allProps.filter((p) => store.getMarks(p.id).favorite).length;
  const disponibles = allProps.filter((p) => !p.reserved).length;
  const fsboCount = allProps.filter((p) => p.fsbo).length;
  const avgScore = allProps.length
    ? Math.round(allProps.reduce((s, p) => s + p.score, 0) / allProps.length)
    : 0;

  useEffect(() => {
    if (!panelOpen) return undefined;

    window.dispatchEvent(new Event('ip-property-panel-open'));

    return () => {
      window.dispatchEvent(new Event('ip-property-panel-close'));
    };
  }, [panelOpen]);

  const handleCarousel = (id: number, dir: 1 | -1) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setCarouselMap((prev) => {
      const prop = allProps.find((p) => p.id === id);
      if (!prop) return prev;
      const len = prop.photos.length;
      const cur = prev[id] ?? 0;
      return { ...prev, [id]: ((cur + dir) % len + len) % len };
    });
  };

  const handleFav = (id: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    store.togglePropertyFavorite(id);
  };

  const resetFilters = () => {
    setSearch('');
    setFilterCommune('Toutes');
    setFilterSource('Toutes');
    setFilterSignal('Tous');
    setFavoritesOnly(false);
    setPage(1);
  };

  const selectProperty = (id: number) => {
    setSelectedPropertyId(id);
    setPanelPhotoIndex(0);
    setNoteDraft('');
  };

  const openDefaultPanel = () => {
    const target = selectedProperty ?? pageItems[0] ?? allProps[0];
    if (target) selectProperty(target.id);
  };

  const closePanel = () => {
    setSelectedPropertyId(null);
    setNoteDraft('');
    setPanelPhotoIndex(0);
  };

  const savePanelNote = () => {
    if (!selectedProperty || !noteDraft.trim()) return;
    store.registerNoteToProperty(selectedProperty.id, noteDraft.trim());
    setNoteDraft('');
  };

  return (
    <div
      style={{
        minHeight: '100%',
        background: '#F7F6F3',
        fontFamily: 'var(--notion-sans)',
        position: 'relative',
        paddingRight: selectedProperty ? 462 : 0,
        transition: 'padding-right 180ms ease',
      }}
    >
      {/* ── Page Header ───────────────────────────── */}
      <div
        style={{
          padding: selectedProperty ? '0 4px 0 32px' : '0 32px 0',
          display: 'flex',
          gap: 12,
          alignItems: 'stretch',
          minHeight: 170,
        }}
      >
        {/* Zone gauche */}
        <div style={{ flex: 1, display: 'flex', gap: 16, alignItems: 'stretch', minWidth: 0 }}>
          {/* Conteneur illustration gauche */}
          <div
            style={{
              flex: '0 0 260px',
              marginLeft: -12,
              borderRadius: 10,
              overflow: 'hidden',
              backgroundImage: `url(${biensBanner})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
              backgroundBlendMode: 'multiply',
              backgroundColor: '#F7F6F3',
            }}
          />
          {/* Titre */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 700,
                fontFamily: 'var(--notion-serif)',
                color: '#1D1F1E',
                letterSpacing: '-0.02em',
              }}
            >
              Biens
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B6F6D' }}>
              Base de données des propriétés prospectées
            </p>
          </div>
        </div>

        {/* Conteneur illustration droite */}
        <div
          style={{
            flexShrink: 0,
            width: 460,
            alignSelf: 'stretch',
            borderRadius: 10,
            overflow: 'hidden',
            backgroundImage: `url(${biensBannerRight})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center bottom',
            backgroundRepeat: 'no-repeat',
            transform: 'translate(8px, 16px)',
            boxShadow: 'inset 0 -6px 0 #F7F6F3',
          }}
        />
      </div>

      {/* ── KPI Row ───────────────────────────────── */}
      <div style={{ padding: '4px 32px 0', display: 'flex', alignItems: 'stretch', gap: 12, marginTop: -16, position: 'relative', zIndex: 2 }}>
        {/* Conteneur blanc : 4 KPI uniquement */}
        <div
          style={{
            flex: 1,
            background: '#fff',
            border: '1px solid #E6E4DF',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          <KpiCard label="BIENS DISPONIBLES" value={disponibles} delta="↑12 nouveaux ce jour" />
          <KpiCard label="FSBO" value={fsboCount} delta="↑5 cette semaine" />
          <KpiCard label="SCORE IA MOYEN" value={avgScore} delta="↑3% ce mois" />
          <KpiCard label="MES FAVORIS" value={favCount} delta="☆2 cette semaine" last />
        </div>

        {/* Boutons empilés à droite du conteneur KPI */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={openDefaultPanel}
            style={{
              background: '#fff',
              border: '1px solid #E6E4DF',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'var(--notion-sans)',
              color: '#1D1F1E',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <LayoutGrid size={14} />
            Ouvrir mini fiche
          </button>
          <button
            style={{
              background: '#1E5A3A',
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--notion-sans)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={14} />
            Ajouter un bien
          </button>
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────── */}
      <div
        style={{
          padding: selectedProperty ? '16px 4px 0 32px' : '16px 32px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Search */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9A9A9A' }}
          />
          <input
            type="text"
            placeholder="Rechercher un bien, ville, source..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              paddingLeft: 36,
              paddingRight: 12,
              height: 38,
              border: '1px solid #E6E4DF',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'var(--notion-sans)',
              background: '#fff',
              color: '#1D1F1E',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* View toggle */}
        <div
          style={{
            display: 'flex',
            border: '1px solid #E6E4DF',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setViewMode('grid')}
            style={{
              background: viewMode === 'grid' ? '#1E5A3A' : '#fff',
              border: 'none',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: viewMode === 'grid' ? '#fff' : '#6B6F6D',
            }}
            title="Vue grille"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              background: viewMode === 'list' ? '#1E5A3A' : '#fff',
              border: 'none',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: viewMode === 'list' ? '#fff' : '#6B6F6D',
              borderLeft: '1px solid #E6E4DF',
            }}
            title="Vue liste"
          >
            <List size={15} />
          </button>
        </div>

        {/* Sort dropdown — aligné à droite sous "Ajouter un bien" */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            onClick={() => setSortOpen((o) => !o)}
            style={{
              background: '#fff',
              border: '1px solid #E6E4DF',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontFamily: 'var(--notion-sans)',
              color: '#1D1F1E',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {SORT_LABELS[sort]}
            <ChevronRight size={14} style={{ transform: sortOpen ? 'rotate(90deg)' : 'rotate(0)', transition: '0.15s' }} />
          </button>
          {sortOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 4px)',
                background: '#fff',
                border: '1px solid #E6E4DF',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                zIndex: 50,
                minWidth: 160,
                overflow: 'hidden',
              }}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => { setSort(key); setSortOpen(false); setPage(1); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 14px',
                    fontSize: 13,
                    fontFamily: 'var(--notion-sans)',
                    background: sort === key ? '#F3F2EF' : '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#1D1F1E',
                    fontWeight: sort === key ? 600 : 400,
                  }}
                >
                  {SORT_LABELS[key]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────── */}
      <div style={{ padding: '12px 32px 0' }}>
        <div
          style={{
            background: '#F3F2EF',
            border: '1px solid #E6E4DF',
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: '#6B6F6D',
              letterSpacing: '0.05em',
              flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={13} />
            FILTRES ACTIFS:
          </span>

          <FilterChip
            label={`Communes (${filterCommune})`}
            options={communes}
            value={filterCommune}
            onChange={(v) => { setFilterCommune(v); setPage(1); }}
          />
          <FilterChip
            label={`Sources (${filterSource})`}
            options={sources}
            value={filterSource}
            onChange={(v) => { setFilterSource(v); setPage(1); }}
          />
          <FilterChip
            label={`Signaux IA (${filterSignal})`}
            options={['Tous', 'FSBO', 'Baisse de prix', 'Republié', 'Nouveau']}
            value={filterSignal}
            onChange={(v) => { setFilterSignal(v); setPage(1); }}
          />

          <button
            onClick={() => { setFavoritesOnly((f) => !f); setPage(1); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: favoritesOnly ? '#FFF3D8' : '#fff',
              border: '1px solid #E6E4DF',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              fontFamily: 'var(--notion-sans)',
              color: favoritesOnly ? '#92400E' : '#6B6F6D',
              cursor: 'pointer',
              fontWeight: favoritesOnly ? 600 : 400,
            }}
          >
            <Star size={12} fill={favoritesOnly ? '#D97706' : 'none'} color={favoritesOnly ? '#D97706' : '#6B6F6D'} />
            Favoris uniquement
          </button>

          {/* Réinitialiser poussé tout à droite */}
          <button
            onClick={resetFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              fontSize: 12,
              fontFamily: 'var(--notion-sans)',
              color: '#9A9A9A',
              cursor: 'pointer',
              padding: '5px 6px',
              marginLeft: 'auto',
            }}
          >
            <RotateCcw size={11} />
            Réinitialiser
          </button>
        </div>
      </div>

      {/* ── Count + pagination ────────────────────── */}
      <div
        style={{
          padding: '14px 32px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 13, color: '#6B6F6D' }}>
          <strong style={{ color: '#1D1F1E' }}>{filtered.length}</strong> biens affichés
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6B6F6D' }}>
          Page&nbsp;<strong style={{ color: '#1D1F1E' }}>{page}</strong>&nbsp;/&nbsp;{totalPages}
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              background: '#fff', border: '1px solid #E6E4DF', borderRadius: 6,
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              background: '#fff', border: '1px solid #E6E4DF', borderRadius: 6,
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1,
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Grid / List ───────────────────────────── */}
      <div style={{ padding: selectedProperty ? '16px 4px 32px 32px' : '16px 32px 32px' }}>
        {viewMode === 'grid' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: selectedProperty ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
              gap: 16,
            }}
          >
            {pageItems.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                carouselIndex={carouselMap[p.id] ?? 0}
                onCarouselPrev={handleCarousel(p.id, -1)}
                onCarouselNext={handleCarousel(p.id, 1)}
                onToggleFavorite={handleFav(p.id)}
                onSelect={() => selectProperty(p.id)}
                isFavorite={store.getMarks(p.id).favorite}
                selected={selectedPropertyId === p.id}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pageItems.map((p) => (
              <ListRow
                key={p.id}
                property={p}
                isFavorite={store.getMarks(p.id).favorite}
                onToggleFavorite={handleFav(p.id)}
                onSelect={() => selectProperty(p.id)}
                selected={selectedPropertyId === p.id}
              />
            ))}
          </div>
        )}

        {pageItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#9A9A9A', fontSize: 14 }}>
            Aucun bien ne correspond à vos filtres.
          </div>
        )}
      </div>
      {selectedProperty && (
        <LegacyMiniFicheBien
          property={selectedProperty}
          store={store}
          currentAgentName={currentAgent.name}
          photoIndex={panelPhotoIndex}
          setPhotoIndex={setPanelPhotoIndex}
          noteDraft={noteDraft}
          setNoteDraft={setNoteDraft}
          onSaveNote={savePanelNote}
          onClose={closePanel}
          onToggleFavorite={handleFav(selectedProperty.id)}
          isFavorite={store.getMarks(selectedProperty.id).favorite}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  delta: string;
  last?: boolean;
}

function KpiCard({ label, value, delta, last }: KpiCardProps) {
  return (
    <div
      style={{
        flex: 1,
        padding: '14px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        borderRight: last ? 'none' : '1px solid #E6E4DF',
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#9A9A9A', fontFamily: 'var(--notion-sans)' }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 700, color: '#1D1F1E', fontFamily: 'var(--notion-sans)', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#6B6F6D', fontFamily: 'var(--notion-sans)' }}>
        {delta}
      </span>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
}

function FilterChip({ label, options, value, onChange }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const isActive = value !== options[0];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: isActive ? '#F3F2EF' : '#fff',
          border: '1px solid #E6E4DF',
          borderRadius: 6,
          padding: '5px 10px',
          fontSize: 12,
          fontFamily: 'var(--notion-sans)',
          color: '#1D1F1E',
          cursor: 'pointer',
          fontWeight: isActive ? 600 : 400,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
        <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: '0.12s' }} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: '#fff',
            border: '1px solid #E6E4DF',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            zIndex: 50,
            minWidth: 150,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 14px',
                fontSize: 13,
                fontFamily: 'var(--notion-sans)',
                background: value === opt ? '#F3F2EF' : '#fff',
                border: 'none',
                cursor: 'pointer',
                color: '#1D1F1E',
                fontWeight: value === opt ? 600 : 400,
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const priceFormatter = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface MiniFicheBienProps {
  property: Property;
  store: Store;
  currentAgentName: string;
  photoIndex: number;
  setPhotoIndex: (index: number) => void;
  noteDraft: string;
  setNoteDraft: (value: string) => void;
  onSaveNote: () => void;
  onClose: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  isFavorite: boolean;
}

function MiniFicheBien({
  property,
  store,
  currentAgentName,
  photoIndex,
  setPhotoIndex,
  noteDraft,
  setNoteDraft,
  onSaveNote,
  onClose,
  onToggleFavorite,
  isFavorite,
}: MiniFicheBienProps) {
  const photos = property.photos.length > 0
    ? property.photos
    : ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80'];
  const currentPhoto = photos[photoIndex % photos.length];
  const price = priceFormatter.format(property.price).replace(/\s?EUR/, ' €');
  const relatedSignals = store.getSignals().filter((signal) => signal.propertyId === property.id).slice(0, 4);
  const relatedDeal = store.getDeals().find((deal) => deal.propertyId === property.id);
  const relatedContact = relatedDeal ? store.getContact(relatedDeal.contactId) : undefined;
  const relatedTasks = store.getTasks().filter((task) => task.propertyId === property.id).slice(0, 4);
  const ownerAgent = property.ownerId ? store.getAgents().find((agent) => agent.id === property.ownerId) : undefined;
  const priceHistory = property.priceHistory?.slice(-3) ?? [];
  const latestDrop = priceHistory.length > 1
    ? priceHistory[priceHistory.length - 2].price - priceHistory[priceHistory.length - 1].price
    : 0;

  const goToPhoto = (direction: 1 | -1) => {
    setPhotoIndex((photoIndex + direction + photos.length) % photos.length);
  };

  return (
    <aside
      style={{
        position: 'fixed',
        top: 58,
        right: 0,
        bottom: 0,
        width: 392,
        zIndex: 30,
        background: '#FFFFFF',
        borderLeft: '1px solid #E6E4DF',
        boxShadow: '-10px 0 30px rgba(31, 31, 31, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--notion-sans)',
      }}
      aria-label="Mini fiche bien"
    >
      <div
        style={{
          height: 52,
          padding: '0 16px',
          borderBottom: '1px solid #E6E4DF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#9A9A9A', letterSpacing: '0.08em' }}>
            MINI FICHE
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 650, color: '#1D1F1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {property.title}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1px solid #E6E4DF',
            background: '#fff',
            color: '#6B6F6D',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="Fermer la mini fiche"
        >
          <X size={15} />
        </button>
      </div>

      <div style={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
        <div style={{ position: 'relative', height: 218, background: '#F3F2EF', overflow: 'hidden' }}>
          <img src={currentPhoto} alt={property.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => goToPhoto(-1)}
                style={galleryButtonStyle('left')}
                aria-label="Photo précédente"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => goToPhoto(1)}
                style={galleryButtonStyle('right')}
                aria-label="Photo suivante"
              >
                <ChevronRight size={16} />
              </button>
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 10,
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: 5,
                }}
              >
                {photos.map((_, index) => (
                  <span
                    key={index}
                    style={{
                      width: index === photoIndex % photos.length ? 16 : 6,
                      height: 6,
                      borderRadius: 99,
                      background: index === photoIndex % photos.length ? '#fff' : 'rgba(255,255,255,0.55)',
                    }}
                  />
                ))}
              </div>
            </>
          )}
          <div
            style={{
              position: 'absolute',
              left: 14,
              bottom: 14,
              right: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 12,
            }}
          >
            <div style={{ color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,0.55)' }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{price}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 600 }}>{property.city} · {property.source}</p>
            </div>
            <span
              style={{
                padding: '5px 9px',
                borderRadius: 999,
                background: property.reserved ? '#F3F2EF' : '#EAF7EF',
                color: property.reserved ? '#6B6F6D' : '#166534',
                border: '1px solid rgba(255,255,255,0.45)',
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {property.reserved ? 'Réservé' : 'Disponible'}
            </span>
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section style={miniSectionStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <MiniMetric icon={<Square size={14} />} label="Surface" value={`${property.surface} m²`} />
              <MiniMetric icon={<Bed size={14} />} label="Chambres" value={String(property.bedrooms)} />
              <MiniMetric icon={<Bath size={14} />} label="Sdb" value={String(property.bathrooms)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
              <MiniMetric icon={<Star size={14} />} label="Score IA" value={String(property.score)} />
              <MiniMetric icon={<Clock size={14} />} label="En ligne" value={`${property.publishedDays} j`} />
              <MiniMetric icon={<FileText size={14} />} label="PEB" value={property.peb} />
            </div>
          </section>

          <section style={miniSectionStyle}>
            <MiniSectionTitle title="Résumé" />
            <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: '#3F3F3F' }}>
              {property.description || `Bien détecté sur ${property.source}, à analyser pour une prospection ciblée.`}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <MiniTag label={property.tag || 'Nouveau'} tone="warm" />
              {property.fsbo && <MiniTag label="FSBO" tone="green" />}
              {latestDrop > 0 && <MiniTag label={`Baisse ${priceFormatter.format(latestDrop).replace(/\s?EUR/, ' €')}`} tone="red" />}
              <MiniTag label={`Suivi par ${ownerAgent?.name ?? currentAgentName}`} tone="neutral" />
            </div>
          </section>

          <section style={miniSectionStyle}>
            <MiniSectionTitle title="Signaux à traiter" />
            {relatedSignals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 9 }}>
                {relatedSignals.map((signal) => (
                  <div key={signal.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: 99, background: signal.type === 'drop' ? '#D97706' : '#1E5A3A', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 650, color: '#1D1F1E' }}>{signal.heading}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B6F6D' }}>{signal.time} · {signal.source ?? property.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={emptyMiniTextStyle}>Aucun signal spécifique sur ce bien pour le moment.</p>
            )}
          </section>

          <section style={miniSectionStyle}>
            <MiniSectionTitle title="Pipeline & contact" />
            <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <InfoRow label="Statut" value={relatedDeal?.stage ?? 'Pas encore en pipeline'} />
              <InfoRow label="Contact" value={relatedContact ? `${relatedContact.name} · ${relatedContact.phone}` : 'Aucun contact lié'} />
              <InfoRow label="Zone" value={`${property.city} · ${property.floodZone}`} />
              <InfoRow label="Rendement" value={property.yieldEstimate || 'Non calculé'} />
            </div>
          </section>

          <section style={miniSectionStyle}>
            <MiniSectionTitle title="Historique prix" />
            {priceHistory.length > 0 ? (
              <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {priceHistory.map((point) => (
                  <InfoRow key={`${point.date}-${point.price}`} label={point.date} value={priceFormatter.format(point.price).replace(/\s?EUR/, ' €')} />
                ))}
              </div>
            ) : (
              <p style={emptyMiniTextStyle}>Pas encore d'historique de prix.</p>
            )}
          </section>

          <section style={miniSectionStyle}>
            <MiniSectionTitle title="Tâches liées" />
            {relatedTasks.length > 0 ? (
              <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {relatedTasks.map((task) => (
                  <div key={task.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: task.done ? '#1E5A3A' : '#D97706', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: '#1D1F1E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#9A9A9A' }}>{task.date} · {task.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={emptyMiniTextStyle}>Aucune tâche attachée à ce bien.</p>
            )}
          </section>

          <section style={miniSectionStyle}>
            <MiniSectionTitle title="Notes" />
            <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
              <input
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSaveNote();
                }}
                placeholder="Ajouter une note interne..."
                style={{
                  flex: 1,
                  height: 34,
                  border: '1px solid #E6E4DF',
                  borderRadius: 8,
                  padding: '0 10px',
                  font: 'inherit',
                  fontSize: 12.5,
                  outline: 'none',
                }}
              />
              <button type="button" onClick={onSaveNote} style={smallPrimaryButtonStyle}>
                Ajouter
              </button>
            </div>
            {property.notes.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {property.notes.slice(0, 3).map((note, index) => (
                  <p key={`${note}-${index}`} style={{ margin: 0, padding: '8px 10px', borderRadius: 8, background: '#F7F6F3', fontSize: 12, color: '#3F3F3F', lineHeight: 1.4 }}>
                    {note}
                  </p>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderTop: '1px solid #E6E4DF',
          background: '#fff',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={onToggleFavorite} style={secondaryActionStyle}>
          <Heart size={14} fill={isFavorite ? '#D97706' : 'none'} color={isFavorite ? '#D97706' : '#6B6F6D'} />
          {isFavorite ? 'Favori' : 'Marquer favori'}
        </button>
        <a href={relatedDeal ? '#pipeline' : '#agenda'} style={primaryActionStyle}>
          {relatedDeal ? 'Voir pipeline' : 'Planifier action'}
        </a>
      </div>
    </aside>
  );
}

function galleryButtonStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 10,
    transform: 'translateY(-50%)',
    width: 30,
    height: 30,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.72)',
    background: 'rgba(255,255,255,0.88)',
    color: '#1D1F1E',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  };
}

function LegacyMiniFicheBien({
  property,
  store,
  currentAgentName,
  photoIndex,
  setPhotoIndex,
  noteDraft,
  setNoteDraft,
  onSaveNote,
  onClose,
  onToggleFavorite,
  isFavorite,
}: MiniFicheBienProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const photos = property.photos.length > 0
    ? property.photos
    : ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80'];
  const currentPhoto = photos[photoIndex % photos.length];
  const price = priceFormatter.format(property.price).replace(/\s?EUR/, ' €');
  const relatedDeal = store.getDeals().find((deal) => deal.propertyId === property.id);
  const relatedContact = relatedDeal ? store.getContact(relatedDeal.contactId) : undefined;
  const ownerAgent = property.ownerId ? store.getAgents().find((agent) => agent.id === property.ownerId) : undefined;
  const priceHistory = property.priceHistory?.slice(-3) ?? [];
  const propType = property.title.toLowerCase().includes('appartement')
    ? 'Appartement'
    : property.title.toLowerCase().includes('loft')
      ? 'Loft'
      : property.title.toLowerCase().includes('villa')
        ? 'Villa'
        : 'Maison';
  const terrain = propType === 'Villa' || propType === 'Maison'
    ? `${(450 + (property.id * 83) % 1100).toLocaleString('fr-BE')} m²`
    : 'Non applicable';
  const propPpm = Math.round(property.price / Math.max(property.surface, 1));
  const cityAvg = Math.round(propPpm * (0.9 + ((property.id * 7) % 22) / 100));
  const deltaPercent = Math.round(((propPpm - cityAvg) / cityAvg) * 100);
  const barPercent = Math.max(8, Math.min(92, 50 + deltaPercent * 2));
  const vendorName = property.fsbo
    ? 'Mme Sophie Dumont'
    : property.source === 'Biddit'
      ? 'Étude Notariale de Groote'
      : ownerAgent?.name ?? currentAgentName;
  const vendorType = property.fsbo
    ? 'Particulier FSBO'
    : property.source === 'Biddit'
      ? 'Vente publique notaire'
      : relatedDeal
        ? `Pipeline ${relatedDeal.stage}`
        : 'Conseiller responsable';
  const vendorInitials = vendorName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const goToPhoto = (direction: 1 | -1) => {
    setPhotoIndex((photoIndex + direction + photos.length) % photos.length);
  };

  useEffect(() => {
    if (!isLightboxOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLightboxOpen(false);
      if (event.key === 'ArrowLeft') goToPhoto(-1);
      if (event.key === 'ArrowRight') goToPhoto(1);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLightboxOpen, photoIndex, photos.length]);

  return (
    <>
      <aside
        style={{
          position: 'fixed',
          top: 58,
          right: 0,
          bottom: 0,
          width: 462,
          zIndex: 30,
          background: '#FFFFFF',
          borderLeft: '1px solid #E3DED2',
          boxShadow: '-10px 0 28px rgba(29, 31, 30, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--notion-sans)',
        }}
        aria-label="Mini fiche bien"
      >
      <div style={{ padding: '14px 16px 12px', borderBottom: 'none', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
          <h2 style={{ margin: 0, color: '#1D1F1E', fontSize: 18, fontWeight: 750, lineHeight: 1.18, flex: 1, minWidth: 0 }}>
            {property.title}
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, paddingTop: 1 }}>
              <span style={{ color: '#1D1F1E', fontSize: 18, fontWeight: 750, whiteSpace: 'nowrap' }}>{price}</span>
              <span style={{ color: '#6B6F6D', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
                <strong style={{ color: deltaPercent < 0 ? '#1E5A3A' : '#A04A2E' }}>
                  {deltaPercent >= 0 ? '+' : ''}{deltaPercent}%
                </strong>{' '}
                vs moyenne locale
              </span>
            </div>
            <button type="button" onClick={onClose} style={legacyCloseButtonStyle} aria-label="Fermer la mini fiche">
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: '#6B6F6D', fontSize: 12.5, fontWeight: 500 }}>
            {property.city} · Publié il y a {property.publishedDays} j
          </span>
          <span style={legacyStatusStyle(property.reserved)}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: property.reserved ? '#C8993B' : '#1E5A3A' }} />
            {property.reserved ? 'Réservé' : 'Disponible'}
          </span>
        </div>
      </div>

      <div style={{ overflowY: 'auto', minHeight: 0, flex: 1, background: '#FFFFFF' }}>
        <div style={{ paddingTop: 12 }}>
          <div style={legacyGalleryMainStyle}>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              aria-label="Agrandir la photo"
              style={{ width: '100%', height: '100%', border: 0, padding: 0, background: 'transparent', cursor: 'zoom-in', display: 'block' }}
            >
              <img src={currentPhoto} alt={property.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
            <span style={legacyGalleryCounterStyle}>{(photoIndex % photos.length) + 1} / {photos.length}</span>
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => goToPhoto(-1)} style={galleryButtonStyle('left')} aria-label="Photo précédente">
                  <ChevronLeft size={14} />
                </button>
                <button type="button" onClick={() => goToPhoto(1)} style={galleryButtonStyle('right')} aria-label="Photo suivante">
                  <ChevronRight size={14} />
                </button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px 12px', borderBottom: '1px solid #EDE8DD' }}>
            {photos.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => setPhotoIndex(index)}
                style={legacyThumbStyle(index === photoIndex % photos.length)}
              >
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>Double Gribouillis Score IA & Confiance</div>
            <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 12, alignItems: 'center' }}>
              <div style={legacyScoreDonutStyle(property.score)}>
                <div style={{ width: 60, height: 60, borderRadius: 999, background: '#FFFFFF', display: 'grid', placeItems: 'center' }}>
                  <strong style={{ color: '#1D1F1E', fontSize: 20 }}>{property.score}</strong>
                </div>
              </div>
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1E5A3A', fontSize: 12, fontWeight: 700 }}>
                  <FileText size={13} />
                  Rapport d'analyse IA
                </span>
                <p style={{ margin: '6px 0 0', color: '#6B6F6D', fontSize: 11.5, lineHeight: 1.45 }}>
                  Cette propriété à <strong>{property.city}</strong> présente une valorisation de <strong>{priceFormatter.format(propPpm).replace(/\s?EUR/, ' €')}/m²</strong> contre une moyenne locale de <strong>{priceFormatter.format(cityAvg).replace(/\s?EUR/, ' €')}/m²</strong>.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <LegacyBadge>PEB : {property.peb}</LegacyBadge>
              <LegacyBadge>Rapport Qualité/Prix optimal</LegacyBadge>
              <LegacyBadge>Analyse certifiée</LegacyBadge>
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #EDE8DD' }}>
              <span style={legacyAlertChipStyle}>Audit PEB valide · précision de marché élevée</span>
            </div>
          </section>

          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>CARACTÉRISTIQUES</div>
            <LegacyCharRow icon={<Square size={13} />} label="Type" value={propType} />
            <LegacyCharRow icon={<Square size={13} />} label="Surface habitable" value={`${property.surface} m²`} />
            <LegacyCharRow icon={<Square size={13} />} label="Terrain" value={terrain} />
            <LegacyCharRow icon={<Bed size={13} />} label="Chambres" value={String(property.bedrooms)} />
            <LegacyCharRow icon={<Bath size={13} />} label="Salles de bain" value={String(property.bathrooms)} />
            <LegacyCharRow icon={<FileText size={13} />} label="Garages" value={property.id % 3 === 0 ? '0' : property.id % 3 === 1 ? '1' : '2'} />
            <LegacyCharRow icon={<Clock size={13} />} label="Année de construction" value={String(1970 + (property.id * 11) % 55)} />
            <LegacyCharRow icon={<Star size={13} />} label="PEB" value={`${property.peb} (${45 + (property.id * 19) % 250} kWh/m².an)`} />
            <LegacyCharRow icon={<FileText size={13} />} label="Chauffage" value={['Pompe à chaleur', 'Gaz condensation', 'Mazout basse temp.', 'Électrique'][property.id % 4]} />
            <LegacyCharRow icon={<Clock size={13} />} label="Disponibilité" value={property.id % 2 === 0 ? "À l'acte" : 'Libre immédiatement'} />
          </section>

          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>SITUATION PAR RAPPORT AU MARCHÉ LOCAL</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <LegacyMarketCell label="Prix moyen de la commune" value={`${priceFormatter.format(cityAvg).replace(/\s?EUR/, ' €')} / m²`} />
              <LegacyMarketCell label="Prix au m² de ce bien" value={priceFormatter.format(propPpm).replace(/\s?EUR/, ' €')} delta={`${deltaPercent >= 0 ? '+' : ''}${deltaPercent}%`} positive={deltaPercent < 0} />
            </div>
            <div style={legacyMarketBarStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
                <span style={{ color: '#6B6F6D' }}>Baromètre des prix communaux</span>
                <span style={legacyDeltaPillStyle(deltaPercent < 0)}>{deltaPercent < 0 ? 'Sous le marché' : 'Premium de zone'}</span>
              </div>
              <div style={{ position: 'relative', height: 6, borderRadius: 999, background: 'linear-gradient(90deg, #CFE1D2 0%, #FAE3D3 50%, #F2C9B8 100%)' }}>
                <span style={{ position: 'absolute', left: `${barPercent}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: 999, background: '#fff', border: '3px solid #1D1F1E', boxShadow: '0 2px 4px rgba(0,0,0,0.12)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--notion-mono)', fontSize: 9.5, color: '#8E8B83' }}>
                <span>Décoté</span>
                <span>Équilibre</span>
                <span>Surévalué</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1D1F1E', fontSize: 12.5, fontWeight: 500, marginTop: 8 }}>
              Géoréférencement : {property.city} centre zone d'évaluation locale
            </div>
          </section>

          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>HISTORIQUE DES VARIATIONS DE PRIX</div>
            <div style={{ fontFamily: 'var(--notion-mono)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8B83', marginBottom: 6 }}>
              Évolution de l'offre publicitaire
            </div>
            {priceHistory.length > 0 ? priceHistory.map((point, index) => (
              <LegacyPriceHistoryRow
                key={`${point.date}-${point.price}`}
                date={index === priceHistory.length - 1 ? "Aujourd'hui" : point.date}
                price={priceFormatter.format(point.price).replace(/\s?EUR/, ' €')}
                label={index === 0 ? 'Mise en ligne' : 'Stable'}
                tone="stable"
              />
            )) : (
              <LegacyPriceHistoryRow date="Aujourd'hui" price={price} label="Stable" tone="stable" />
            )}
          </section>

          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>SOURCE</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={legacySourcePillStyle}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: property.source === 'Immoweb' ? '#E66B1C' : property.source === 'Biddit' ? '#CE3333' : '#1E5A3A' }} />
                {property.source}
              </span>
              <span style={{ fontFamily: 'var(--notion-mono)', fontSize: 10.5, color: '#6B6F6D' }}>
                {property.source.slice(0, 3).toUpperCase()}-{property.id * 83712}
              </span>
            </div>
          </section>

          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>CONSEILLER RESPONSABLE DU MANDAT</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ color: '#1D1F1E', fontSize: 13.5, fontWeight: 750 }}>{vendorName}</div>
                <div style={{ color: '#6B6F6D', fontSize: 12, marginTop: 2 }}>{vendorType}</div>
                <div style={{ color: '#8E8B83', fontSize: 11.5, marginTop: 5 }}>
                  {relatedContact ? `${relatedContact.phone} · ${relatedContact.email}` : '+32 2 345 67 89 · contact@immopilot.be'}
                </div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: '#EBE6DA', display: 'grid', placeItems: 'center', color: '#6B6F6D', fontSize: 14, fontWeight: 750 }}>
                {vendorInitials}
              </div>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <a href="#pipeline" style={legacyPrimaryButtonStyle}>Créer un deal</a>
            <button type="button" onClick={onToggleFavorite} style={legacySecondaryButtonStyle}>
              <Heart size={13} fill={isFavorite ? 'currentColor' : 'none'} />
              Favoris
            </button>
            <button type="button" style={legacySecondaryButtonStyle}>Ignorer</button>
            <a href="#tests" style={legacySecondaryLinkStyle}>Voir plus</a>
          </div>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid #EDE8DD' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSaveNote();
                }}
                placeholder="Ajouter une note de visite interne..."
                style={{ flex: 1, height: 34, border: '1px solid #E3DED2', borderRadius: 6, padding: '0 10px', font: 'inherit', fontSize: 12.5, outline: 'none' }}
              />
              <button type="button" onClick={onSaveNote} style={{ ...smallPrimaryButtonStyle, height: 34 }}>
                <FileText size={14} />
              </button>
            </div>
            {property.notes.slice(0, 3).map((note, index) => (
              <p key={`${note}-${index}`} style={{ margin: 0, padding: '8px 10px', borderRadius: 8, background: '#F7F6F3', fontSize: 12, color: '#3F3F3F', lineHeight: 1.4 }}>
                {note}
              </p>
            ))}
          </section>
        </div>
      </div>
      </aside>

      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo agrandie - ${property.title}`}
          onClick={() => setIsLightboxOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(17, 18, 17, 0.82)',
            display: 'grid',
            placeItems: 'center',
            padding: 32,
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsLightboxOpen(false);
            }}
            aria-label="Fermer la photo agrandie"
            style={{
              position: 'fixed',
              top: 18,
              right: 18,
              width: 38,
              height: 38,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.32)',
              background: 'rgba(255,255,255,0.12)',
              color: '#FFFFFF',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}
          >
            <X size={20} />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goToPhoto(-1);
                }}
                aria-label="Photo précédente"
                style={lightboxNavStyle('left')}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goToPhoto(1);
                }}
                aria-label="Photo suivante"
                style={lightboxNavStyle('right')}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <figure
            onClick={(event) => event.stopPropagation()}
            style={{
              margin: 0,
              width: 'min(1180px, 92vw)',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <img
              src={currentPhoto}
              alt={property.title}
              style={{
                maxWidth: '100%',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: 10,
                boxShadow: '0 24px 80px rgba(0,0,0,0.36)',
                background: '#111211',
              }}
            />
            <figcaption style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: 650, opacity: 0.86 }}>
              {(photoIndex % photos.length) + 1} / {photos.length} · {property.title}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}

function lightboxNavStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'fixed',
    top: '50%',
    [side]: 24,
    transform: 'translateY(-50%)',
    width: 46,
    height: 46,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.32)',
    background: 'rgba(255,255,255,0.14)',
    color: '#FFFFFF',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
  };
}

const legacyCloseButtonStyle: React.CSSProperties = {
  width: 31,
  height: 31,
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  color: '#6B6F6D',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

function legacyStatusStyle(reserved: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 9px',
    borderRadius: 4,
    background: reserved ? '#F5EFE0' : '#E3EFE2',
    color: reserved ? '#7A6020' : '#1E5A3A',
    border: reserved ? '1px solid #ECE0BE' : '1px solid transparent',
    fontWeight: 700,
    fontSize: 11,
  };
}

const legacyGalleryMainStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  margin: 0,
  height: 220,
  background: '#E3DED2',
  overflow: 'hidden',
  flexShrink: 0,
  borderRadius: '8px 8px 0 0',
};

const legacyGalleryCounterStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: 10,
  padding: '4px 8px',
  borderRadius: 0,
  background: '#1D1F1E',
  color: '#FFFFFF',
  border: '1px solid #FFFFFF',
  fontSize: 11,
  fontWeight: 700,
  fontFamily: 'var(--notion-mono)',
  letterSpacing: '0.05em',
  zIndex: 5,
  boxShadow: '2px 2px 0 rgba(29,31,30,0.3)',
};

function legacyThumbStyle(active: boolean): React.CSSProperties {
  return {
    flex: '1 1 0',
    minWidth: 0,
    height: 60,
    borderRadius: 6,
    overflow: 'hidden',
    border: active ? '2px solid #1E5A3A' : '2px solid transparent',
    padding: 0,
    background: '#EDE8DD',
    cursor: 'pointer',
  };
}

const legacyModuleStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EDE8DD',
  borderRadius: 10,
  padding: 12,
  boxShadow: '0 2px 8px rgba(29,31,30,0.03)',
};

const legacyLabelStyle: React.CSSProperties = {
  marginBottom: 10,
  color: '#8E8B83',
  fontFamily: 'var(--notion-mono)',
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

function legacyScoreDonutStyle(score: number): React.CSSProperties {
  return {
    width: 80,
    height: 80,
    borderRadius: 999,
    background: `conic-gradient(#1E5A3A ${score * 3.6}deg, #EDE8DD 0deg)`,
    display: 'grid',
    placeItems: 'center',
  };
}

function LegacyBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 22,
        padding: '3px 8px',
        borderRadius: 6,
        background: '#F7F4EE',
        border: '1px solid #EDE8DD',
        color: '#5F5B52',
        fontSize: 11,
        fontWeight: 650,
      }}
    >
      {children}
    </span>
  );
}

const legacyAlertChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '6px 10px',
  borderRadius: 8,
  background: '#FAF1E7',
  border: '1px solid #EFE0CB',
  color: '#7A5128',
  fontSize: 12,
  fontWeight: 500,
  width: 'fit-content',
  maxWidth: '100%',
};

function LegacyCharRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '18px 1fr auto',
        alignItems: 'center',
        gap: 8,
        padding: '7px 0',
        borderBottom: '1px solid #F1ECDF',
        fontSize: 12.5,
      }}
    >
      <span style={{ color: '#8E8B83', display: 'grid', placeItems: 'center' }}>{icon}</span>
      <span style={{ color: '#6B6F6D' }}>{label}</span>
      <strong style={{ color: '#1D1F1E', fontSize: 12.5, fontWeight: 700, textAlign: 'right' }}>{value}</strong>
    </div>
  );
}

function LegacyMarketCell({
  label,
  value,
  delta,
  positive = false,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ color: '#6B6F6D', fontSize: 10.5, fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <strong style={{ color: '#1D1F1E', fontSize: 14, fontWeight: 750 }}>{value}</strong>
        {delta && <span style={legacyDeltaPillStyle(positive)}>{delta}</span>}
      </div>
    </div>
  );
}

const legacyMarketBarStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '10px 12px',
  borderRadius: 9,
  background: '#FAF7F1',
  border: '1px solid #EDE8DD',
};

function legacyDeltaPillStyle(positive: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 7px',
    borderRadius: 4,
    background: positive ? '#E3EFE2' : '#F2DAD0',
    color: positive ? '#1E5A3A' : '#A04A2E',
    fontSize: 10.5,
    fontWeight: 700,
    width: 'fit-content',
  };
}

function LegacyPriceHistoryRow({
  date,
  price,
  label,
  tone,
}: {
  date: string;
  price: string;
  label: string;
  tone: 'down' | 'stable';
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '10px auto 1fr auto',
        gap: 8,
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: '1px solid #F1ECDF',
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: tone === 'down' ? '#A04A2E' : '#8E8B83',
        }}
      />
      <span style={{ fontFamily: 'var(--notion-mono)', fontSize: 10.5, color: '#6B6F6D' }}>{date}</span>
      <strong style={{ color: '#1D1F1E', fontSize: 12, fontWeight: 650 }}>{price}</strong>
      <span
        style={{
          padding: '2px 7px',
          borderRadius: 4,
          background: tone === 'down' ? '#F2DAD0' : '#EDE8DD',
          color: tone === 'down' ? '#A04A2E' : '#6B6F6D',
          fontSize: 10.5,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

const legacySourcePillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  height: 28,
  padding: '0 10px',
  borderRadius: 7,
  background: '#F7F4EE',
  border: '1px solid #EDE8DD',
  color: '#1D1F1E',
  fontSize: 12,
  fontWeight: 700,
};

const legacyPrimaryButtonStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 7,
  border: '1px solid #1E5A3A',
  background: '#1E5A3A',
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  fontSize: 12.5,
  fontWeight: 750,
  cursor: 'pointer',
};

const legacySecondaryButtonStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 7,
  border: '1px solid #E3DED2',
  background: '#FFFFFF',
  color: '#1D1F1E',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  font: 'inherit',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
};

const legacySecondaryLinkStyle: React.CSSProperties = {
  ...legacySecondaryButtonStyle,
  textDecoration: 'none',
};

const miniSectionStyle: React.CSSProperties = {
  border: '1px solid #E6E4DF',
  borderRadius: 10,
  background: '#fff',
  padding: 12,
};

const emptyMiniTextStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12.5,
  color: '#9A9A9A',
  lineHeight: 1.45,
};

const smallPrimaryButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  background: '#1E5A3A',
  color: '#fff',
  padding: '0 10px',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 650,
  cursor: 'pointer',
};

const secondaryActionStyle: React.CSSProperties = {
  flex: 1,
  height: 36,
  borderRadius: 8,
  border: '1px solid #E6E4DF',
  background: '#fff',
  color: '#1D1F1E',
  font: 'inherit',
  fontSize: 12.5,
  fontWeight: 650,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  cursor: 'pointer',
};

const primaryActionStyle: React.CSSProperties = {
  flex: 1,
  height: 36,
  borderRadius: 8,
  border: '1px solid #1E5A3A',
  background: '#1E5A3A',
  color: '#fff',
  fontSize: 12.5,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #E6E4DF', borderRadius: 8, padding: 9, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#9A9A9A' }}>
        {icon}
        <span style={{ fontSize: 10.5, fontWeight: 650 }}>{label}</span>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 750, color: '#1D1F1E' }}>{value}</p>
    </div>
  );
}

function MiniSectionTitle({ title }: { title: string }) {
  return (
    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 750, color: '#1D1F1E' }}>
      {title}
    </h3>
  );
}

function MiniTag({ label, tone }: { label: string; tone: 'green' | 'warm' | 'red' | 'neutral' }) {
  const tones = {
    green: { background: '#EAF7EF', color: '#166534' },
    warm: { background: '#FFF3D8', color: '#92400E' },
    red: { background: '#FDEBEC', color: '#991B1B' },
    neutral: { background: '#F3F2EF', color: '#6B6F6D' },
  }[tone];

  return (
    <span style={{ ...tones, borderRadius: 999, padding: '4px 8px', fontSize: 11.5, fontWeight: 650 }}>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
      <span style={{ color: '#9A9A9A', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#1D1F1E', fontWeight: 600, textAlign: 'right', minWidth: 0 }}>{value}</span>
    </div>
  );
}

interface ListRowProps {
  property: ReturnType<Store['getProperties']>[number];
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onSelect: () => void;
  selected?: boolean;
}

function ListRow({ property: p, isFavorite, onToggleFavorite, onSelect, selected }: ListRowProps) {
  const price = priceFormatter.format(p.price).replace(/\s?EUR/, ' €');
  return (
    <div
      style={{
        background: '#fff',
        border: selected ? '1px solid #1E5A3A' : '1px solid #E6E4DF',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        cursor: 'pointer',
        boxShadow: selected ? '0 0 0 3px rgba(30, 90, 58, 0.12)' : 'none',
        transition: 'background 0.12s',
      }}
      onClick={onSelect}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#F9F8F5')}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#fff')}
    >
      <img
        src={p.photos[0]}
        alt={p.title}
        style={{ width: 72, height: 52, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
        loading="lazy"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1D1F1E', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.title}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B6F6D' }}>{p.city}</p>
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#1D1F1E', whiteSpace: 'nowrap', flexShrink: 0 }}>{price}</span>
      <span style={{ fontSize: 12, color: '#6B6F6D', flexShrink: 0 }}>{p.surface} m²</span>
      <span style={{ fontSize: 12, color: '#9A9A9A', flexShrink: 0 }}>{p.source}</span>
      <button onClick={onToggleFavorite} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
        <Star size={15} fill={isFavorite ? '#D97706' : 'none'} color={isFavorite ? '#D97706' : '#E6E4DF'} />
      </button>
    </div>
  );
}
