const PROPERTY_IMAGE_SETS = [
  [
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80',
    'https://images.unsplash.com/photo-1600566753086-00f18fe6ede1?w=900&q=80',
  ],
  [
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&q=80',
    'https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=900&q=80',
    'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=900&q=80',
  ],
  [
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&q=80',
  ],
  [
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=900&q=80',
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=900&q=80',
  ],
  [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=900&q=80',
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&q=80',
  ],
];

function numericSeed(value: string | number): number {
  if (typeof value === 'number') return value;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }
  return Math.abs(hash);
}

export function propertyImageFallbacks(propertyId: string | number): string[] {
  return PROPERTY_IMAGE_SETS[numericSeed(propertyId) % PROPERTY_IMAGE_SETS.length];
}

export function resolvePropertyImages(propertyId: string | number, photos: string[]): string[] {
  return photos.length > 0 ? photos : propertyImageFallbacks(propertyId);
}
