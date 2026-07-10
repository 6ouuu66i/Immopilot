import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

test('property card carousel uses the rendered photo set and never selects the card', async () => {
  const propertyCardSource = await fs.readFile(path.join(rootDir, 'src/components/biens/PropertyCard.tsx'), 'utf8');
  const biensSource = await fs.readFile(path.join(rootDir, 'src/pages/Biens.tsx'), 'utf8');
  const imageSource = await fs.readFile(path.join(rootDir, 'src/lib/propertyImageFallbacks.ts'), 'utf8');
  const navSource = await fs.readFile(path.join(rootDir, 'src/components/ui/CarouselNavButton.tsx'), 'utf8');
  const cssSource = await fs.readFile(path.join(rootDir, 'src/index.css'), 'utf8');
  const articleStart = propertyCardSource.indexOf('<article');
  const articleOpening = propertyCardSource.slice(articleStart, propertyCardSource.indexOf('>', articleStart));

  expect(imageSource).toContain('export function resolvePropertyImages');
  expect(propertyCardSource).toContain('resolvePropertyImages(property.id, property.photos)');
  expect(biensSource).toContain('resolvePropertyImages(prop.id, prop.photos).length');

  expect(articleOpening).not.toContain('onClick=');
  expect(propertyCardSource).toContain('className="lv-property-card-photo-button"');
  expect(propertyCardSource).toContain('onClick={onSelect}');
  expect(propertyCardSource).toContain("closest('button, a, [data-card-interactive]')");
  expect(propertyCardSource).toContain('onPointerDown={(event) => event.stopPropagation()}');
  expect(navSource).toContain("className={`lv-photo-nav${persistent ? ' lv-photo-nav--persistent' : ''}`}");
  expect(navSource).toContain('event.preventDefault()');
  expect(navSource).toContain('event.stopPropagation()');
  expect(biensSource.match(/<CarouselNavButton direction="previous" persistent/g)).toHaveLength(3);
  expect(biensSource.match(/<CarouselNavButton direction="next" persistent/g)).toHaveLength(3);
  expect(biensSource.match(/setPhotoIndex\(\(currentIndex\)/g)).toHaveLength(3);
  expect(biensSource).not.toContain('galleryButtonStyle(');
  expect(biensSource).not.toContain('dossierGalleryButtonStyle(');
  expect(propertyCardSource).toContain('className="lv-property-card-photo"');
  expect(cssSource).toContain('@keyframes ip-property-card-photo-in');
  expect(cssSource).toContain('.lv-property-card-photo-button {');
  expect(cssSource).toContain('top: 0;\n  bottom: 0;');
  expect(cssSource).toContain('transform: none !important;');
  expect(cssSource).not.toContain('.lv-photo-nav:active > span {\n  transform:');
});
