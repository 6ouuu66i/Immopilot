import { supabase } from '../supabase';
import {
  parseDashboardSnapshot,
  type DashboardOpportunity,
  type DashboardSignalItem,
  type DashboardSnapshot,
} from '../dashboardSnapshot';

export {
  parseDashboardSnapshot,
  type DashboardOpportunity,
  type DashboardSignalItem,
  type DashboardSnapshot,
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase n'est pas configure.");
  return supabase;
}

export async function getDashboardSnapshot(limit = 8): Promise<DashboardSnapshot> {
  const client = assertSupabase();
  const { data, error } = await client.rpc('get_dashboard_snapshot', { p_opportunities_limit: limit });
  if (error) throw new Error(error.message);
  return parseDashboardSnapshot(data);
}
