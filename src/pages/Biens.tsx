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
  Loader2,
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
import { SellerTensionScoreZone } from '../components/biens/SellerTensionScoreZone';
import { ImageLightbox, NotesList } from '../components/ui';
import type { store as appStore } from '../lib/store';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchPropertyDetail,
  type PropertyDetail,
  type SupabasePropertyListFilters,
  useSupabasePropertiesPageQuery,
  useSupabasePropertiesQuery,
} from '../lib/supabaseProperties';
import { useListingSignals } from '../lib/useListingSignals';
import { useListingScores } from '../lib/useListingScores';
import type { ListingSignal } from '../lib/services/listingSignalsService';
import { usePropertyMarks } from '../lib/usePropertyMarks';
import { useNotes } from '../lib/useNotes';
import { taskToView, useTasks, useTasksFor } from '../lib/useTasks';
import { useContacts } from '../lib/useContacts';
import { useAuth } from '../lib/auth';
import { useDeals } from '../lib/useDeals';
import { useMyTransfers } from '../lib/useTransfers';
import { contactsService } from '../lib/services/contactsService';
import { dealsService } from '../lib/services/dealsService';
import type { ListingScore } from '../lib/services/listingScoresService';
import { propertyImageFallbacks } from '../lib/propertyImageFallbacks';
import { formatEuro } from '../lib/formatCurrency';
import type { Property, PropertyInternalStatus } from '../types';

type Store = typeof appStore;

interface BiensProps {
  store: Store;
}

type ViewMode = 'table' | 'grid';
type SortKey = 'recent' | 'price_asc' | 'price_desc' | 'score';
type SavedViewKey = 'tous' | 'nouveaux' | 'baisses' | 'fsbo' | 'a_contacter' | 'favoris' | 'sans_contact' | 'pipeline';
type SellerFilter = 'Tous' | 'Particulier' | 'Agence' | 'Notaire';
type ContactFilter = 'Tous' | 'Sans contact' | 'Avec contact';
type PipelineFilter = 'Tous' | 'En pipeline' | 'Hors pipeline';
type TaskFilter = 'Tous' | 'Avec tâche ouverte' | 'Sans tâche ouverte';
type StatusFilter = 'Tous' | 'Disponible' | 'Réservé' | 'Archivé';

const PAGE_SIZE = 16;
const PRICE_MIN_OPTIONS = ['Min', '150000', '250000', '350000', '500000', '750000', '1000000'];
const PRICE_MAX_OPTIONS = ['Max', '250000', '350000', '500000', '750000', '1000000', '1500000'];
const BEDROOM_OPTIONS = ['Tous', '1+', '2+', '3+', '4+'];
const SURFACE_OPTIONS = ['Tous', '50+', '100+', '150+', '200+', '300+'];
const SCORE_OPTIONS = ['Tous', '50', '60', '70', '80', '90'];
const AGE_OPTIONS = ['Tous', '+7 jours', '+30 jours', '+60 jours', '+90 jours'];
const SELLER_OPTIONS: SellerFilter[] = ['Tous', 'Particulier', 'Agence', 'Notaire'];
const CONTACT_OPTIONS: ContactFilter[] = ['Tous', 'Sans contact', 'Avec contact'];
const PIPELINE_OPTIONS: PipelineFilter[] = ['Tous', 'En pipeline', 'Hors pipeline'];
const TASK_OPTIONS: TaskFilter[] = ['Tous', 'Avec tâche ouverte', 'Sans tâche ouverte'];
const STATUS_OPTIONS: StatusFilter[] = ['Tous', 'Disponible', 'Réservé', 'Archivé'];

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Plus récents',
  price_asc: 'Prix croissant',
  price_desc: 'Prix décroissant',
  score: 'Meilleur score',
};

const SAVED_VIEWS: Array<{ key: SavedViewKey; label: string; description: string }> = [
  { key: 'tous', label: 'Tous', description: 'Base complete' },
  { key: 'nouveaux', label: 'Nouveaux', description: 'Publies recemment' },
  { key: 'baisses', label: 'Baisses de prix', description: 'Signal prix' },
  { key: 'fsbo', label: 'FSBO', description: 'Particuliers' },
  { key: 'a_contacter', label: 'A contacter', description: 'Action urgente' },
  { key: 'favoris', label: 'Favoris', description: 'Suivi personnel' },
  { key: 'sans_contact', label: 'Sans contact', description: 'A enrichir' },
  { key: 'pipeline', label: 'En pipeline', description: 'Deal ouvert' },
];

function getPropertyType(property: Property): string {
  if (property.propertyType) return property.propertyType;
  const title = property.title.toLowerCase();
  if (title.includes('appartement') || title.includes('penthouse') || title.includes('loft')) return 'Appartement';
  if (title.includes('terrain')) return 'Terrain';
  if (title.includes('villa')) return 'Villa';
  if (title.includes('maison')) return 'Maison';
  return 'Bien';
}

function getSellerType(property: Property): SellerFilter {
  if (property.fsbo) return 'Particulier';
  if (property.source === 'Biddit') return 'Notaire';
  return 'Agence';
}

function minValue(option: string): number | null {
  if (option === 'Tous' || option === 'Min' || option === 'Max') return null;
  return Number(option.replace('+', ''));
}

function priceRangeLabel(min: string, max: string): string {
  if (min === 'Min' && max === 'Max') return 'Prix';
  if (min !== 'Min' && max !== 'Max') return `${Number(min).toLocaleString('fr-BE')} - ${Number(max).toLocaleString('fr-BE')} €`;
  if (min !== 'Min') return `> ${Number(min).toLocaleString('fr-BE')} €`;
  return `< ${Number(max).toLocaleString('fr-BE')} €`;
}

function getOpportunityReason(property: Property, store: Store): string {

  const contact = store.getPropertyContact(property.id);
  const deal = store.getPropertyDeal(property.id);
  const firstSignal = store.getPropertySignals(property.id)[0];

  if (property.fsbo && !contact) return 'Particulier détecté, contact à qualifier';
  if (!contact) return 'Aucun contact lié, enrichissement prioritaire';
  if (property.tag === 'Baisse de prix') return 'Baisse de prix à exploiter maintenant';
  if (property.publishedDays >= 60) return 'Annonce ancienne, vendeur potentiellement ouvert';
  if (property.score >= 80 && !deal) return 'Score élevé, potentiel mandat';
  if (deal) return `Déjà en pipeline: ${deal.stage}`;
  if (firstSignal) return firstSignal.heading;

  return 'Bien à qualifier pour une prochaine action';
}

const SIGNAL_PRIORITY = [
  'prix sous',
  'baisse de prix',
  'repub',
  'fsbo',
];

function getSignalPriority(label: string): number {
  const value = label.toLowerCase();
  const priority = SIGNAL_PRIORITY.findIndex((needle) => value.includes(needle));
  if (priority >= 0) return priority;
  return SIGNAL_PRIORITY.length;
}

function getCardSignals(property: Property, store: Store): { primarySignal: string; secondarySignalCount: number } {
  const labels = [
    ...store.getPropertySignals(property.id).map((signal) => signal.heading),
    property.tag,
    property.fsbo ? 'FSBO' : '',
  ].filter(Boolean);

  const uniqueLabels = Array.from(new Set(labels));
  uniqueLabels.sort((a, b) => getSignalPriority(a) - getSignalPriority(b));

  return {
    primarySignal: uniqueLabels[0] ?? 'Nouveau',
    secondarySignalCount: Math.max(0, uniqueLabels.length - 1),
  };
}

function supportsServerPagination(params: {
  contactFilter: ContactFilter;
  search: string;
  statusFilter: StatusFilter;
  pipelineFilter: PipelineFilter;
  taskFilter: TaskFilter;
}) {
  return (
    !params.search.trim() &&
    params.contactFilter === 'Tous' &&
    params.pipelineFilter === 'Tous' &&
    params.taskFilter === 'Tous' &&
    (params.statusFilter === 'Tous' || params.statusFilter === 'Disponible')
  );
}

