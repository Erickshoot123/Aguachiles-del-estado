export function productVariant(name: string) {
  if (/colorado/i.test(name))
    return {
      card: 'border-[#eac0bc] bg-[#fbe4e1]',
      text: 'text-[#742b31]',
      badge: 'bg-[#fbe4e1] text-[#742b31]',
    };
  if (/tradicional/i.test(name))
    return {
      card: 'border-[#bacfbc] bg-[#e1efe1]',
      text: 'text-[#284e39]',
      badge: 'bg-[#e1efe1] text-[#284e39]',
    };
  if (/prieto/i.test(name))
    return {
      card: 'border-[#c4c8d6] bg-[#e8eaf2]',
      text: 'text-[#343e58]',
      badge: 'bg-[#e8eaf2] text-[#343e58]',
    };
  return { card: 'border-border bg-surface', text: 'text-text', badge: '' };
}
