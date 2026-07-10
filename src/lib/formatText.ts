// Les annonces Immoweb arrivent souvent EN MAJUSCULES CRIARDES. On ne
// transforme que les chaînes majoritairement en capitales (>60 % des lettres),
// pour ne jamais abîmer un texte déjà bien casé.

const UPPER_RATIO_THRESHOLD = 0.6;

function isShouty(input: string): boolean {
  const letters = input.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length < 4) return false;
  const uppercase = letters.replace(/[^A-ZÀ-Þ]/g, '');
  return uppercase.length / letters.length >= UPPER_RATIO_THRESHOLD;
}

/** Casse de phrase pour les titres d'annonces : « APPT 2CH RENOVE » → « Appt 2ch renove ». */
export function sentenceCaseIfShouty(input: string): string {
  if (!isShouty(input)) return input;
  const lowered = input.toLocaleLowerCase('fr-BE');
  return lowered.charAt(0).toLocaleUpperCase('fr-BE') + lowered.slice(1);
}

/** Casse de titre pour les localités : « MOLENBEEK-SAINT-JEAN » → « Molenbeek-Saint-Jean ». */
export function titleCaseIfShouty(input: string): string {
  if (!isShouty(input)) return input;
  return input
    .toLocaleLowerCase('fr-BE')
    .replace(/(^|[\s\-–—'’(«/])(\p{L})/gu, (_match, separator: string, letter: string) =>
      separator + letter.toLocaleUpperCase('fr-BE'));
}
