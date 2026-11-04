export function productVariant(name: string) {
  if (/colorado/i.test(name)) return { card: 'border-red-300 bg-red-50', text: 'text-red-800', badge: 'bg-red-100 text-red-800' };
  if (/tradicional/i.test(name)) return { card: 'border-green-300 bg-green-50', text: 'text-green-800', badge: 'bg-green-100 text-green-800' };
  if (/prieto/i.test(name)) return { card: 'border-gray-600 bg-gray-800', text: 'text-white', badge: 'bg-gray-800 text-white' };
  return { card: 'border-border bg-surface', text: 'text-text', badge: '' };
}
