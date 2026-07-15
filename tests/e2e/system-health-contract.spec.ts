import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

test('admin health uses the protected server RPC and exposes distinct operational states', async () => {
  const source = await fs.readFile(path.join(rootDir, 'src', 'pages', 'Admin.tsx'), 'utf8');

  expect(source).toContain("rpc('get_system_health')");
  expect(source).toContain("'healthy' | 'stale' | 'failed' | 'running' | 'disabled' | 'unknown'");
  expect(source).toContain('Ingestion désactivée');
  expect(source).toContain('Accès ou lecture impossible');
  expect(source).toContain('setHealth(null)');
  expect(source).not.toMatch(/mock.*health|health.*mock/i);
});

test('health failure is rendered as an error and never converted to a healthy fallback', async () => {
  const source = await fs.readFile(path.join(rootDir, 'src', 'pages', 'Admin.tsx'), 'utf8');
  const healthRequestStart = source.indexOf("void client.rpc('get_system_health')");
  const catchBlock = source.slice(healthRequestStart, source.indexOf('useEffect(refresh', healthRequestStart));

  expect(catchBlock).toContain('setHealth(null)');
  expect(catchBlock).toContain('setError(');
  expect(catchBlock).not.toContain("global_status: 'healthy'");
  expect(source).not.toMatch(/fetch\(|axios|notify_scan_complete|sync_daily_pipeline\(\)/);
});