export function Biens({ store }: BiensProps) {
  const [, forceUpdate] = useState(0);
  const { user } = useAuth();
  const propertyMarks = usePropertyMarks();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortKey>('recent');
  const [filterCommune, setFilterCommune] = useState('Toutes');
  const [filterSource, setFilterSource] = useState('Toutes');
  const [filterType, setFilterType] = useState('Tous');
  const [priceMin, setPriceMin] = useState('Min');
  const [priceMax, setPriceMax] = useState('Max');
  const [filterSignal, setFilterSignal] = useState('Tous');
  const [bedroomsMin, setBedroomsMin] = useState('Tous');
  const [surfaceMin, setSurfaceMin] = useState('Tous');
  const [sellerFilter, setSellerFilter] = useState<SellerFilter>('Tous');
  const [scoreMin, setScoreMin] = useState('Tous');
  const [ageFilter, setAgeFilter] = useState('Tous');
  const [contactFilter, setContactFilter] = useState<ContactFilter>('Tous');
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('Tous');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('Tous');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Tous');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [savedView, setSavedView] = useState<SavedViewKey>('tous');
  const [page, setPage] = useState(1);
  const [carouselMap, setCarouselMap] = useState<Record<number, number>>({});
  const [sortOpen, setSortOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const propertyId = Number(params.get('propertyId'));
    return Number.isFinite(propertyId) && propertyId > 0 ? propertyId : null;
  });
  const [fullPropertyId, setFullPropertyId] = useState<number | null>(null);
  const [panelPhotoIndex, setPanelPhotoIndex] = useState(0);
  const [noteDraft, setNoteDraft] = useState('');
  const [propertyDetailsById, setPropertyDetailsById] = useState<Record<string, PropertyDetail>>({});
  const [detailLoadingIds, setDetailLoadingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1);
    const syncSelectedProperty = () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
      const propertyId = Number(params.get('propertyId'));
      if (Number.isFinite(propertyId) && propertyId > 0) {
        setSelectedPropertyId(propertyId);
        setPanelPhotoIndex(0);
        setNoteDraft('');
      }
    };
    window.addEventListener('ip-state-changed', handler);
    window.addEventListener('hashchange', syncSelectedProperty);
    syncSelectedProperty();
    return () => {
      window.removeEventListener('ip-state-changed', handler);
      window.removeEventListener('hashchange', syncSelectedProperty);
    };
  }, []);

  const getMarkId = (property: Property | undefined) => property?.supabasePropertyId;
  const minPrice = minValue(priceMin);
  const maxPrice = minValue(priceMax);
  const bedroomFloor = minValue(bedroomsMin);
  const surfaceFloor = minValue(surfaceMin);
  const scoreFloor = minValue(scoreMin);
  const ageFloor = minValue(ageFilter.replace(' jours', ''));
  const useServerPagination = useMemo(
    () => supportsServerPagination({
      search,
      contactFilter,
      pipelineFilter,
      taskFilter,
      statusFilter,
    }),
    [contactFilter, pipelineFilter, search, statusFilter, taskFilter],
  );
  const serverFilters = useMemo<SupabasePropertyListFilters>(() => ({
    city: filterCommune !== 'Toutes' ? filterCommune : null,
    source: filterSource !== 'Toutes' ? filterSource : null,
    propertyTypeLabel: filterType !== 'Tous' ? filterType : null,
    minPrice,
    maxPrice,
    signalFilter: filterSignal !== 'Tous' ? filterSignal : null,
    minBedrooms: bedroomFloor,
    minSurface: surfaceFloor,
    sellerFilter,
    minScore: scoreFloor,
    ageMinDays: ageFloor,
    favoritePropertyIds: favoritesOnly || savedView === 'favoris' ? propertyMarks.favorites : undefined,
    ignoredPropertyIds: propertyMarks.ignored,
    fsboOnly: savedView === 'fsbo',
  }), [
    ageFloor,
    bedroomFloor,
    favoritesOnly,
    filterCommune,
    filterSignal,
    filterSource,
    filterType,
    maxPrice,
    minPrice,
    propertyMarks.favorites,
    propertyMarks.ignored,
    savedView,
    scoreFloor,
    sellerFilter,
    surfaceFloor,
  ]);
  const pagedPropertiesQuery = useSupabasePropertiesPageQuery({
    enabled: isSupabaseConfigured && useServerPagination && Boolean(user),
    filters: serverFilters,
    page,
    pageSize: PAGE_SIZE,
    sort,
    userId: user?.id,
  });
  const allPropertiesQuery = useSupabasePropertiesQuery({
    enabled: isSupabaseConfigured && !useServerPagination && Boolean(user),
    userId: user?.id,
  });
  const activePropertiesQuery = useServerPagination ? pagedPropertiesQuery : allPropertiesQuery;
  const liveProperties = useServerPagination
    ? (pagedPropertiesQuery.data?.properties ?? [])
    : (allPropertiesQuery.data ?? []);
  const liveTotalCount = useServerPagination
    ? (pagedPropertiesQuery.data?.totalCount ?? 0)
    : liveProperties.length;
  const liveLoading = activePropertiesQuery.isLoading;
  const liveError = activePropertiesQuery.error instanceof Error
    ? activePropertiesQuery.error.message
    : null;
  const usingLiveData = liveProperties.length > 0;
  const isInitialLiveLoading = isSupabaseConfigured && liveLoading && liveProperties.length === 0;
  const allProps = isSupabaseConfigured ? liveProperties : [];
  const currentAgent = store.getCurrentAgent();
  const allTasks = useTasks({ scope: 'all' });

  useEffect(() => {
    if (!propertyMarks.error) return;
    store.addNotification('property_mark_error', 'Synchronisation favoris impossible', propertyMarks.error, '#biens');
  }, [propertyMarks.error, store]);


  const communes = useMemo(() => {
    const set = new Set(allProps.map((p) => p.city));
    return ['Toutes', ...Array.from(set).sort()];
  }, [allProps]);

  const sources = useMemo(() => {
    const set = new Set(allProps.map((p) => p.source));
    return ['Toutes', ...Array.from(set).sort()];
  }, [allProps]);

  const propertyTypes = useMemo(() => {
    const set = new Set(allProps.map((p) => getPropertyType(p)));
    return ['Tous', ...Array.from(set).sort()];
  }, [allProps]);

  const filtered = useMemo(() => {
    let list = allProps;

    if (!useServerPagination) {
      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.city.toLowerCase().includes(q) ||
            p.source.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.tag.toLowerCase().includes(q) ||
            String(p.id).includes(q) ||
            String(p.price).includes(q),
        );
      }
      if (filterCommune !== 'Toutes') list = list.filter((p) => p.city === filterCommune);
      if (filterSource !== 'Toutes') list = list.filter((p) => p.source === filterSource);
      if (filterType !== 'Tous') list = list.filter((p) => getPropertyType(p) === filterType);
      if (minPrice !== null) list = list.filter((p) => p.price >= minPrice);
      if (maxPrice !== null) list = list.filter((p) => p.price <= maxPrice);
      if (filterSignal === 'FSBO') list = list.filter((p) => p.fsbo);
      if (filterSignal === 'Baisse de prix') list = list.filter((p) => p.tag === 'Baisse de prix');
      if (filterSignal === 'Nouveau') list = list.filter((p) => p.tag === 'Nouveau');
      if (filterSignal === 'Republié') list = list.filter((p) => p.tag === 'Republié');
      if (filterSignal === 'Archivé') list = list.filter((p) => p.status === 'archivé');
      if (bedroomFloor !== null) list = list.filter((p) => p.bedrooms >= bedroomFloor);
      if (surfaceFloor !== null) list = list.filter((p) => p.surface >= surfaceFloor);
      if (sellerFilter !== 'Tous') list = list.filter((p) => getSellerType(p) === sellerFilter);
      if (scoreFloor !== null) list = list.filter((p) => p.score >= scoreFloor);
      if (ageFloor !== null) list = list.filter((p) => p.publishedDays >= ageFloor);
      if (contactFilter === 'Sans contact') list = list.filter((p) => !store.getPropertyContact(p.id));
      if (contactFilter === 'Avec contact') list = list.filter((p) => Boolean(store.getPropertyContact(p.id)));
      if (pipelineFilter === 'En pipeline') list = list.filter((p) => Boolean(store.getPropertyDeal(p.id)));
      if (pipelineFilter === 'Hors pipeline') list = list.filter((p) => !store.getPropertyDeal(p.id));
      if (taskFilter === 'Avec tâche ouverte') list = list.filter((p) => getOpenPropertyTasks(p).length > 0);
      if (taskFilter === 'Sans tâche ouverte') list = list.filter((p) => getOpenPropertyTasks(p).length === 0);
      if (statusFilter === 'Disponible') list = list.filter((p) => !p.reserved && p.status !== 'archivé');
      if (statusFilter === 'Réservé') list = list.filter((p) => p.reserved || p.status === 'réservé');
      if (statusFilter === 'Archivé') list = list.filter((p) => p.status === 'archivé');
      list = list.filter((p) => !propertyMarks.isIgnored(getMarkId(p)));
      if (favoritesOnly) list = list.filter((p) => propertyMarks.isFavorite(getMarkId(p)));

      switch (sort) {
        case 'price_asc': list = [...list].sort((a, b) => a.price - b.price); break;
        case 'price_desc': list = [...list].sort((a, b) => b.price - a.price); break;
        case 'score': list = [...list].sort((a, b) => b.score - a.score); break;
        default: list = [...list].sort((a, b) => a.publishedDays - b.publishedDays); break;
      }
    }

    return list;
  }, [
    ageFloor,
    allProps,
    bedroomFloor,
    contactFilter,
    filterCommune,
    filterSignal,
    filterSource,
    filterType,
    favoritesOnly,
    maxPrice,
    minPrice,
    pipelineFilter,
    propertyMarks,
    scoreFloor,
    search,
    sellerFilter,
    sort,
    statusFilter,
    store,
    surfaceFloor,
    taskFilter,
    useServerPagination,
  ]);

  const totalPages = Math.max(1, Math.ceil((useServerPagination ? liveTotalCount : filtered.length) / PAGE_SIZE));
  const pageItems = useServerPagination ? filtered : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);
  const visiblePropertyIds = useMemo(
    () => pageItems.map((property) => property.supabasePropertyId).filter((id): id is string => Boolean(id)),
    [pageItems],
  );
  const selectedPropertyBase = selectedPropertyId ? allProps.find((property) => property.id === selectedPropertyId) : undefined;
  const fullPropertyBase = fullPropertyId ? allProps.find((property) => property.id === fullPropertyId) : undefined;
  const selectedProperty = selectedPropertyBase?.supabaseListingId
    ? propertyDetailsById[selectedPropertyBase.supabaseListingId] ?? selectedPropertyBase
    : selectedPropertyBase;
  const fullProperty = fullPropertyBase?.supabaseListingId
    ? propertyDetailsById[fullPropertyBase.supabaseListingId] ?? fullPropertyBase
    : fullPropertyBase;
  const scorePropertyIds = useMemo(() => {
    const extraIds = [selectedProperty?.supabasePropertyId, fullProperty?.supabasePropertyId]
      .filter((id): id is string => Boolean(id));
    return Array.from(new Set([...visiblePropertyIds, ...extraIds]));
  }, [fullProperty?.supabasePropertyId, selectedProperty?.supabasePropertyId, visiblePropertyIds]);
  const { signalsByProperty } = useListingSignals(scorePropertyIds);
  const { scoresByProperty } = useListingScores(scorePropertyIds);
  const panelOpen = Boolean(selectedProperty);

  useEffect(() => {
    let cancelled = false;
    const targets = [selectedPropertyBase, fullPropertyBase]
      .filter((property): property is Property => Boolean(property?.supabaseListingId));

    targets.forEach((property) => {
      const listingId = property.supabaseListingId as string;
      if (propertyDetailsById[listingId] || detailLoadingIds[listingId]) return;

      setDetailLoadingIds((current) => ({ ...current, [listingId]: true }));
      fetchPropertyDetail(listingId)
        .then((detail) => {
          if (cancelled || !detail) return;
          setPropertyDetailsById((current) => ({
            ...current,
            [listingId]: {
              ...property,
              ...detail,
              id: property.id,
              supabasePropertyId: property.supabasePropertyId,
              supabaseListingId: property.supabaseListingId,
            },
          }));
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          store.addNotification(
            `property_detail_error_${listingId}`,
            'Chargement de la fiche impossible',
            error instanceof Error ? error.message : 'Le detail du bien est indisponible.',
            '#biens',
          );
        })
        .finally(() => {
          if (cancelled) return;
          setDetailLoadingIds((current) => {
            const next = { ...current };
            delete next[listingId];
            return next;
          });
        });
    });

    return () => {
      cancelled = true;
    };
  }, [detailLoadingIds, fullPropertyBase, propertyDetailsById, selectedPropertyBase, store]);
  const openTasksByPropertyId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof taskToView>[]>();
    allTasks.tasks.forEach((task) => {
      if (!task.property_id || task.is_completed) return;
      const next = map.get(task.property_id) ?? [];
      next.push(taskToView(task));
      map.set(task.property_id, next);
    });
    return map;
  }, [allTasks.tasks]);

  const getOpenPropertyTasks = (property: Property) => (
    property.supabasePropertyId ? openTasksByPropertyId.get(property.supabasePropertyId) ?? [] : []
  );

  const highPotentialVisible = filtered.filter((p) => p.score >= 80).length;
  const noContactVisible = filtered.filter((p) => !store.getPropertyContact(p.id)).length;
  const recentDropVisible = filtered.filter((p) => p.tag === 'Baisse de prix').length;
  const activeViewLabel = SAVED_VIEWS.find((view) => view.key === savedView)?.label ?? 'Tous';
  const activeFilterCount = [
    filterCommune !== 'Toutes',
    filterSource !== 'Toutes',
    filterType !== 'Tous',
    priceMin !== 'Min',
    priceMax !== 'Max',
    filterSignal !== 'Tous',
    bedroomsMin !== 'Tous',
    surfaceMin !== 'Tous',
    sellerFilter !== 'Tous',
    scoreMin !== 'Tous',
    ageFilter !== 'Tous',
    contactFilter !== 'Tous',
    pipelineFilter !== 'Tous',
    taskFilter !== 'Tous',
    statusFilter !== 'Tous',
    favoritesOnly,
  ].filter(Boolean).length;

  useEffect(() => {
    if (!panelOpen) return undefined;

    window.dispatchEvent(new Event('ip-property-panel-open'));

    return () => {
      window.dispatchEvent(new Event('ip-property-panel-close'));
    };
  }, [panelOpen]);

  useEffect(() => {
    if (!fullProperty) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullPropertyId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fullProperty]);

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
    const property = allProps.find((item) => item.id === id);
    void propertyMarks.toggleFavorite(getMarkId(property));
  };

  const handleIgnored = (id: number) => (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const property = allProps.find((item) => item.id === id);
    void propertyMarks.toggleIgnored(getMarkId(property));
    if (selectedPropertyId === id) setSelectedPropertyId(null);
    if (fullPropertyId === id) setFullPropertyId(null);
  };

  const clearFilterControls = (clearSearch = false) => {
    if (clearSearch) setSearch('');
    setFilterCommune('Toutes');
    setFilterSource('Toutes');
    setFilterType('Tous');
    setPriceMin('Min');
    setPriceMax('Max');
    setFilterSignal('Tous');
    setBedroomsMin('Tous');
    setSurfaceMin('Tous');
    setSellerFilter('Tous');
    setScoreMin('Tous');
    setAgeFilter('Tous');
    setContactFilter('Tous');
    setPipelineFilter('Tous');
    setTaskFilter('Tous');
    setStatusFilter('Tous');
    setFavoritesOnly(false);
  };

  const resetFilters = () => {
    clearFilterControls(true);
    setSavedView('tous');
    setPage(1);
  };

  const applySavedView = (view: SavedViewKey) => {
    clearFilterControls(false);
    setSavedView(view);
    setPage(1);

    if (view === 'nouveaux') setFilterSignal('Nouveau');
    if (view === 'baisses') setFilterSignal('Baisse de prix');
    if (view === 'fsbo') {
      setFilterSignal('FSBO');
      setSellerFilter('Particulier');
    }
    if (view === 'a_contacter') {
      setContactFilter('Sans contact');
      setScoreMin('70');
    }
    if (view === 'favoris') setFavoritesOnly(true);
    if (view === 'sans_contact') setContactFilter('Sans contact');
    if (view === 'pipeline') setPipelineFilter('En pipeline');
  };

  const applyPreset = (preset: 'fsbo' | 'drops' | 'score70' | 'age60' | 'no_contact' | 'follow_up') => {
    setPage(1);
    if (preset === 'fsbo') {
      setFilterSignal('FSBO');
      setSellerFilter('Particulier');
    }
    if (preset === 'drops') {
      setFilterSignal('Baisse de prix');
    }
    if (preset === 'score70') {
      setScoreMin('70');
    }
    if (preset === 'age60') {
      setAgeFilter('+60 jours');
    }
    if (preset === 'no_contact') {
      setContactFilter('Sans contact');
    }
    if (preset === 'follow_up') {
      setTaskFilter('Avec tâche ouverte');
      setAgeFilter('+30 jours');
    }
  };

  const selectProperty = (id: number) => {
    const property = allProps.find((item) => item.id === id);
    if (property?.supabaseListingId && !propertyDetailsById[property.supabaseListingId] && !detailLoadingIds[property.supabaseListingId]) {
      setDetailLoadingIds((current) => ({ ...current, [property.supabaseListingId as string]: true }));
      fetchPropertyDetail(property.supabaseListingId)
        .then((detail) => {
          if (!detail) return;
          setPropertyDetailsById((current) => ({
            ...current,
            [property.supabaseListingId as string]: {
              ...property,
              ...detail,
              id: property.id,
              supabasePropertyId: property.supabasePropertyId,
              supabaseListingId: property.supabaseListingId,
            },
          }));
        })
        .catch((error: unknown) => {
          store.addNotification(
            `property_detail_error_${property.supabaseListingId}`,
            'Chargement de la fiche impossible',
            error instanceof Error ? error.message : 'Le detail du bien est indisponible.',
            '#biens',
          );
        })
        .finally(() => {
          setDetailLoadingIds((current) => {
            const next = { ...current };
            delete next[property.supabaseListingId as string];
            return next;
          });
        });
    }
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
    setFullPropertyId(null);
    setNoteDraft('');
    setPanelPhotoIndex(0);
  };

  const openFullProperty = (property: Property | undefined) => {
    if (!property) return;
    selectProperty(property.id);
    setFullPropertyId(property.id);
  };

  const savePanelNote = () => {
    if (!selectedProperty || !noteDraft.trim()) return;
    store.registerNoteToProperty(selectedProperty.id, noteDraft.trim());
    setNoteDraft('');
  };

  return (
    <div
      className={`lv-biens lv-page ${selectedProperty ? 'has-panel' : ''}`}
      style={{
        minHeight: '100%',
        background: 'var(--color-bg-page)',
        fontFamily: 'var(--font-sans, var(--notion-sans))',
        position: 'relative',
        paddingRight: selectedProperty ? 462 : 0,
        transition: 'padding-right 180ms ease',
      }}
    >
      {/* ── Page Header ───────────────────────────── */}
      <div
        className="lv-biens-head"
        style={{
          padding: selectedProperty ? '24px 4px 0 32px' : '24px 32px 0',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Zone gauche */}
        <div className="lv-biens-heading" style={{ flex: 1, display: 'flex', gap: 16, alignItems: 'center', minWidth: 0 }}>
          {/* Titre */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1
              className="lv-title"
              style={{
                margin: 0,
                fontSize: 32,
                fontFamily: 'var(--font-serif, var(--notion-serif))',
                fontWeight: 400,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
              }}
            >
              Biens
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Base de données des propriétés prospectées
            </p>
            <div
              className={`lv-biens-sync ${usingLiveData ? 'is-live' : liveError ? 'is-error' : ''}`}
              style={{
                marginTop: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                alignSelf: 'flex-start',
                border: '1px solid var(--color-border-default)',
                borderRadius: 999,
                background: 'var(--color-bg-surface)',
                padding: '5px 9px',
                fontSize: 11.5,
                fontWeight: 650,
                color: usingLiveData ? 'var(--color-success-text)' : liveError ? 'var(--color-danger-text)' : 'var(--color-text-secondary)',
              }}
              title={liveError ?? undefined}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                   background: usingLiveData ? 'var(--color-success-dot)' : liveError ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)',
                }}
              />
              {usingLiveData
                ? `${liveProperties.length} biens Supabase`
                : liveLoading
                  ? 'Connexion Supabase...'
                  : liveError
                    ? 'Erreur Supabase'
                    : 'Supabase non configure'}
            </div>
          </div>
        </div>

        <div className="lv-biens-actions" style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            className="lv-secondary-button"
            onClick={openDefaultPanel}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'var(--notion-sans)',
              color: 'var(--color-text-primary)',
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
            className="lv-primary-button"
            style={{
              background: 'var(--color-brand)',
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--notion-sans)',
              color: 'var(--color-text-inverse)',
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
      <div className="lv-biens-views" style={{ padding: selectedProperty ? '12px 4px 0 32px' : '12px 32px 0' }}>
        <div
          className="lv-biens-tabs"
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            overflowX: 'auto',
            paddingBottom: 2,
          }}
        >
          {SAVED_VIEWS.map((view) => {
            const active = savedView === view.key;
            return (
              <button
                className={`lv-biens-tab ${active ? 'is-active' : ''}`}
                key={view.key}
                type="button"
                onClick={() => applySavedView(view.key)}
                title={view.description}
                style={{
                  border: active ? '1px solid var(--color-brand)' : '1px solid var(--color-border-default)',
                  background: active ? 'var(--color-brand-50)' : 'var(--color-bg-surface)',
                  color: active ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                  borderRadius: 999,
                  padding: '6px 11px',
                  fontFamily: 'var(--notion-sans)',
                  fontSize: 12.5,
                  fontWeight: active ? 720 : 560,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = 'translateY(-1px)';
                  event.currentTarget.style.borderColor = active ? 'var(--color-brand)' : 'var(--color-border-strong)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = 'none';
                  event.currentTarget.style.borderColor = active ? 'var(--color-brand)' : 'var(--color-border-default)';
                }}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="lv-biens-toolbar"
        style={{
          padding: selectedProperty ? '14px 4px 0 32px' : '14px 32px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Search */}
        <div className="lv-biens-search" style={{ flex: 1, position: 'relative' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }}
          />
          <input
            className="lv-biens-search-input"
            type="text"
            placeholder="Rechercher un bien, ville, source..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              paddingLeft: 36,
              paddingRight: 12,
              height: 38,
              border: '1px solid var(--color-border-default)',
              borderRadius: 8,
              fontSize: 13,
              fontFamily: 'var(--notion-sans)',
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* View toggle */}
        <div
          className="lv-biens-view-toggle"
          style={{
            display: 'flex',
            border: '1px solid var(--color-border-default)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <button
            className={`lv-icon-toggle ${viewMode === 'grid' ? 'is-active' : ''}`}
            onClick={() => setViewMode('grid')}
            style={{
              background: viewMode === 'grid' ? 'var(--color-brand)' : 'var(--color-bg-surface)',
              border: 'none',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: viewMode === 'grid' ? 'var(--color-bg-surface)' : 'var(--color-text-secondary)',
            }}
            title="Vue galerie"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            className={`lv-icon-toggle ${viewMode === 'table' ? 'is-active' : ''}`}
            onClick={() => setViewMode('table')}
            style={{
              background: viewMode === 'table' ? 'var(--color-brand)' : 'var(--color-bg-surface)',
              border: 'none',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: viewMode === 'table' ? 'var(--color-bg-surface)' : 'var(--color-text-secondary)',
              borderLeft: '1px solid var(--color-border-default)',
            }}
            title="Vue tableau"
          >
            <List size={15} />
          </button>
        </div>

        {/* Sort dropdown — aligné à droite sous "Ajouter un bien" */}
        <div className="lv-biens-sort" style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            className="lv-secondary-button"
            onClick={() => setSortOpen((o) => !o)}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontFamily: 'var(--notion-sans)',
              color: 'var(--color-text-primary)',
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
              className="lv-biens-menu"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 4px)',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
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
                    background: sort === key ? 'var(--color-bg-hover)' : 'var(--color-bg-surface)',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-primary)',
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
      <div className="lv-biens-filter-wrap" style={{ padding: '10px 32px 0' }}>
        <div
          className="lv-biens-filter-bar"
          style={{
            background: 'color-mix(in srgb, var(--color-bg-surface) 68%, transparent)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 8,
            padding: '7px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 560,
              color: 'var(--color-text-secondary)',
              letterSpacing: 0,
              flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={13} />
            Filtres
          </span>

          <FilterChip
            label={filterCommune === 'Toutes' ? 'Commune' : filterCommune}
            options={communes}
            value={filterCommune}
            onChange={(v) => { setFilterCommune(v); setPage(1); }}
          />
          <FilterChip
            label={filterType === 'Tous' ? 'Type' : filterType}
            options={propertyTypes}
            value={filterType}
            onChange={(v) => { setFilterType(v); setPage(1); }}
          />
          <button
            className="lv-filter-button"
            type="button"
            onClick={() => setAdvancedOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: priceMin !== 'Min' || priceMax !== 'Max' ? 'var(--color-bg-hover)' : 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              fontFamily: 'var(--notion-sans)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              fontWeight: priceMin !== 'Min' || priceMax !== 'Max' ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {priceRangeLabel(priceMin, priceMax)}
            <ChevronRight size={12} />
          </button>
          <FilterChip
            label={filterSource === 'Toutes' ? 'Source' : filterSource}
            options={sources}
            value={filterSource}
            onChange={(v) => { setFilterSource(v); setPage(1); }}
          />
          <FilterChip
            label={filterSignal === 'Tous' ? 'Signal' : filterSignal}
            options={['Tous', 'FSBO', 'Baisse de prix', 'Republié', 'Nouveau', 'Archivé']}
            value={filterSignal}
            onChange={(v) => { setFilterSignal(v); setPage(1); }}
          />
          <FilterChip
            label={scoreMin === 'Tous' ? 'Score' : `Score ${scoreMin}+`}
            options={SCORE_OPTIONS}
            value={scoreMin}
            onChange={(v) => { setScoreMin(v); setPage(1); }}
          />

          <button
            className={`lv-filter-button ${favoritesOnly ? 'is-active' : ''}`}
            onClick={() => { setFavoritesOnly((f) => !f); setPage(1); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: favoritesOnly ? 'var(--color-warning-bg)' : 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              fontFamily: 'var(--notion-sans)',
              color: favoritesOnly ? 'var(--color-warning-text)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontWeight: favoritesOnly ? 600 : 400,
            }}
          >
            <Star size={12} fill={favoritesOnly ? 'var(--color-favorite)' : 'none'} color={favoritesOnly ? 'var(--color-favorite)' : 'var(--color-text-secondary)'} />
            Favoris uniquement
          </button>

          {/* Réinitialiser poussé tout à droite */}
          <button
            className={`lv-filter-button ${activeFilterCount > 0 ? 'is-active' : ''}`}
            type="button"
            onClick={() => setAdvancedOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: activeFilterCount > 0 ? 'var(--color-brand)' : 'var(--color-bg-surface)',
              border: activeFilterCount > 0 ? '1px solid var(--color-brand)' : '1px solid var(--color-border-default)',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              fontFamily: 'var(--notion-sans)',
              color: activeFilterCount > 0 ? 'var(--color-bg-surface)' : 'var(--color-text-primary)',
              cursor: 'pointer',
              fontWeight: 650,
              whiteSpace: 'nowrap',
            }}
          >
            <SlidersHorizontal size={12} />
            Filtres avancés{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          <button
            className="lv-reset-button"
            onClick={resetFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              fontSize: 12,
              fontFamily: 'var(--notion-sans)',
              color: 'var(--color-text-tertiary)',
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

      {/* ── Table / Gallery ───────────────────────── */}
      <div className="lv-biens-results" style={{ padding: selectedProperty ? '14px 4px 32px 32px' : '14px 32px 32px' }}>
        {isInitialLiveLoading ? (
          <div className="lv-biens-empty" style={{ margin: '0 auto', maxWidth: 560, textAlign: 'center', padding: '56px 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-surface)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--color-brand)' }}>
              <Loader2 size={18} className="animate-spin" />
            </div>
            <strong style={{ display: 'block', color: 'var(--color-text-primary)', fontSize: 15, marginBottom: 5 }}>Chargement des biens Supabase</strong>
            <span style={{ display: 'block', lineHeight: 1.5 }}>Connexion aux annonces importees. Les anciennes annonces de demo ne sont plus affichees.</span>
          </div>
        ) : viewMode === 'grid' ? (
          <div
            className="lv-biens-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: selectedProperty ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
              gap: 14,
            }}
          >
            {pageItems.map((p) => {
              const cardSignals = getCardSignals(p, store);
              return (
                <PropertyCard
                  key={p.id}
                  property={p}
                  carouselIndex={carouselMap[p.id] ?? 0}
                  onCarouselPrev={handleCarousel(p.id, -1)}
                  onCarouselNext={handleCarousel(p.id, 1)}
                  onToggleFavorite={handleFav(p.id)}
                  onSelect={() => selectProperty(p.id)}
                  isFavorite={propertyMarks.isFavorite(getMarkId(p))}
                  selected={selectedPropertyId === p.id}
                  primarySignal={cardSignals.primarySignal}
                  secondarySignalCount={cardSignals.secondarySignalCount}
                  signals={p.supabasePropertyId ? signalsByProperty[p.supabasePropertyId] ?? [] : []}
                  scoreContent={(
                    <SellerTensionScoreZone
                      score={p.supabasePropertyId ? scoresByProperty[p.supabasePropertyId] : undefined}
                      fallbackScore={p.score}
                      signals={p.supabasePropertyId ? signalsByProperty[p.supabasePropertyId] ?? [] : []}
                      isInactive={p.reserved || p.status?.startsWith('archiv')}
                    />
                  )}
                  opportunityReason={getOpportunityReason(p, store)}
                  nextAction={getOpenPropertyTasks(p)[0]?.title ?? (store.getPropertyDeal(p.id) ? `Deal: ${store.getPropertyDeal(p.id)?.stage}` : 'Qualifier ce bien')}
                  contactName={store.getPropertyContact(p.id)?.name}
                />
              );
            })}
          </div>
        ) : (
          <BiensTable
            items={pageItems}
            selectedId={selectedPropertyId}
            scoresByProperty={scoresByProperty}
            signalsByProperty={signalsByProperty}
            isFavorite={(id) => propertyMarks.isFavorite(getMarkId(allProps.find((property) => property.id === id)))}
            onToggleFavorite={handleFav}
            onSelect={selectProperty}
          />
        )}

        {!isInitialLiveLoading && pageItems.length === 0 && (
          <div className="lv-biens-empty" style={{ margin: '0 auto', maxWidth: 520, textAlign: 'center', padding: '52px 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-surface)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--color-brand)' }}>
              <Search size={18} />
            </div>
            <strong style={{ display: 'block', color: 'var(--color-text-primary)', fontSize: 15, marginBottom: 5 }}>
              {liveError ? 'Impossible de charger Supabase' : 'Aucun bien dans cette vue'}
            </strong>
            <span style={{ display: 'block', lineHeight: 1.5 }}>
              {liveError
                ? 'La page n affiche plus les annonces mock. Verifie la connexion Supabase ou les variables .env.local.'
                : 'Elargis la recherche, change de vue sauvegardee ou reinitialise les filtres actifs.'}
            </span>
            {!liveError && (
              <button type="button" onClick={resetFilters} style={{ ...smallSecondaryButtonStyle, margin: '14px auto 0', height: 34 }}>
                Reinitialiser les filtres
              </button>
            )}
          </div>
        )}

        {!isInitialLiveLoading && filtered.length > 0 && (
          <div className="lv-biens-pagination" style={{ display: 'flex', justifyContent: 'center', padding: '26px 0 4px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: 'var(--color-text-secondary)',
              }}
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 6,
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.4 : 1,
                }}
                aria-label="Page precedente"
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                Page&nbsp;<strong style={{ color: 'var(--color-text-primary)' }}>{page}</strong>&nbsp;/&nbsp;{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 6,
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.4 : 1,
                }}
                aria-label="Page suivante"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      {advancedOpen && (
        <AdvancedFiltersPanel
          onClose={() => setAdvancedOpen(false)}
          onReset={resetFilters}
          onPreset={applyPreset}
          priceMin={priceMin}
          setPriceMin={(value) => { setPriceMin(value); setPage(1); }}
          priceMax={priceMax}
          setPriceMax={(value) => { setPriceMax(value); setPage(1); }}
          bedroomsMin={bedroomsMin}
          setBedroomsMin={(value) => { setBedroomsMin(value); setPage(1); }}
          surfaceMin={surfaceMin}
          setSurfaceMin={(value) => { setSurfaceMin(value); setPage(1); }}
          filterCommune={filterCommune}
          setFilterCommune={(value) => { setFilterCommune(value); setPage(1); }}
          communes={communes}
          filterType={filterType}
          setFilterType={(value) => { setFilterType(value); setPage(1); }}
          propertyTypes={propertyTypes}
          filterSource={filterSource}
          setFilterSource={(value) => { setFilterSource(value); setPage(1); }}
          sources={sources}
          sellerFilter={sellerFilter}
          setSellerFilter={(value) => { setSellerFilter(value); setPage(1); }}
          filterSignal={filterSignal}
          setFilterSignal={(value) => { setFilterSignal(value); setPage(1); }}
          scoreMin={scoreMin}
          setScoreMin={(value) => { setScoreMin(value); setPage(1); }}
          ageFilter={ageFilter}
          setAgeFilter={(value) => { setAgeFilter(value); setPage(1); }}
          favoritesOnly={favoritesOnly}
          setFavoritesOnly={(value) => { setFavoritesOnly(value); setPage(1); }}
          contactFilter={contactFilter}
          setContactFilter={(value) => { setContactFilter(value); setPage(1); }}
          pipelineFilter={pipelineFilter}
          setPipelineFilter={(value) => { setPipelineFilter(value); setPage(1); }}
          taskFilter={taskFilter}
          setTaskFilter={(value) => { setTaskFilter(value); setPage(1); }}
          statusFilter={statusFilter}
          setStatusFilter={(value) => { setStatusFilter(value); setPage(1); }}
          visibleCount={filtered.length}
        />
      )}
      {selectedProperty && (
        <LegacyMiniFicheBien
          property={selectedProperty}
          store={store}
          score={selectedProperty.supabasePropertyId ? scoresByProperty[selectedProperty.supabasePropertyId] : undefined}
          liveSignals={selectedProperty.supabasePropertyId ? signalsByProperty[selectedProperty.supabasePropertyId] ?? [] : []}
          currentAgentName={currentAgent.name}
          photoIndex={panelPhotoIndex}
          setPhotoIndex={setPanelPhotoIndex}
          noteDraft={noteDraft}
          setNoteDraft={setNoteDraft}
          onSaveNote={savePanelNote}
          onClose={closePanel}
          onToggleFavorite={handleFav(selectedProperty.id)}
          onToggleIgnored={handleIgnored(selectedProperty.id)}
          isFavorite={propertyMarks.isFavorite(getMarkId(selectedProperty))}
          onOpenFull={() => openFullProperty(selectedProperty)}
        />
      )}
      {fullProperty && (
        <GrandeFicheBien
          property={fullProperty}
          store={store}
          score={fullProperty.supabasePropertyId ? scoresByProperty[fullProperty.supabasePropertyId] : undefined}
          liveSignals={fullProperty.supabasePropertyId ? signalsByProperty[fullProperty.supabasePropertyId] ?? [] : []}
          currentAgentName={currentAgent.name}
          isFavorite={propertyMarks.isFavorite(getMarkId(fullProperty))}
          onToggleFavorite={() => void propertyMarks.toggleFavorite(getMarkId(fullProperty))}
          onToggleIgnored={() => void propertyMarks.toggleIgnored(getMarkId(fullProperty))}
          onClose={() => setFullPropertyId(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface AdvancedFiltersPanelProps {
  onClose: () => void;
  onReset: () => void;
  onPreset: (preset: 'fsbo' | 'drops' | 'score70' | 'age60' | 'no_contact' | 'follow_up') => void;
  priceMin: string;
  setPriceMin: (value: string) => void;
  priceMax: string;
  setPriceMax: (value: string) => void;
  bedroomsMin: string;
  setBedroomsMin: (value: string) => void;
  surfaceMin: string;
  setSurfaceMin: (value: string) => void;
  filterCommune: string;
  setFilterCommune: (value: string) => void;
  communes: string[];
  filterType: string;
  setFilterType: (value: string) => void;
  propertyTypes: string[];
  filterSource: string;
  setFilterSource: (value: string) => void;
  sources: string[];
  sellerFilter: SellerFilter;
  setSellerFilter: (value: SellerFilter) => void;
  filterSignal: string;
  setFilterSignal: (value: string) => void;
  scoreMin: string;
  setScoreMin: (value: string) => void;
  ageFilter: string;
  setAgeFilter: (value: string) => void;
  favoritesOnly: boolean;
  setFavoritesOnly: (value: boolean) => void;
  contactFilter: ContactFilter;
  setContactFilter: (value: ContactFilter) => void;
  pipelineFilter: PipelineFilter;
  setPipelineFilter: (value: PipelineFilter) => void;
  taskFilter: TaskFilter;
  setTaskFilter: (value: TaskFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  visibleCount: number;
}

function AdvancedFiltersPanel(props: AdvancedFiltersPanelProps) {
  const {
    onClose, onReset, onPreset, priceMin, setPriceMin, priceMax, setPriceMax,
    bedroomsMin, setBedroomsMin, surfaceMin, setSurfaceMin, filterCommune,
    setFilterCommune, communes, filterType, setFilterType, propertyTypes,
    filterSource, setFilterSource, sources, sellerFilter, setSellerFilter,
    filterSignal, setFilterSignal, scoreMin, setScoreMin, ageFilter,
    setAgeFilter, favoritesOnly, setFavoritesOnly, contactFilter,
    setContactFilter, pipelineFilter, setPipelineFilter, taskFilter,
    setTaskFilter, statusFilter, setStatusFilter, visibleCount,
  } = props;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(31,31,31,0.18)', display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <aside className="lv-biens-advanced" style={{ width: 420, maxWidth: 'calc(100vw - 24px)', height: '100%', background: 'var(--color-bg-surface)', borderLeft: '1px solid var(--color-border-default)', boxShadow: '-14px 0 34px rgba(31,31,31,0.12)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--notion-sans)' }} onClick={(event) => event.stopPropagation()} aria-label="Filtres avancés des biens">
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border-default)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: 'var(--color-text-primary)' }}>Filtres avancés</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{visibleCount} biens dans la vue actuelle</p>
          </div>
          <button type="button" onClick={onClose} style={iconButtonStyle} aria-label="Fermer les filtres">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={advancedSectionStyle}>
            <AdvancedSectionTitle title="Presets rapides" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <PresetButton label="Particuliers" onClick={() => onPreset('fsbo')} />
              <PresetButton label="Baisses de prix" onClick={() => onPreset('drops')} />
              <PresetButton label="Score 70+" onClick={() => onPreset('score70')} />
              <PresetButton label="+60 jours" onClick={() => onPreset('age60')} />
              <PresetButton label="Sans contact" onClick={() => onPreset('no_contact')} />
              <PresetButton label="A relancer" onClick={() => onPreset('follow_up')} />
            </div>
          </section>

          <section style={advancedSectionStyle}>
            <AdvancedSectionTitle title="Bien" />
            <div style={advancedGridStyle}>
              <AdvancedSelect label="Commune" value={filterCommune} options={communes} onChange={setFilterCommune} />
              <AdvancedSelect label="Type" value={filterType} options={propertyTypes} onChange={setFilterType} />
              <AdvancedSelect label="Prix min" value={priceMin} options={PRICE_MIN_OPTIONS} onChange={setPriceMin} />
              <AdvancedSelect label="Prix max" value={priceMax} options={PRICE_MAX_OPTIONS} onChange={setPriceMax} />
              <AdvancedSelect label="Chambres" value={bedroomsMin} options={BEDROOM_OPTIONS} onChange={setBedroomsMin} />
              <AdvancedSelect label="Surface" value={surfaceMin} options={SURFACE_OPTIONS} onChange={setSurfaceMin} />
            </div>
          </section>

          <section style={advancedSectionStyle}>
            <AdvancedSectionTitle title="Source" />
            <div style={advancedGridStyle}>
              <AdvancedSelect label="Plateforme" value={filterSource} options={sources} onChange={setFilterSource} />
              <AdvancedSelect label="Vendeur" value={sellerFilter} options={SELLER_OPTIONS} onChange={(value) => setSellerFilter(value as SellerFilter)} />
            </div>
          </section>

          <section style={advancedSectionStyle}>
            <AdvancedSectionTitle title="Opportunité" />
            <div style={advancedGridStyle}>
              <AdvancedSelect label="Signal" value={filterSignal} options={['Tous', 'FSBO', 'Baisse de prix', 'Republié', 'Nouveau', 'Archivé']} onChange={setFilterSignal} />
              <AdvancedSelect label="Score min" value={scoreMin} options={SCORE_OPTIONS} onChange={setScoreMin} />
              <AdvancedSelect label="Ancienneté" value={ageFilter} options={AGE_OPTIONS} onChange={setAgeFilter} />
              <TogglePill label="Favoris uniquement" checked={favoritesOnly} onChange={setFavoritesOnly} />
            </div>
          </section>

          <section style={advancedSectionStyle}>
            <AdvancedSectionTitle title="Suivi CRM" />
            <div style={advancedGridStyle}>
              <AdvancedSelect label="Contact" value={contactFilter} options={CONTACT_OPTIONS} onChange={(value) => setContactFilter(value as ContactFilter)} />
              <AdvancedSelect label="Pipeline" value={pipelineFilter} options={PIPELINE_OPTIONS} onChange={(value) => setPipelineFilter(value as PipelineFilter)} />
              <AdvancedSelect label="Tâche" value={taskFilter} options={TASK_OPTIONS} onChange={(value) => setTaskFilter(value as TaskFilter)} />
              <AdvancedSelect label="Statut" value={statusFilter} options={STATUS_OPTIONS} onChange={(value) => setStatusFilter(value as StatusFilter)} />
            </div>
          </section>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--color-border-default)', display: 'flex', gap: 10, background: 'var(--color-bg-surface)' }}>
          <button type="button" onClick={onReset} style={{ ...smallSecondaryButtonStyle, height: 38, justifyContent: 'center', flex: 1 }}>
            Réinitialiser
          </button>
          <button type="button" onClick={onClose} style={{ ...smallPrimaryButtonStyle, height: 38, justifyContent: 'center', flex: 1 }}>
            Voir {visibleCount} biens
          </button>
        </div>
      </aside>
    </div>
  );
}

function AdvancedSectionTitle({ title }: { title: string }) {
  return <h3 style={{ margin: '0 0 10px', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontWeight: 500 }}>{title}</h3>;
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ ...smallSecondaryButtonStyle, height: 30, borderRadius: 999, fontSize: 12 }}>{label}</button>;
}

function AdvancedSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, fontWeight: 650, color: 'var(--color-text-tertiary)' }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={advancedSelectStyle}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function TogglePill({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={{ alignSelf: 'end', minHeight: 35, border: checked ? '1px solid var(--color-favorite)' : '1px solid var(--color-border-default)', borderRadius: 8, background: checked ? 'var(--color-warning-bg)' : 'var(--color-bg-surface)', color: checked ? 'var(--color-warning-text)' : 'var(--color-text-primary)', fontSize: 12.5, fontWeight: 650, cursor: 'pointer' }}>
      {label}
    </button>
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
          background: isActive ? 'var(--color-bg-hover)' : 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 6,
          padding: '5px 10px',
          fontSize: 12,
          fontFamily: 'var(--notion-sans)',
          color: 'var(--color-text-primary)',
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
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
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
                background: value === opt ? 'var(--color-bg-hover)' : 'var(--color-bg-surface)',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-primary)',
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

interface MiniFicheBienProps {
  property: Property;
  store: Store;
  score?: ListingScore;
  liveSignals?: ListingSignal[];
  currentAgentName: string;
  photoIndex: number;
  setPhotoIndex: (index: number) => void;
  noteDraft: string;
  setNoteDraft: (value: string) => void;
  onSaveNote: () => void;
  onClose: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onToggleIgnored: (e: React.MouseEvent) => void;
  isFavorite: boolean;
  onOpenFull?: () => void;
}

function scoreBandLabel(score: ListingScore | undefined) {
  if (!score) return 'Faible';
  if (score.band === 'forte') return 'Forte';
  if (score.band === 'surveiller') return 'Surveiller';
  return 'Faible';
}

function scoreFactsLabel(facts: string[]) {
  if (facts.length === 0) return 'Signal';
  return facts.join(' · ');
}

function reasonBarWidth(contribution: number) {
  return `${Math.max(12, Math.min(100, Math.round((contribution / 28) * 100)))}%`;
}

function WhyThisScorePanel({
  score,
  compact = false,
}: {
  score?: ListingScore;
  compact?: boolean;
}) {
  const [showExcluded, setShowExcluded] = useState(false);
  const reasons = score?.breakdown.reasons ?? [];
  const visibleReasons = reasons.slice(0, 3);
  const remainingReasons = Math.max(0, reasons.length - visibleReasons.length);
  const excluded = score?.breakdown.excluded ?? [];

  return (
    <section style={compact ? miniSectionStyle : legacyModuleStyle}>
      <div style={compact ? undefined : legacyLabelStyle}>Pourquoi cet indice</div>
      {compact && <MiniSectionTitle title="Pourquoi cet indice" />}

      {visibleReasons.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 10 : 12, marginTop: compact ? 9 : 8 }}>
          {visibleReasons.map((reason, index) => (
            <div
              key={`${reason.signal}-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: compact ? '84px minmax(0, 1fr) 42px' : '108px minmax(0, 1fr) 48px',
                gap: 10,
                alignItems: 'start',
              }}
            >
              <span style={{ color: 'var(--color-text-secondary)', fontSize: compact ? 10.5 : 11, fontFamily: 'var(--notion-mono)', lineHeight: 1.35 }}>
                {scoreFactsLabel(reason.facts)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--color-text-primary)', fontSize: compact ? 11.5 : 12.5, fontWeight: 650, lineHeight: 1.35 }}>
                  {reason.reason_fr}
                </div>
                <div style={{ marginTop: 6, height: 6, background: 'var(--color-bg-muted)', overflow: 'hidden' }}>
                  <div style={{ width: reasonBarWidth(reason.contribution), height: '100%', background: '#1E5A3A' }} />
                </div>
              </div>
              <span style={{ color: 'var(--color-text-primary)', fontSize: compact ? 11 : 12, fontWeight: 700, textAlign: 'right', fontFamily: 'var(--notion-mono)' }}>
                {reason.contribution.toFixed(1)}
              </span>
            </div>
          ))}
          {remainingReasons > 0 && (
            <span style={{ color: 'var(--color-text-secondary)', fontSize: compact ? 11 : 11.5, fontWeight: 650 }}>
              + {remainingReasons} autres signaux
            </span>
          )}
        </div>
      ) : (
        <p style={{ margin: compact ? '9px 0 0' : '8px 0 0', color: 'var(--color-text-tertiary)', fontSize: compact ? 11.5 : 12 }}>
          Aucun motif score disponible.
        </p>
      )}

      {excluded.length > 0 && (
        <div style={{ marginTop: compact ? 10 : 12 }}>
          <button
            type="button"
            onClick={() => setShowExcluded((current) => !current)}
            style={{
              border: 0,
              background: 'transparent',
              padding: 0,
              color: 'var(--color-text-secondary)',
              fontSize: compact ? 11 : 11.5,
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            Signaux non evalués
          </button>
          {showExcluded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {excluded.map((item, index) => (
                <div key={`${item}-${index}`} style={{ color: 'var(--color-text-secondary)', fontSize: compact ? 11 : 11.5, lineHeight: 1.45 }}>
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MiniFicheBien({
  property,
  store,
  score,
  liveSignals = [],
  currentAgentName,
  photoIndex,
  setPhotoIndex,
  noteDraft,
  setNoteDraft,
  onSaveNote,
  onClose,
  onToggleFavorite,
  onToggleIgnored,
  isFavorite,
  onOpenFull,
}: MiniFicheBienProps) {
  const photos = property.photos.length > 0
    ? property.photos
    : propertyImageFallbacks(property.id);
  const currentPhoto = photos[photoIndex % photos.length];
  const price = formatEuro(property.price);
  const relatedSignals = store.getSignals().filter((signal) => signal.propertyId === property.id).slice(0, 4);
  const relatedDeal = store.getDeals().find((deal) => deal.propertyId === property.id);
  const relatedContact = relatedDeal ? store.getContact(relatedDeal.contactId) : undefined;
  const propertyTasks = useTasksFor({ propertyId: property.supabasePropertyId });
  const relatedTasks = propertyTasks.tasks.slice(0, 4).map(taskToView);
  const ownerAgent = property.ownerId ? store.getAgents().find((agent) => agent.id === property.ownerId) : undefined;
  const priceHistory = property.priceHistory?.slice(-3) ?? [];
  const latestDrop = priceHistory.length > 1
    ? priceHistory[priceHistory.length - 2].price - priceHistory[priceHistory.length - 1].price
    : 0;
  const propertyNotes = useNotes({ propertyId: property.supabasePropertyId });

  useEffect(() => {
    if (!propertyNotes.error) return;
    store.addNotification('notes_error', 'Synchronisation notes impossible', propertyNotes.error, '#biens');
  }, [propertyNotes.error, store]);

  const goToPhoto = (direction: 1 | -1) => {
    setPhotoIndex((photoIndex + direction + photos.length) % photos.length);
  };

  const handleSaveNote = () => {
    if (!noteDraft.trim()) return;
    void propertyNotes.createNote(noteDraft);
    setNoteDraft('');
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
        background: 'var(--color-bg-surface)',
        borderLeft: '1px solid var(--color-border-default)',
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
          borderBottom: '1px solid var(--color-border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: 0 }}>
            MINI FICHE
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 650, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            border: '1px solid var(--color-border-default)',
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-secondary)',
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
        <div style={{ position: 'relative', height: 218, background: 'var(--color-bg-hover)', overflow: 'hidden' }}>
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
                      background: index === photoIndex % photos.length ? 'var(--color-bg-surface)' : 'rgba(255,255,255,0.55)',
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
            <div style={{ color: 'var(--color-text-inverse)', textShadow: '0 1px 8px rgba(0,0,0,0.55)' }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{price}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 600 }}>{property.city} · {property.source}</p>
            </div>
            <span
              style={{
                padding: '5px 9px',
                borderRadius: 999,
                background: property.reserved ? 'var(--color-bg-hover)' : 'var(--color-success-bg)',
                color: property.reserved ? 'var(--color-text-secondary)' : 'var(--color-success-text)',
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 10 }}>
              <MiniMetric icon={<Clock size={14} />} label="En ligne" value={`${property.publishedDays} j`} />
              <MiniMetric icon={<FileText size={14} />} label="PEB" value={property.peb} />
            </div>
            <div style={{ marginTop: 12 }}>
              <SellerTensionScoreZone
                score={score}
                fallbackScore={property.score}
                size="panel"
                signals={liveSignals}
                isInactive={property.reserved || property.status?.startsWith('archiv')}
              />
            </div>
          </section>

          <WhyThisScorePanel score={score} compact />

          <section style={miniSectionStyle}>
            <MiniSectionTitle title="Résumé" />
            <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>
              {property.description || `Bien détecté sur ${property.source}, à analyser pour une prospection ciblée.`}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <MiniTag label={property.tag || 'Nouveau'} tone="warm" />
              {property.fsbo && <MiniTag label="FSBO" tone="green" />}
              {latestDrop > 0 && <MiniTag label={`Baisse ${formatEuro(latestDrop)}`} tone="red" />}
              <MiniTag label={`Suivi par ${ownerAgent?.name ?? currentAgentName}`} tone="neutral" />
            </div>
          </section>

          <section style={miniSectionStyle}>
            <MiniSectionTitle title="Signaux à traiter" />
            {relatedSignals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 9 }}>
                {relatedSignals.map((signal) => (
                  <div key={signal.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: 99, background: signal.type === 'drop' ? 'var(--color-favorite)' : 'var(--color-brand)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 650, color: 'var(--color-text-primary)' }}>{signal.heading}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>{signal.time} · {signal.source ?? property.source}</p>
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
                  <InfoRow key={`${point.date}-${point.price}`} label={point.date} value={formatEuro(point.price)} />
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
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: task.done ? 'var(--color-brand)' : 'var(--color-favorite)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>{task.date} · {task.time}</p>
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
                  if (event.key === 'Enter') handleSaveNote();
                }}
                placeholder="Ajouter une note interne..."
                style={{
                  flex: 1,
                  height: 34,
                  border: '1px solid var(--color-border-default)',
                  borderRadius: 8,
                  padding: '0 10px',
                  font: 'inherit',
                  fontSize: 12.5,
                  outline: 'none',
                }}
              />
              <button type="button" onClick={handleSaveNote} style={smallPrimaryButtonStyle}>
                Ajouter
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <NotesList
                notes={propertyNotes.notes.slice(0, 3)}
                isLoading={propertyNotes.isLoading}
                canEditNote={propertyNotes.canEditNote}
                onUpdate={propertyNotes.updateNote}
                onDelete={propertyNotes.deleteNote}
                emptyText="Aucune note pour ce bien."
                compact
              />
            </div>
          </section>
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderTop: '1px solid var(--color-border-default)',
          background: 'var(--color-bg-surface)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={onToggleFavorite} style={secondaryActionStyle}>
          <Heart size={14} fill={isFavorite ? 'var(--color-favorite)' : 'none'} color={isFavorite ? 'var(--color-favorite)' : 'var(--color-text-secondary)'} />
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
    color: 'var(--color-text-primary)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  };
}

function LegacyMiniFicheBien({
  property,
  store,
  score,
  liveSignals = [],
  currentAgentName,
  photoIndex,
  setPhotoIndex,
  noteDraft,
  setNoteDraft,
  onSaveNote,
  onClose,
  onToggleFavorite,
  onToggleIgnored,
  isFavorite,
  onOpenFull,
}: MiniFicheBienProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferRequestMessage, setTransferRequestMessage] = useState('');
  const photos = property.photos.length > 0
    ? property.photos
    : propertyImageFallbacks(property.id);
  const currentPhoto = photos[photoIndex % photos.length];
  const price = formatEuro(property.price);
  const relatedDeal = store.getDeals().find((deal) => deal.propertyId === property.id);
  const { profile } = useAuth();
  const dealsState = useDeals({ includeClosed: false });
  const transfersState = useMyTransfers({ direction: 'all' });
  const relatedSupabaseDeal = property.supabasePropertyId
    ? dealsState.deals.find((deal) => deal.property_id === property.supabasePropertyId && !deal.closed_at)
    : null;
  const dealForActions = relatedSupabaseDeal;
  const isDealOwner = Boolean(dealForActions && profile?.id === dealForActions.owner_id);
  const pendingMyTransfer = dealForActions
    ? transfersState.transfers.find((transfer) => transfer.deal_id === dealForActions.id && transfer.status === 'pending' && transfer.requested_by === profile?.id)
    : undefined;
  const relatedContact = relatedDeal ? store.getContact(relatedDeal.contactId) : undefined;
  const relatedSignals = store.getPropertySignals(property.id).slice(0, 4);
  const propertyTasks = useTasksFor({ propertyId: property.supabasePropertyId });
  const relatedTasks = propertyTasks.tasks.slice(0, 4).map(taskToView);
  const { contacts } = useContacts();
  const [selectedContactId, setSelectedContactId] = useState(relatedContact?.id ?? '');
  const propertyStatus: PropertyInternalStatus = property.status ?? (property.reserved ? 'réservé' : 'disponible');
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
  const nextOpenTask = relatedTasks.find((task) => !task.done);
  const primarySignal = relatedSignals[0];
  const propertyNotes = useNotes({ propertyId: property.supabasePropertyId });
  const recommendedAction = nextOpenTask
    ? nextOpenTask.title
    : !relatedContact
      ? 'Lier un contact vendeur avant de creer le suivi commercial.'
      : relatedDeal
        ? `Faire avancer le deal vers ${relatedDeal.stage}.`
        : primarySignal
          ? `Traiter le signal: ${primarySignal.heading}.`
          : 'Qualifier le bien et programmer une prochaine action.';
  const opportunityReason = getOpportunityReason(property, store);
  const visibleThumbs = photos.length > 6 ? photos.slice(0, 6) : photos;
  const hiddenPhotoCount = Math.max(0, photos.length - 5);

  useEffect(() => {
    if (!propertyNotes.error) return;
    store.addNotification('notes_error', 'Synchronisation notes impossible', propertyNotes.error, '#biens');
  }, [propertyNotes.error, store]);

  const goToPhoto = (direction: 1 | -1) => {
    setPhotoIndex((photoIndex + direction + photos.length) % photos.length);
  };

  const handleSaveNote = () => {
    if (!noteDraft.trim()) return;
    void propertyNotes.createNote(noteDraft);
    setNoteDraft('');
  };

  useEffect(() => {
    setSelectedContactId(relatedContact?.id ?? '');
    setTaskTitle('');
    setActionMessage('');
    setTransferModalOpen(false);
    setTransferRequestMessage('');
  }, [property.id, relatedContact?.id]);

  const handleStatusChange = (status: PropertyInternalStatus) => {
    store.updatePropertyStatus(property.id, status);
    setActionMessage(`Statut mis à jour : ${status}`);
  };

  const handleLinkContact = () => {
    if (!selectedContactId) {
      setActionMessage('Choisis un contact à lier.');
      return;
    }

    const contact = store.linkPropertyToContact(property.id, selectedContactId);
    setActionMessage(contact ? `Contact lié : ${contact.name}` : 'Contact introuvable.');
  };

  const handleLinkSupabaseContact = () => {
    if (!selectedContactId) {
      setActionMessage('Choisis un contact a lier.');
      return;
    }

    if (!property.supabasePropertyId) {
      setActionMessage("Ce bien n'est pas encore synchronise avec Supabase.");
      return;
    }

    const contact = contacts.find((item) => item.id === selectedContactId);
    void contactsService.linkPropertyToContact(selectedContactId, property.supabasePropertyId, 'interested')
      .then(() => setActionMessage(contact ? `Contact lie : ${contact.full_name}` : 'Contact lie.'))
      .catch((linkError) => {
        setActionMessage(linkError instanceof Error ? linkError.message : 'Liaison contact impossible.');
      });
  };

  const handleCreateTask = () => {
    const title = taskTitle.trim();
    if (!title) {
      setActionMessage('Ajoute un intitule de tache.');
      return;
    }

    void propertyTasks.createTask({
      title,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      priority: 'moyenne',
    })
      .then(() => {
        setTaskTitle('');
        setActionMessage('Tache creee pour demain a 09:00.');
      })
      .catch((error: unknown) => {
        setActionMessage(error instanceof Error ? error.message : 'Creation de la tache impossible.');
      });
  };

  const handleCreateDeal = () => {
    if (dealForActions) {
      window.location.hash = dealForActions.reference ? `#pipeline?deal=${encodeURIComponent(dealForActions.reference)}` : `#pipeline?dealId=${encodeURIComponent(dealForActions.id)}`;
      return;
    }

    if (!property.supabasePropertyId) {
      setActionMessage("Ce bien n'est pas encore synchronise avec Supabase.");
      return;
    }

    if (!selectedContactId) {
      setActionMessage('Lie un contact avant de créer un deal.');
      return;
    }

    void dealsService.createDeal({
      property_id: property.supabasePropertyId,
      contact_id: selectedContactId,
      title: property.title,
      estimated_commission: Math.round(property.price * 0.03),
    }).then((deal) => {
      setActionMessage(`Deal cree : ${deal.reference ?? deal.title}`);
      window.location.hash = deal.reference ? `#pipeline?deal=${encodeURIComponent(deal.reference)}` : '#pipeline';
    }).catch((error) => {
      setActionMessage(error instanceof Error ? error.message : 'Impossible de creer le deal.');
    });
  };

  const handleRequestTransfer = () => {
    if (!dealForActions) return;
    void transfersState.requestTransfer({ dealId: dealForActions.id, message: transferRequestMessage })
      .then(() => {
        setTransferModalOpen(false);
        setTransferRequestMessage('');
        setActionMessage(`Demande envoyee a ${dealForActions.owner?.full_name ?? dealForActions.owner?.email ?? 'l owner'}.`);
      })
      .catch((error: unknown) => setActionMessage(error instanceof Error ? error.message : 'Demande de transfert impossible.'));
  };

  const handleCancelTransfer = () => {
    if (!pendingMyTransfer) return;
    void transfersState.cancelTransfer(pendingMyTransfer.id)
      .then(() => setActionMessage('Demande de transfert annulee.'))
      .catch((error: unknown) => setActionMessage(error instanceof Error ? error.message : 'Annulation impossible.'));
  };

  const renderDealActionButton = (variant: 'small' | 'large' = 'small') => {
    const buttonStyle = variant === 'large'
      ? { ...legacyPrimaryButtonStyle, width: '100%', height: 38 }
      : { ...smallPrimaryButtonStyle, height: 36, justifyContent: 'center' };

    if (!dealForActions) {
      return <button type="button" onClick={handleCreateDeal} style={buttonStyle}>Creer un deal</button>;
    }

    if (isDealOwner) {
      return <button type="button" onClick={handleCreateDeal} style={buttonStyle}>Voir mon deal</button>;
    }

    if (pendingMyTransfer) {
      return (
        <div style={{ display: 'grid', gap: 7 }}>
          <span style={{ border: '1px solid var(--color-border-default)', borderRadius: 999, background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', padding: '5px 9px', fontSize: 11, fontWeight: 750, textAlign: 'center' }}>
            Transfert demande
          </span>
          <button type="button" onClick={handleCancelTransfer} style={variant === 'large' ? legacySecondaryButtonStyle : smallSecondaryButtonStyle}>Annuler la demande</button>
        </div>
      );
    }

    return <button type="button" onClick={() => setTransferModalOpen(true)} style={buttonStyle}>Demander transfert</button>;
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
        className="lv-biens-mini"
        style={{
          position: 'fixed',
          top: 58,
          right: 0,
          bottom: 0,
          width: 462,
          zIndex: 30,
          background: 'var(--color-bg-surface)',
          borderLeft: '1px solid var(--color-border-default)',
          boxShadow: '-10px 0 28px rgba(29, 31, 30, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--notion-sans)',
        }}
        aria-label="Mini fiche bien"
      >

      <div style={{ overflowY: 'auto', minHeight: 0, flex: 1, background: 'var(--color-bg-surface)' }}>
        <div style={{ paddingTop: 12 }}>
          <div style={{ padding: '2px 16px 12px', borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
          <h2 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: 18, fontWeight: 750, lineHeight: 1.18, flex: 1, minWidth: 0 }}>
            {property.title}
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, paddingTop: 1 }}>
              <span style={{ color: 'var(--color-text-primary)', fontSize: 18, fontWeight: 750, whiteSpace: 'nowrap' }}>{price}</span>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>
                <strong style={{ color: deltaPercent < 0 ? 'var(--color-brand)' : 'var(--color-danger-text)' }}>
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
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 12.5, fontWeight: 500 }}>
            {property.city} · Publié il y a {property.publishedDays} j
          </span>
          <span style={legacyStatusStyle(property.reserved)}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: property.reserved ? 'var(--color-warning-dot)' : 'var(--color-brand)' }} />
            {property.reserved ? 'Réservé' : 'Disponible'}
          </span>
        </div>
      </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 7, padding: '10px 16px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            {visibleThumbs.map((url, index) => {
              const isMoreThumb = photos.length > 6 && index === 5;
              const targetIndex = isMoreThumb ? 5 : index;
              return (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => setPhotoIndex(targetIndex)}
                style={legacyThumbStyle(targetIndex === photoIndex % photos.length, isMoreThumb)}
              >
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {isMoreThumb && (
                  <span style={legacyMoreThumbOverlayStyle}>
                    +{hiddenPhotoCount}
                  </span>
                )}
              </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section style={{ ...legacyModuleStyle, borderColor: 'var(--color-success-border)', background: 'var(--color-success-bg)' }}>
            <div style={legacyLabelStyle}>POURQUOI CE BIEN ?</div>
            <p style={{ margin: '5px 0 12px', color: 'var(--color-brand)', fontSize: 13, lineHeight: 1.45, fontWeight: 750 }}>
              {opportunityReason}
            </p>
            <div style={legacyLabelStyle}>ACTION RECOMMANDEE</div>
            <p style={{ margin: '5px 0 10px', color: 'var(--color-text-primary)', fontSize: 13, lineHeight: 1.45, fontWeight: 650 }}>
              {recommendedAction}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!relatedContact && (
                <button type="button" onClick={() => setActionMessage('Choisis un contact dans Actions CRM, puis clique sur Lier.')} style={smallSecondaryButtonStyle}>
                  Lier un contact
                </button>
              )}
              {!nextOpenTask && (
                <button type="button" onClick={() => setTaskTitle('Appeler le proprietaire')} style={smallSecondaryButtonStyle}>
                  Preparer une tache
                </button>
              )}
              <button type="button" onClick={handleCreateDeal} style={smallPrimaryButtonStyle}>
                {relatedDeal ? 'Voir le deal' : 'Creer un deal'}
              </button>
            </div>
          </section>

          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>Indice de tension vendeur</div>
            <SellerTensionScoreZone
              score={score}
              fallbackScore={property.score}
              size="panel"
              signals={liveSignals}
              isInactive={property.reserved || property.status?.startsWith('archiv')}
            />
            <div style={{ marginTop: 10 }}>
              <span style={legacyAlertChipStyle}>Bande {scoreBandLabel(score)} · score vendeur recalcule en base</span>
            </div>
          </section>

          <WhyThisScorePanel score={score} />

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
              <LegacyMarketCell label="Prix moyen de la commune" value={`${formatEuro(cityAvg)} / m²`} />
              <LegacyMarketCell label="Prix au m² de ce bien" value={formatEuro(propPpm)} delta={`${deltaPercent >= 0 ? '+' : ''}${deltaPercent}%`} positive={deltaPercent < 0} />
            </div>
            <div style={legacyMarketBarStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Baromètre des prix communaux</span>
                <span style={legacyDeltaPillStyle(deltaPercent < 0)}>{deltaPercent < 0 ? 'Sous le marché' : 'Premium de zone'}</span>
              </div>
              <div style={{ position: 'relative', height: 6, borderRadius: 999, background: 'linear-gradient(90deg, var(--color-success-border) 0%, var(--color-warning-border) 50%, var(--color-danger-border) 100%)' }}>
                <span style={{ position: 'absolute', left: `${barPercent}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: 999, background: 'var(--color-bg-surface)', border: '3px solid var(--color-text-primary)', boxShadow: '0 2px 4px rgba(0,0,0,0.12)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--notion-mono)', fontSize: 9.5, color: 'var(--color-text-tertiary)' }}>
                <span>Décoté</span>
                <span>Équilibre</span>
                <span>Surévalué</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-primary)', fontSize: 12.5, fontWeight: 500, marginTop: 8 }}>
              Géoréférencement : {property.city} centre zone d'évaluation locale
            </div>
          </section>

          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>HISTORIQUE DES VARIATIONS DE PRIX</div>
            <div style={{ fontFamily: 'var(--notion-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, letterSpacing: 0, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
              Évolution de l'offre publicitaire
            </div>
            {priceHistory.length > 0 ? priceHistory.map((point, index) => (
              <LegacyPriceHistoryRow
                key={`${point.date}-${point.price}`}
                date={index === priceHistory.length - 1 ? "Aujourd'hui" : point.date}
                price={formatEuro(point.price)}
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
                <span style={{ width: 7, height: 7, borderRadius: 999, background: property.source === 'Immoweb' ? 'var(--color-source-border)' : property.source === 'Biddit' ? 'var(--color-source-border)' : 'var(--color-brand)' }} />
                {property.source}
              </span>
              <span style={{ fontFamily: 'var(--notion-mono)', fontSize: 10.5, color: 'var(--color-text-secondary)' }}>
                {property.source.slice(0, 3).toUpperCase()}-{property.id * 83712}
              </span>
            </div>
          </section>

          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>DESCRIPTION DE L'ANNONCE</div>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 12.5, lineHeight: 1.55 }}>
              {property.description}
            </p>
          </section>

          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>CONSEILLER RESPONSABLE DU MANDAT</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--color-text-primary)', fontSize: 13.5, fontWeight: 750 }}>{vendorName}</div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 2 }}>{vendorType}</div>
                <div style={{ color: 'var(--color-text-tertiary)', fontSize: 11.5, marginTop: 5 }}>
                  {relatedContact ? `${relatedContact.phone} · ${relatedContact.email}` : '+32 2 345 67 89 · contact@immopilot.be'}
                </div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--color-neutral-bg)', display: 'grid', placeItems: 'center', color: 'var(--color-text-secondary)', fontSize: 14, fontWeight: 750 }}>
                {vendorInitials}
              </div>
            </div>
          </section>

          <section style={legacyModuleStyle}>
            <div style={legacyLabelStyle}>NOTES INTERNES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSaveNote();
                  }}
                  placeholder="Ajouter une note de visite interne..."
                  style={{ flex: 1, height: 34, border: '1px solid var(--color-border-default)', borderRadius: 6, padding: '0 10px', font: 'inherit', fontSize: 12.5, outline: 'none' }}
                />
                <button type="button" onClick={handleSaveNote} style={{ ...smallPrimaryButtonStyle, height: 34 }}>
                  <FileText size={14} />
                </button>
              </div>
              <NotesList
                notes={propertyNotes.notes.slice(0, 3)}
                isLoading={propertyNotes.isLoading}
                canEditNote={propertyNotes.canEditNote}
                onUpdate={propertyNotes.updateNote}
                onDelete={propertyNotes.deleteNote}
                emptyText="Aucune note pour ce bien."
                compact
              />
            </div>
          </section>

          <div
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 4,
              padding: '10px 0 6px',
              background: 'var(--color-bg-surface)',
              borderTop: '1px solid var(--color-border-subtle)',
              boxShadow: '0 -8px 18px rgba(29, 31, 30, 0.05)',
            }}
          >
            <div style={{ flex: '1 1 40%', minWidth: 0 }}>
              {renderDealActionButton('large')}
            </div>
            <button
              type="button"
              onClick={onToggleFavorite}
              style={{
                ...legacySecondaryButtonStyle,
                height: 36,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 650,
                gap: 5,
                flex: '0 0 auto',
              }}
            >
              <Heart size={12} fill={isFavorite ? 'currentColor' : 'none'} />
              Favori
            </button>
            <button
              type="button"
              onClick={onToggleIgnored}
              style={{
                ...legacySecondaryButtonStyle,
                height: 36,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 650,
                gap: 5,
                flex: '0 0 auto',
              }}
            >
              <X size={12} />
              Ignorer
            </button>
            <button
              type="button"
              onClick={onOpenFull}
              style={{
                ...legacySecondaryButtonStyle,
                height: 36,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 650,
                gap: 5,
                flex: '0 0 auto',
              }}
            >
              <LayoutGrid size={12} />
              Detail
            </button>
          </div>
        </div>
      </div>
      </aside>

      {transferModalOpen && dealForActions && (
        <div className="transfers-modal-backdrop" role="presentation" onMouseDown={() => setTransferModalOpen(false)}>
          <div className="transfers-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Demander le transfert de {dealForActions.reference ?? dealForActions.title}</h2>
            <p>
              {property.title} · Owner actuel : {dealForActions.owner?.full_name ?? dealForActions.owner?.email ?? 'Agent'}
            </p>
            <label>
              Message optionnel
              <textarea value={transferRequestMessage} onChange={(event) => setTransferRequestMessage(event.target.value)} rows={4} />
            </label>
            <div className="transfers-modal-actions">
              <button type="button" onClick={() => setTransferModalOpen(false)}>Annuler</button>
              <button type="button" onClick={handleRequestTransfer}>Envoyer la demande</button>
            </div>
          </div>
        </div>
      )}

      <ImageLightbox
        open={isLightboxOpen}
        images={photos}
        index={photoIndex}
        title={property.title}
        onClose={() => setIsLightboxOpen(false)}
        onIndexChange={setPhotoIndex}
      />
    </>
  );
}

interface GrandeFicheBienProps {
  property: Property;
  store: Store;
  score?: ListingScore;
  liveSignals?: ListingSignal[];
  currentAgentName: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onToggleIgnored: () => void;
  onClose: () => void;
}

function GrandeFicheBien({
  property,
  store,
  score,
  liveSignals = [],
  currentAgentName,
  isFavorite,
  onToggleFavorite,
  onToggleIgnored,
  onClose,
}: GrandeFicheBienProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [noteDraft, setNoteDraft] = useState('');
  const photos = property.photos.length > 0
    ? property.photos
    : propertyImageFallbacks(property.id);
  const currentPhoto = photos[photoIndex % photos.length];
  const relatedDeal = store.getPropertyDeal(property.id);
  const relatedContact = relatedDeal ? store.getContact(relatedDeal.contactId) : store.getPropertyContact(property.id);
  const relatedSignals = store.getPropertySignals(property.id);
  const propertyTasks = useTasksFor({ propertyId: property.supabasePropertyId });
  const relatedTasks = propertyTasks.tasks.map(taskToView);
  const activities = store.getPropertyActivities(property.id).slice(0, 5);
  const price = formatEuro(property.price);
  const propType = property.title.toLowerCase().includes('appartement')
    ? 'Appartement'
    : property.title.toLowerCase().includes('loft')
      ? 'Loft'
      : property.title.toLowerCase().includes('villa')
        ? 'Villa'
        : 'Maison';
  const propPpm = Math.round(property.price / Math.max(property.surface, 1));
  const cityAvg = Math.round(propPpm * (0.9 + ((property.id * 7) % 22) / 100));
  const deltaPercent = Math.round(((propPpm - cityAvg) / cityAvg) * 100);
  const ownerAgent = property.ownerId ? store.getAgents().find((agent) => agent.id === property.ownerId) : undefined;
  const vendorName = relatedContact?.name ?? ownerAgent?.name ?? (property.fsbo ? 'Propriétaire particulier' : currentAgentName);
  const vendorMeta = relatedContact
    ? `${relatedContact.phone} · ${relatedContact.email}`
    : property.fsbo
      ? 'Contact propriétaire à qualifier'
      : 'Conseiller responsable';
  const nextTask = relatedTasks.find((task) => !task.done) ?? relatedTasks[0];
  const propertyNotes = useNotes({ propertyId: property.supabasePropertyId });

  useEffect(() => {
    if (!propertyNotes.error) return;
    store.addNotification('notes_error', 'Synchronisation notes impossible', propertyNotes.error, '#biens');
  }, [propertyNotes.error, store]);

  const goToPhoto = (direction: 1 | -1) => {
    setPhotoIndex((photoIndex + direction + photos.length) % photos.length);
  };

  const saveNote = () => {
    if (!noteDraft.trim()) return;
    void propertyNotes.createNote(noteDraft);
    setNoteDraft('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Grande fiche bien"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: '58px 0 0 0',
        zIndex: 80,
        background: 'rgba(29, 31, 30, 0.42)',
        backdropFilter: 'blur(4px)',
        padding: '16px 22px',
        overflow: 'hidden',
        fontFamily: 'var(--notion-sans)',
      }}
    >
      <section
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: 'min(1280px, calc(100vw - 32px))',
          height: '100%',
          margin: '0 auto',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 12,
          boxShadow: '0 30px 80px rgba(15, 18, 16, 0.30)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{ ...legacyCloseButtonStyle, position: 'absolute', top: 18, right: 18, zIndex: 2, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)' }}
          aria-label="Fermer la grande fiche"
        >
          <X size={18} strokeWidth={2.4} />
        </button>

        <div style={{ overflowY: 'auto', minHeight: 0, flex: 1, padding: 14, background: 'var(--color-bg-surface)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '570px minmax(0, 1fr)', gap: 24, padding: '2px 2px 16px' }}>
            <div>
              <div style={{ position: 'relative', height: 326, borderRadius: 7, background: 'var(--color-border-default)', overflow: 'hidden', border: '1px solid var(--color-border-default)' }}>
                <img src={currentPhoto} alt={property.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span style={{ position: 'absolute', top: 13, left: 14, padding: '5px 9px', borderRadius: 6, background: 'var(--color-success-bg)', color: 'var(--color-brand)', border: '1px solid var(--color-success-border)', fontSize: 11, fontWeight: 750 }}>
                  {property.reserved ? 'Réservé' : 'Disponible'}
                </span>
                {photos.length > 1 && (
                  <>
                    <button type="button" onClick={() => goToPhoto(-1)} style={dossierGalleryButtonStyle('left')} aria-label="Photo précédente">
                      <ChevronLeft size={18} />
                    </button>
                    <button type="button" onClick={() => goToPhoto(1)} style={dossierGalleryButtonStyle('right')} aria-label="Photo suivante">
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}
                <span style={{ position: 'absolute', right: 14, bottom: 14, padding: '4px 8px', borderRadius: 6, background: 'rgba(29,31,30,0.78)', color: 'var(--color-text-inverse)', fontFamily: 'var(--notion-mono)', fontSize: 10.5, fontWeight: 700 }}>
                  {(photoIndex % photos.length) + 1} / {photos.length}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 8 }}>
                {photos.slice(0, 6).map((url, index) => (
                  <button key={`${url}-${index}`} type="button" onClick={() => setPhotoIndex(index)} style={dossierThumbStyle(index === photoIndex % photos.length)}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {index === 5 && photos.length > 6 && (
                      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(29,31,30,0.52)', color: 'var(--color-text-inverse)', fontWeight: 800, fontSize: 13 }}>
                        +{photos.length - 5}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <DossierActionButton icon={<Search size={13} />}>Voir sur carte</DossierActionButton>
                <DossierActionButton icon={<LayoutGrid size={13} />} onClick={onClose}>Ouvrir mini fiche</DossierActionButton>
                <DossierActionButton icon={<Plus size={13} />}>Partager</DossierActionButton>
                <DossierActionButton onClick={onToggleIgnored}>Ignorer</DossierActionButton>
                <DossierActionButton>...</DossierActionButton>
              </div>
            </div>

            <aside style={{ padding: '10px 14px 0 8px' }}>
              <h2 style={{ margin: '4px 34px 8px 0', color: 'var(--color-text-primary)', fontFamily: 'var(--font-serif, var(--notion-serif))', fontSize: 34, lineHeight: 1.05, fontWeight: 400, letterSpacing: '-0.02em' }}>
                {property.title}
              </h2>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--color-brand)' }} />
                Avenue Brugmann 379, 1180 {property.city}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                <DossierChip tone="green">{property.reserved ? 'Réservé' : 'Disponible'}</DossierChip>
                <DossierChip tone="blue">{property.fsbo ? 'FSBO' : 'Mandat exclusif'}</DossierChip>
                <DossierChip tone="green">{relatedContact ? 'Client actif' : 'À qualifier'}</DossierChip>
                <button type="button" onClick={onToggleFavorite} style={{ border: 0, background: 'transparent', color: isFavorite ? 'var(--color-favorite)' : 'var(--color-text-secondary)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 4 }}>
                  <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(4, 1fr)', borderTop: '1px solid var(--color-border-subtle)', borderBottom: '1px solid var(--color-border-subtle)', marginTop: 18, padding: '13px 0' }}>
                <DossierTopMetric label="Prix demandé" value={price} strong />
                <DossierTopMetric label="Surface" value={`${property.surface} m²`} />
                <DossierTopMetric label="Chambres" value={String(property.bedrooms)} />
                <DossierTopMetric label="Salle(s) de bain" value={String(property.bathrooms)} />
                <DossierTopMetric label="PEB" value={property.peb} badge />
              </div>

              <div style={{ marginTop: 16, padding: '14px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <SellerTensionScoreZone
                  score={score}
                  fallbackScore={property.score}
                  size="panel"
                  signals={liveSignals}
                  isInactive={property.reserved || property.status?.startsWith('archiv')}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 28px', marginTop: 15, paddingRight: 8 }}>
                <DossierInfo label="Type de bien" value={propType} />
                <DossierInfo label="Terrain" value={`${Math.round(property.surface * 3.2)} m²`} />
                <DossierInfo label="Sous-type" value={propType === 'Appartement' ? 'Appartement' : 'Villa'} />
                <DossierInfo label="Façade" value={`${Math.max(2, property.bedrooms + 1)}`} />
                <DossierInfo label="Année de construction" value={String(1980 + (property.id * 7) % 42)} />
                <DossierInfo label="Orientation jardin" value="Sud-Ouest" />
                <DossierInfo label="État général" value={property.score > 76 ? 'Excellent' : 'Bon'} />
                <DossierInfo label="Chauffage" value={property.peb === 'A' ? 'Pompe à chaleur' : 'Gaz condensation'} />
                <DossierInfo label="Disponibilité" value={property.reserved ? 'À confirmer' : 'À convenir'} />
                <DossierInfo label="Revenu cadastral" value={`${(1500 + property.id * 83).toLocaleString('fr-BE')} €`} />
              </div>
            </aside>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              gap: 12,
              alignItems: 'stretch',
              gridAutoFlow: 'dense',
            }}
          >
            <DossierCard title="Caractéristiques" icon={<Square size={14} />} style={{ gridColumn: 'span 3', order: 4 }}>
              <DossierLine label="Surface habitable" value={`${property.surface} m²`} />
              <DossierLine label="Surface terrain" value={`${Math.round(property.surface * 3.2)} m²`} />
              <DossierLine label="Façades" value={String(Math.max(2, property.bedrooms + 1))} />
              <DossierLine label="Étages" value={String(property.id % 3 + 1)} />
              <DossierLine label="Chambres" value={String(property.bedrooms)} />
              <DossierLine label="Salles de bain" value={String(property.bathrooms)} />
              <DossierLine label="Garages" value={property.id % 2 ? '1' : '2'} />
              <DossierLine label="PEB" value={property.peb} badge />
              <DossierLine label="Charges" value="--" />
            </DossierCard>

            <DossierCard title="Source" icon={<FileText size={14} />} style={{ gridColumn: 'span 3', order: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: property.source === 'Immoweb' ? 'var(--color-source-border)' : property.source === 'Biddit' ? 'var(--color-source-border)' : 'var(--color-brand)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 800 }}>{property.source}</div>
                  <div style={{ color: 'var(--color-text-tertiary)', fontSize: 11.5, marginTop: 2 }}>Annonce détectée en ligne</div>
                </div>
              </div>
              <DossierLine label="Référence" value={`${property.source.slice(0, 3).toUpperCase()}-${property.id * 83712}`} />
              <DossierLine label="Publication" value={`Il y a ${property.publishedDays} j`} />
              <DossierLine label="Type vendeur" value={property.fsbo ? 'Particulier' : 'Professionnel'} />
              <button type="button" style={dossierLinkButtonStyle}>Ouvrir l'annonce source</button>
            </DossierCard>

            <DossierCard title="Historique de prix" icon={<Clock size={14} />} style={{ gridColumn: 'span 4', order: 3 }}>
              <div style={{ minHeight: 132, display: 'grid', placeItems: 'center', textAlign: 'center', border: '1px dashed var(--color-border-strong)', borderRadius: 8, background: 'var(--color-bg-surface)', padding: 14 }}>
                <div>
                  <div style={{ color: 'var(--color-text-primary)', fontSize: 12.5, fontWeight: 800 }}>Aucun historique disponible</div>
                  <p style={{ margin: '5px auto 0', maxWidth: 190, color: 'var(--color-text-tertiary)', fontSize: 11.5, lineHeight: 1.45 }}>
                    Les variations de prix apparaîtront ici dès qu’ImmoPilot détecte un changement.
                  </p>
                </div>
              </div>
            </DossierCard>

            <DossierCard title="Description de l'annonce" icon={<FileText size={14} />} style={{ gridColumn: 'span 5', order: 1 }}>
              <p style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: 12.5, lineHeight: 1.58, maxHeight: 128, overflowY: 'auto', paddingRight: 4 }}>
                {property.description || `Annonce publiée sur ${property.source}. La description source sera affichée ici dès qu'elle est disponible.`}
              </p>
            </DossierCard>

            <DossierCard title="Marché local" icon={<FileText size={14} />} action="Voir le rapport" style={{ gridColumn: 'span 5', order: 5 }}>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 11.5, marginBottom: 10 }}>{property.city} · Quartier cible</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                <DossierMarketStat label="Prix médian" value={`${formatEuro(cityAvg)}/m²`} delta="+3%" />
                <DossierMarketStat label="Délai médian" value={`${28 + property.id * 2} jours`} delta="+5 jours" />
                <DossierMarketStat label="Demandes actives" value={String(88 + property.id * 6)} delta="+12%" />
              </div>
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--color-bg-page)', border: '1px solid var(--color-border-default)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)', fontSize: 11.5, marginBottom: 8 }}>
                  <span>Prix du bien</span>
                  <strong>{price}</strong>
                </div>
                <div style={{ position: 'relative', height: 5, borderRadius: 999, background: 'linear-gradient(90deg,var(--color-success-border),var(--color-warning-border),var(--color-danger-border))' }}>
                  <span style={{ position: 'absolute', left: '72%', top: -4, width: 13, height: 13, borderRadius: 99, background: 'var(--color-brand)', border: '2px solid var(--color-bg-surface)' }} />
                </div>
                <p style={{ margin: '9px 0 0', color: 'var(--color-text-secondary)', fontSize: 11.5 }}>Positionnement premium justifié par l’état, le PEB et les équipements.</p>
              </div>
            </DossierCard>

            <DossierCard title="Pourquoi cet indice" icon={<FileText size={14} />} style={{ gridColumn: 'span 5', order: 5 }}>
              <WhyThisScorePanel score={score} />
            </DossierCard>

            <DossierCard title="Contact / Pipeline" avatar={vendorName.slice(0, 2).toUpperCase()} style={{ gridColumn: 'span 4', order: 6 }}>
              <div style={{ color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 750 }}>{vendorName}</div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 11.5, marginBottom: 8 }}>{relatedContact ? 'Propriétaire' : vendorMeta}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 9 }}>
                <DossierActionButton>Appeler</DossierActionButton>
                <DossierActionButton>Email</DossierActionButton>
                <DossierActionButton>WhatsApp</DossierActionButton>
              </div>
              <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: 9, background: 'var(--color-bg-surface)' }}>
                <DossierInfo label="Étape actuelle" value={relatedDeal ? relatedDeal.stage : 'À qualifier'} />
                <DossierInfo label="Prochaine action" value={nextTask ? `${nextTask.date} à ${nextTask.time}` : 'Créer une tâche'} />
              </div>
              <div style={{ marginTop: 9 }}>
                <DossierLine label="Téléphone" value={relatedContact?.phone ?? '+32 475 44 22 11'} />
                <DossierLine label="Email" value={relatedContact?.email ?? 'contact@immopilot.be'} />
                <DossierLine label="Adresse" value={`1180 ${property.city}`} />
              </div>
            </DossierCard>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridColumn: '1 / -1', gap: 12, order: 7 }}>
              <DossierCard title="Signaux liés" icon={<Clock size={14} />}>
                {relatedSignals.length > 0 ? relatedSignals.slice(0, 3).map((signal) => (
                  <DossierSignal key={signal.id} title={signal.heading} meta={signal.info || signal.time} tone={signal.type === 'drop' ? 'orange' : 'green'} />
                )) : (
                  <p style={emptyMiniTextStyle}>Aucun signal actif lié à ce bien.</p>
                )}
                <button type="button" style={dossierLinkButtonStyle}>Voir tous les signaux</button>
              </DossierCard>

              <DossierCard title="Tâches liées" icon={<FileText size={14} />}>
                {relatedTasks.length > 0 ? relatedTasks.slice(0, 3).map((task) => (
                  <button key={task.id} type="button" onClick={() => { void propertyTasks.toggleTask(task.id); }} style={dossierTaskButtonStyle}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, border: '1px solid var(--color-border-strong)', background: task.done ? 'var(--color-brand)' : 'var(--color-bg-surface)' }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', color: task.done ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)', fontSize: 11.5, fontWeight: 650, textDecoration: task.done ? 'line-through' : 'none' }}>{task.title}</span>
                      <span style={{ display: 'block', color: 'var(--color-text-tertiary)', fontSize: 10.5 }}>{task.date} · {task.time}</span>
                    </span>
                    <span style={dossierPriorityStyle(task.priority)}>{task.priority}</span>
                  </button>
                )) : (
                  <p style={emptyMiniTextStyle}>Aucune tâche attachée à ce bien.</p>
                )}
                <button type="button" style={dossierLinkButtonStyle}>Ajouter une tâche</button>
              </DossierCard>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <DossierCard title="Activité récente" action="Voir toute l'activité">
              {activities.length > 0 ? activities.slice(0, 3).map((activity) => (
                <div key={activity.id} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0, 1fr)', gap: 10, padding: '6px 0', color: 'var(--color-text-secondary)', fontSize: 11.5 }}>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>{activity.date}</span>
                  <span><strong style={{ color: 'var(--color-text-primary)' }}>{activity.agentName}</strong> · {activity.text}</span>
                </div>
              )) : (
                <p style={emptyMiniTextStyle}>Aucune activité récente.</p>
              )}
            </DossierCard>

            <DossierCard title="Notes internes" action="Ajouter une note">
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') saveNote(); }}
                  placeholder="Ajouter une note interne..."
                  style={{ flex: 1, height: 32, border: '1px solid var(--color-border-default)', borderRadius: 7, padding: '0 10px', font: 'inherit', fontSize: 12, outline: 'none', background: 'var(--color-bg-surface)' }}
                />
                <button type="button" onClick={saveNote} style={{ ...smallPrimaryButtonStyle, height: 32 }}>Ajouter</button>
              </div>
              <div style={{ padding: 11, borderRadius: 8, background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', color: 'var(--color-text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                <NotesList
                  notes={propertyNotes.notes}
                  isLoading={propertyNotes.isLoading}
                  canEditNote={propertyNotes.canEditNote}
                  onUpdate={propertyNotes.updateNote}
                  onDelete={propertyNotes.deleteNote}
                  emptyText="Aucune note pour ce bien."
                  compact
                />
              </div>
            </DossierCard>
          </div>
        </div>
      </section>
    </div>
  );
}

function GrandeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 9, background: 'var(--color-bg-page)', padding: '10px 11px' }}>
      <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', fontFamily: 'var(--notion-sans)', fontWeight: 500, letterSpacing: 0 }}>{label}</div>
      <div style={{ color: 'var(--color-text-primary)', fontSize: 17, fontWeight: 750, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function DossierActionButton({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={dossierActionButtonStyle}>
      {icon}
      {children}
    </button>
  );
}

function DossierChip({ children, tone }: { children: React.ReactNode; tone: 'green' | 'blue' }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 22,
      padding: '3px 9px',
      borderRadius: 6,
      background: tone === 'green' ? 'var(--color-success-bg)' : 'var(--color-info-bg)',
      color: tone === 'green' ? 'var(--color-brand)' : 'var(--color-info-text)',
      border: `1px solid ${tone === 'green' ? 'var(--color-success-border)' : 'var(--color-info-border)'}`,
      fontSize: 11,
      fontWeight: 700,
    }}>
      {children}
    </span>
  );
}

