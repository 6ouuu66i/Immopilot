import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

test('Biens property images use lazy loading below the fold with async decoding', async () => {
  const propertyCardSource = await fs.readFile(path.join(rootDir, 'src/components/biens/PropertyCard.tsx'), 'utf8');
  const biensSource = await fs.readFile(path.join(rootDir, 'src/pages/Biens.tsx'), 'utf8');
  const deferredImageSource = await fs.readFile(path.join(rootDir, 'src/components/ui/DeferredImage.tsx'), 'utf8');

  expect(propertyCardSource).toContain('priorityImage?: boolean;');
  expect(propertyCardSource).toContain('<DeferredImage');
  expect(propertyCardSource).toContain('decoding="async"');

  expect(biensSource).toContain('priorityImage={index === 0}');
  expect(biensSource).toContain('<DeferredImage');
  expect(biensSource).toContain('decoding="async"');
  expect(biensSource).toContain('loading="lazy"');

  expect(deferredImageSource).toContain('IntersectionObserver');
  expect(deferredImageSource).toContain('rootMargin');
  expect(deferredImageSource).toContain('loading={loading}');
});
