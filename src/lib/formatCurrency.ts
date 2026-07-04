const euroFormatter = new Intl.NumberFormat('fr-BE', {
  maximumFractionDigits: 0,
});

export function formatEuro(value: number): string {
  return `${euroFormatter.format(value).replace(/[\u00A0\u202F]/g, ' ')} €`;
}