function DossierTopMetric({ label, value, strong = false, badge = false }: { label: string; value: string; strong?: boolean; badge?: boolean }) {
  return (
    <div style={{ padding: '0 14px', borderRight: '1px solid var(--color-border-subtle)' }}>
      <div style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--notion-sans)', fontSize: 'var(--text-xs)', letterSpacing: 0, fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</div>
      {badge ? (
        <span style={{ display: 'inline-flex', marginTop: 6, minWidth: 22, justifyContent: 'center', padding: '2px 6px', borderRadius: 5, background: 'var(--color-success-bg)', color: 'var(--color-brand)', border: '1px solid var(--color-success-border)', fontSize: 12, fontWeight: 800 }}>{value}</span>
      ) : (
        <div style={{ marginTop: 7, color: 'var(--color-text-primary)', fontSize: strong ? 21 : 17, fontWeight: strong ? 800 : 700, whiteSpace: 'nowrap' }}>{value}</div>
      )}
    </div>
  );
}

function DossierInfo({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', minHeight: 20 }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 11.5 }}>{label}</span>
      <strong style={{ color: 'var(--color-text-primary)', fontSize: 11.5, fontWeight: 650, textAlign: 'right' }}>{value}</strong>
    </div>
  );
}

function DossierCard({
  title,
  children,
  icon,
  action,
  avatar,
  style,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  action?: string;
  avatar?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section style={{ ...dossierCardStyle, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {avatar ? (
            <span style={{ width: 36, height: 36, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', color: 'var(--color-brand)', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{avatar}</span>
          ) : (
            <span style={{ color: 'var(--color-brand)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{icon}</span>
          )}
          <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 800 }}>{title}</h3>
        </div>
        {action && <button type="button" style={dossierSmallLinkStyle}>{action}</button>}
      </div>
      {children}
    </section>
  );
}

function DossierLine({ label, value, badge = false }: { label: string; value: string; badge?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 11.5 }}>{label}</span>
      {badge ? (
        <span style={{ minWidth: 20, textAlign: 'center', padding: '2px 6px', borderRadius: 5, background: 'var(--color-brand)', color: 'var(--color-text-inverse)', fontSize: 10.5, fontWeight: 800 }}>{value}</span>
      ) : (
        <strong style={{ color: 'var(--color-text-primary)', fontSize: 11.5, fontWeight: 700, textAlign: 'right' }}>{value}</strong>
      )}
    </div>
  );
}

function DossierMarketStat({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div style={{ padding: 9, borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)' }}>
      <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', fontFamily: 'var(--notion-sans)', fontWeight: 500 }}>{label}</div>
      <strong style={{ display: 'block', marginTop: 5, color: 'var(--color-text-primary)', fontSize: 16, lineHeight: 1 }}>{value}</strong>
      <span style={{ display: 'block', marginTop: 5, color: 'var(--color-brand)', fontSize: 10.5, fontWeight: 700 }}>{delta}</span>
    </div>
  );
}

function DossierSignal({ title, meta, tone }: { title: string; meta: string; tone: 'green' | 'orange' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) auto', gap: 8, alignItems: 'start', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <span style={{ width: 18, height: 18, borderRadius: 6, background: tone === 'green' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: tone === 'green' ? 'var(--color-brand)' : 'var(--color-warning-text)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>!</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: 'var(--color-text-primary)', fontSize: 11.8, fontWeight: 750 }}>{title}</span>
        <span style={{ display: 'block', color: 'var(--color-text-tertiary)', fontSize: 10.5, marginTop: 2 }}>{meta}</span>
      </span>
      <span style={{ padding: '2px 6px', borderRadius: 5, background: tone === 'green' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: tone === 'green' ? 'var(--color-brand)' : 'var(--color-warning-text)', fontSize: 10.5, fontWeight: 750 }}>
        {tone === 'green' ? 'Fort' : 'Moyen'}
      </span>
    </div>
  );
}

function dossierGalleryButtonStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 12,
    transform: 'translateY(-50%)',
    width: 32,
    height: 32,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.75)',
    background: 'rgba(255,255,255,0.92)',
    color: 'var(--color-text-primary)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(29,31,30,0.16)',
  };
}

function dossierThumbStyle(active: boolean): React.CSSProperties {
  return {
    position: 'relative',
    height: 48,
    borderRadius: 5,
    overflow: 'hidden',
    border: active ? '2px solid var(--color-brand)' : '1px solid var(--color-border-default)',
    padding: 0,
    background: 'var(--color-border-subtle)',
    cursor: 'pointer',
  };
}

const dossierCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  padding: 12,
  boxShadow: '0 8px 22px rgba(29,31,30,0.035)',
  minHeight: 0,
};

const dossierActionButtonStyle: React.CSSProperties = {
  minHeight: 30,
  borderRadius: 7,
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  padding: '0 12px',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const dossierSmallLinkStyle: React.CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  font: 'inherit',
  fontSize: 10.5,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const dossierLinkButtonStyle: React.CSSProperties = {
  marginTop: 8,
  border: 0,
  background: 'transparent',
  color: 'var(--color-brand)',
  font: 'inherit',
  fontSize: 11.5,
  fontWeight: 750,
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
};

const dossierTaskButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  width: '100%',
  border: 0,
  background: 'transparent',
  padding: '6px 0',
  borderBottom: '1px solid var(--color-border-subtle)',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
};

