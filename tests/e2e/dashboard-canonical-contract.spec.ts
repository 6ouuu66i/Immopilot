import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Json } from '../../src/lib/database.types';
import {
  dashboardDueTaskTotal,
  selectVisibleDashboardTasks,
} from '../../src/lib/dashboardTasks';
import { parseDashboardSnapshot } from '../../src/lib/dashboardSnapshot';

const rootDir = process.cwd();
const migrationName = '20260715150000_fix_dashboard_canonical_materialized_data.sql';

async function source(relativePath: string): Promise<string> {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8');
}

function zeroSnapshot(): Json {
  return {
    active_listings_count: 0,
    active_properties_count: 0,
    active_signals_count: 0,
    canonical_refreshed_at: null,
    fsbo_count: 0,
    hot_opportunities_count: 0,
    last_listing_seen_at: null,
    last_pipeline_success_at: null,
    last_scores_computed_at: null,
    opportunities: [],
    price_drop_count: 0,
    price_drop_total: 0,
    score_average: 0,
    score_distribution: { faible: 0, forte: 0, surveiller: 0 },
    scored_properties_count: 0,
    signals: [],
  };
}

test('valid zero-valued Dashboard snapshot remains a real zero state', () => {
  const parsed = parseDashboardSnapshot(zeroSnapshot());
  expect(parsed.activePropertiesCount).toBe(0);
  expect(parsed.scoreDistribution).toEqual({ faible: 0, forte: 0, surveiller: 0 });
  expect(parsed.opportunities).toEqual([]);
});

test('incomplete Dashboard RPC payload is rejected instead of becoming credible zero KPIs', () => {
  const malformed = zeroSnapshot() as Record<string, Json | undefined>;
  delete malformed.active_properties_count;
  expect(() => parseDashboardSnapshot(malformed as Json)).toThrow(/active_properties_count/);
});

test('task KPI uses exact counts while its visual list remains limited to five', () => {
  const tasks = Array.from({ length: 7 }, (_, index) => ({
    due_date: `2026-07-15T${String(index).padStart(2, '0')}:00:00.000Z`,
    is_completed: false,
  }));

  expect(selectVisibleDashboardTasks(tasks)).toHaveLength(5);
  expect(dashboardDueTaskTotal({ today: 7, overdue: 2 })).toBe(9);
});

test('canonical migration derives the matview once and protects both client RPCs', async () => {
  const migration = await source(`supabase/migrations/${migrationName}`);

  expect(migration).toContain('SELECT *\nFROM public.active_properties_canonical;');
  expect(migration).toContain('FROM public.active_properties_canonical_mat');
  expect(migration).toContain("SET search_path = ''");
  expect(migration).toContain('profile.is_active = true');
  expect(migration).toContain('profile.agency_id IS NOT NULL');
  expect(migration).toContain('FROM PUBLIC, anon, service_role');
  expect(migration).toContain('TO authenticated');
  expect(migration).toContain("to_jsonb(live) - 'days_online'");
  expect(migration).toContain('LEAST(GREATEST(COALESCE(result_limit, 6), 1), 20)');
});

test('frontend has no direct matview read and uses guarded search RPC', async () => {
  const [palette, searchService] = await Promise.all([
    source('src/components/CommandPalette.tsx'),
    source('src/lib/services/propertySearchService.ts'),
  ]);

  expect(palette).not.toContain(".from('active_properties_canonical_mat')");
  expect(searchService).toContain("client.rpc('search_active_properties'");
});

test('Dashboard labels, strict parser and stale focus refresh match the actual data semantics', async () => {
  const [dashboard, dashboardSnapshot, dashboardHook] = await Promise.all([
    source('src/pages/Dashboard.tsx'),
    source('src/lib/dashboardSnapshot.ts'),
    source('src/lib/useDashboardSnapshot.ts'),
  ]);

  expect(dashboard).not.toContain('score ≥ 70');
  expect(dashboard).not.toContain('Dernière synchro');
  expect(dashboard).toContain('Actualisé quotidiennement');
  expect(dashboard).toContain('biens canoniques actifs');
  expect(dashboard).toContain('Scores calculés');
  expect(dashboard).toContain('Pipeline réussi');
  expect(dashboardSnapshot).toContain('invalidResponse(field)');
  expect(dashboardHook).toContain('staleTime: 5 * 60 * 1000');
  expect(dashboardHook).toContain('refetchOnWindowFocus: true');
  expect(dashboardHook).not.toContain('refetchInterval');
});

test('task service requests exact head counts and mutations invalidate Dashboard data', async () => {
  const [tasksService, tasksHook] = await Promise.all([
    source('src/lib/services/tasksService.ts'),
    source('src/lib/useTasks.ts'),
  ]);

  expect(tasksService.match(/count: 'exact', head: true/g)).toHaveLength(2);
  expect(tasksHook).toContain('queryKeys.dashboardRoot(userId)');
  expect(tasksHook).toContain("['tasks', userId]");
});

test('pipeline computes scores before refreshing the canonical matview', async () => {
  const migration = await source('supabase/migrations/20260712150857_pipeline_observability.sql');
  const scoreStep = migration.indexOf("'compute_listing_scores', 7");
  const refreshStep = migration.indexOf("'refresh_active_properties_canonical', 8");
  expect(scoreStep).toBeGreaterThan(-1);
  expect(refreshStep).toBeGreaterThan(scoreStep);
});
