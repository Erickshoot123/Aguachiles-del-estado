export interface DateRange {
  from: Date;
  to: Date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function today(): DateRange {
  return { from: startOfDay(new Date()), to: new Date() };
}

export function yesterday(): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
    to: startOfDay(now),
  };
}

export function lastNDays(days: number): DateRange {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)),
    to: now,
  };
}

export function thisMonth(): DateRange {
  const now = new Date();
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}