function dossierPriorityStyle(priority: string): React.CSSProperties {
  const high = priority === 'haute';
  return {
    padding: '2px 6px',
    borderRadius: 5,
    background: high ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
    color: high ? 'var(--color-danger-text)' : 'var(--color-warning-text)',
    fontSize: 10.5,
    fontWeight: 750,
  };
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
    color: 'var(--color-text-inverse)',
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
  color: 'var(--color-text-secondary)',
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
    background: reserved ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
    color: reserved ? 'var(--color-warning-text)' : 'var(--color-brand)',
    border: reserved ? '1px solid var(--color-warning-border)' : '1px solid transparent',
    fontWeight: 700,
    fontSize: 11,
  };
}

const legacyGalleryMainStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  margin: 0,
  height: 220,
  background: 'var(--color-border-default)',
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
  background: 'var(--color-text-primary)',
  color: 'var(--color-text-inverse)',
  border: '1px solid var(--color-bg-surface)',
  fontSize: 11,
  fontWeight: 700,
  fontFamily: 'var(--notion-mono)',
  letterSpacing: '0.05em',
  zIndex: 5,
  boxShadow: '2px 2px 0 rgba(29,31,30,0.3)',
};

function legacyThumbStyle(active: boolean, isMoreThumb = false): React.CSSProperties {
  return {
    position: 'relative',
    aspectRatio: '1 / 1',
    width: '100%',
    borderRadius: 6,
    overflow: 'hidden',
    border: active ? '2px solid var(--color-brand)' : '2px solid transparent',
    padding: 0,
    background: 'var(--color-border-subtle)',
    cursor: 'pointer',
    isolation: 'isolate',
    opacity: isMoreThumb ? 0.98 : 1,
  };
}

const legacyMoreThumbOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(29,31,30,0.62)',
  color: 'var(--color-text-inverse)',
  fontSize: 15,
  fontWeight: 800,
  fontFamily: 'var(--notion-sans)',
  letterSpacing: '0.01em',
  zIndex: 2,
};

const legacyModuleStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 10,
  padding: 12,
  boxShadow: '0 2px 8px rgba(29,31,30,0.03)',
};

const grandeModuleStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 12,
  padding: 14,
  boxShadow: '0 10px 26px rgba(29,31,30,0.035)',
};

const grandeHighlightStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 12,
  padding: 14,
  boxShadow: '0 8px 20px rgba(29,31,30,0.035)',
};

const grandeActionStyle: React.CSSProperties = {
  background: 'var(--color-bg-muted)',
  border: '1px solid var(--color-warning-border)',
  borderRadius: 12,
  padding: 13,
};

const legacyLabelStyle: React.CSSProperties = {
  marginBottom: 10,
  color: 'var(--color-text-tertiary)',
  fontFamily: 'var(--notion-mono)',
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: 0,
};

function LegacyBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 22,
        padding: '3px 8px',
        borderRadius: 6,
        background: 'var(--color-neutral-bg)',
        border: '1px solid var(--color-border-subtle)',
        color: 'var(--color-text-secondary)',
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
  background: 'var(--color-warning-bg)',
  border: '1px solid var(--color-warning-border)',
  color: 'var(--color-warning-text)',
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
        borderBottom: '1px solid var(--color-border-subtle)',
        fontSize: 12.5,
      }}
    >
      <span style={{ color: 'var(--color-text-tertiary)', display: 'grid', placeItems: 'center' }}>{icon}</span>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <strong style={{ color: 'var(--color-text-primary)', fontSize: 12.5, fontWeight: 700, textAlign: 'right' }}>{value}</strong>
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
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 10.5, fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 750 }}>{value}</strong>
        {delta && <span style={legacyDeltaPillStyle(positive)}>{delta}</span>}
      </div>
    </div>
  );
}

const legacyMarketBarStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '10px 12px',
  borderRadius: 9,
  background: 'var(--color-bg-page)',
  border: '1px solid var(--color-border-subtle)',
};

function legacyDeltaPillStyle(positive: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 7px',
    borderRadius: 4,
    background: positive ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
    color: positive ? 'var(--color-brand)' : 'var(--color-danger-text)',
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
        borderBottom: '1px solid var(--color-border-subtle)',
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: tone === 'down' ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)',
        }}
      />
      <span style={{ fontFamily: 'var(--notion-mono)', fontSize: 10.5, color: 'var(--color-text-secondary)' }}>{date}</span>
      <strong style={{ color: 'var(--color-text-primary)', fontSize: 12, fontWeight: 650 }}>{price}</strong>
      <span
        style={{
          padding: '2px 7px',
          borderRadius: 4,
          background: tone === 'down' ? 'var(--color-danger-bg)' : 'var(--color-border-subtle)',
          color: tone === 'down' ? 'var(--color-danger-text)' : 'var(--color-text-secondary)',
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
  background: 'var(--color-neutral-bg)',
  border: '1px solid var(--color-border-subtle)',
  color: 'var(--color-text-primary)',
  fontSize: 12,
  fontWeight: 700,
};

const legacyPrimaryButtonStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 7,
  border: '1px solid var(--color-brand)',
  background: 'var(--color-brand)',
  color: 'var(--color-text-inverse)',
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
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
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
  border: '1px solid var(--color-border-default)',
  borderRadius: 10,
  background: 'var(--color-bg-surface)',
  padding: 12,
};

const emptyMiniTextStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12.5,
  color: 'var(--color-text-tertiary)',
  lineHeight: 1.45,
};

const miniEmptyActionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: '2px 0 0',
};

const smallPrimaryButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 8,
  background: 'var(--color-brand)',
  color: 'var(--color-text-inverse)',
  padding: '0 10px',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 650,
  cursor: 'pointer',
};

const smallSecondaryButtonStyle: React.CSSProperties = {
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
  padding: '0 10px',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 650,
  cursor: 'pointer',
  height: 34,
};

const iconButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-secondary)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};

const advancedSectionStyle: React.CSSProperties = {
  border: '1px solid var(--color-border-default)',
  borderRadius: 10,
  background: 'var(--color-bg-surface)',
  padding: 12,
};

const advancedGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const advancedSelectStyle: React.CSSProperties = {
  width: '100%',
  height: 35,
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
  padding: '0 9px',
  font: 'inherit',
  fontSize: 12.5,
  outline: 'none',
  boxSizing: 'border-box',
};

const legacyFieldLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: 'var(--color-text-secondary)',
  fontSize: 11.5,
  fontWeight: 700,
};

const legacyControlStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  border: '1px solid var(--color-border-default)',
  borderRadius: 7,
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
  padding: '0 9px',
  font: 'inherit',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

const secondaryActionStyle: React.CSSProperties = {
  flex: 1,
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
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
  border: '1px solid var(--color-brand)',
  background: 'var(--color-brand)',
  color: 'var(--color-text-inverse)',
  fontSize: 12.5,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};

function MiniMetric({ icon, label, value, children }: { icon?: React.ReactNode; label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--color-border-default)', borderRadius: 8, padding: 9, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-text-tertiary)' }}>
        {icon}
        <span style={{ fontSize: 10.5, fontWeight: 650 }}>{label}</span>
      </div>
      {children ? (
        <div style={{ marginTop: 6 }}>{children}</div>
      ) : (
        <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 750, color: 'var(--color-text-primary)' }}>{value}</p>
      )}
    </div>
  );
}

function MiniSectionTitle({ title }: { title: string }) {
  return (
    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 400, color: 'var(--color-text-primary)', fontFamily: 'var(--font-serif, var(--notion-serif))', letterSpacing: '-0.01em' }}>
      {title}
    </h2>
  );
}

function MiniTag({ label, tone }: { label: string; tone: 'green' | 'warm' | 'red' | 'neutral' }) {
  const tones = {
    green: { background: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
    warm: { background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)' },
    red: { background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)' },
    neutral: { background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' },
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
      <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, textAlign: 'right', minWidth: 0 }}>{value}</span>
    </div>
  );
}

// ── Biens database table ────────────────────────────────────────────────────

const TABLE_COLUMNS = '30px minmax(178px, 1.8fr) 92px 82px 108px 82px 240px 86px 88px 96px 74px';

function deriveType(p: Property): string {
  const t = p.title.toLowerCase();
  if (t.includes('appartement') || t.includes('appart') || t.includes('penthouse') || t.includes('duplex') || t.includes('studio') || t.includes('flat')) return 'Appartement';
  if (t.includes('loft')) return 'Loft';
  if (t.includes('villa')) return 'Villa';
  if (t.includes('terrain')) return 'Terrain';
  if (t.includes('immeuble')) return 'Immeuble';
  return 'Maison';
}

function deriveSeller(p: Property): string {
  if (p.fsbo) return 'Particulier';
  if (p.source === 'Biddit') return 'Notaire';
  return 'Agence';
}

function deriveDrop(p: Property): number {
  const h = p.priceHistory ?? [];
  if (h.length < 2) return 0;
  return Math.max(0, h[h.length - 2].price - h[h.length - 1].price);
}

function statusMeta(p: Property): { label: string; bg: string; color: string } {
  const status = p.status ?? (p.reserved ? 'réservé' : 'disponible');
  switch (status) {
    case 'réservé':
      return { label: 'Réservé', bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' };
    case 'archivé':
      return { label: 'Archivé', bg: 'var(--color-bg-hover)', color: 'var(--color-text-tertiary)' };
    default:
      return { label: 'Disponible', bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' };
  }
}

interface BiensTableProps {
  items: Property[];
  selectedId: number | null;
  scoresByProperty: Record<string, ListingScore>;
  signalsByProperty: Record<string, ListingSignal[]>;
  isFavorite: (id: number) => boolean;
  onToggleFavorite: (id: number) => (e: React.MouseEvent) => void;
  onSelect: (id: number) => void;
}

function BiensTable({
  items,
  selectedId,
  scoresByProperty,
  signalsByProperty,
  isFavorite,
  onToggleFavorite,
  onSelect,
}: BiensTableProps) {
  return (
    <div
      className="lv-biens-table-shell"
      style={{
        border: '1px solid var(--color-border-default)',
        borderRadius: 10,
        overflowX: 'auto',
        background: 'var(--color-bg-surface)',
      }}
    >
      <div className="lv-biens-table" style={{ minWidth: 1080 }}>
        {/* Header */}
        <div
          className="lv-biens-table-head"
          style={{
            display: 'grid',
            gridTemplateColumns: TABLE_COLUMNS,
            alignItems: 'center',
            gap: 12,
            padding: '0 16px',
            height: 38,
            borderBottom: '1px solid var(--color-border-default)',
            background: 'var(--color-bg-hover)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0,
            color: 'var(--color-text-secondary)',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
        >
          <span />
          <span>Bien</span>
          <span>Commune</span>
          <span>Type</span>
          <span style={{ textAlign: 'right' }}>Prix actuel</span>
          <span style={{ textAlign: 'right' }}>Baisse</span>
          <span style={{ textAlign: 'center' }}>Score</span>
          <span>Source</span>
          <span>Vendeur</span>
          <span>Statut</span>
          <span style={{ textAlign: 'right' }}>Dernier vu</span>
        </div>

        {/* Rows */}
        {items.map((p) => (
          <BiensTableRow
            key={p.id}
            property={p}
            score={p.supabasePropertyId ? scoresByProperty[p.supabasePropertyId] : undefined}
            liveSignals={p.supabasePropertyId ? signalsByProperty[p.supabasePropertyId] ?? [] : []}
            selected={selectedId === p.id}
            favorite={isFavorite(p.id)}
            onToggleFavorite={onToggleFavorite(p.id)}
            onSelect={() => onSelect(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface BiensTableRowProps {
  property: Property;
  score?: ListingScore;
  liveSignals?: ListingSignal[];
  selected: boolean;
  favorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onSelect: () => void;
}

function BiensTableRow({
  property: p,
  score,
  liveSignals = [],
  selected,
  favorite,
  onToggleFavorite,
  onSelect,
}: BiensTableRowProps) {
  const price = formatEuro(p.price);
  const drop = deriveDrop(p);
  const status = statusMeta(p);
  const mono = 'var(--notion-mono)';

  return (
    <div
      className={`lv-biens-table-row ${selected ? 'is-selected' : ''}`}
      role="row"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLUMNS,
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        minHeight: 72,
        borderBottom: '1px solid var(--color-border-subtle)',
        cursor: 'pointer',
        background: selected ? 'var(--color-bg-hover)' : 'var(--color-bg-surface)',
        boxShadow: selected ? 'inset 3px 0 0 var(--color-brand)' : 'none',
        transition: 'background 0.1s',
        outline: 'none',
      }}
      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)'; }}
      onMouseLeave={(e) => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'; }}
    >
      {/* Favorite */}
      <button
        onClick={onToggleFavorite}
        title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
      >
        <Star size={15} fill={favorite ? 'var(--color-favorite)' : 'none'} color={favorite ? 'var(--color-favorite)' : 'var(--color-border-strong)'} />
      </button>

      {/* Bien (thumbnail + title) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <img
          src={p.photos[0] ?? propertyImageFallbacks(p.id)[0]}
          alt=""
          loading="eager"
          style={{ width: 44, height: 34, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: 'var(--color-bg-hover)' }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.title}
        </span>
      </div>

      {/* Commune */}
      <span style={{ fontSize: 13, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.city}</span>

      {/* Type */}
      <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{deriveType(p)}</span>

      {/* Prix actuel */}
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: mono, textAlign: 'right', whiteSpace: 'nowrap' }}>{price}</span>

      {/* Baisse */}
      <span style={{ textAlign: 'right' }}>
        {drop > 0 ? (
          <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 6, background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', fontSize: 11.5, fontWeight: 600, fontFamily: mono, whiteSpace: 'nowrap' }}>
            −{formatEuro(drop)}
          </span>
        ) : (
          <span style={{ color: 'var(--color-border-strong)', fontSize: 13 }}>—</span>
        )}
      </span>

      {/* Score */}
      <span style={{ display: 'flex', justifyContent: 'flex-start', minWidth: 0, padding: '8px 0' }}>
        <SellerTensionScoreZone
          score={score}
          fallbackScore={p.score}
          signals={liveSignals}
          isInactive={p.reserved || p.status?.startsWith('archiv')}
          size="compact"
        />
      </span>

      {/* Source */}
      <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.source}</span>

      {/* Vendeur */}
      <span style={{ fontSize: 12.5, color: p.fsbo ? 'var(--color-success-text)' : 'var(--color-text-secondary)', fontWeight: p.fsbo ? 600 : 400 }}>{deriveSeller(p)}</span>

      {/* Statut */}
      <span>
        <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: status.bg, color: status.color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {status.label}
        </span>
      </span>

      {/* Dernier vu */}
      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: mono, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {p.publishedDays === 0 ? "auj." : `${p.publishedDays} j`}
      </span>
    </div>
  );
}


