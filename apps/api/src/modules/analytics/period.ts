export function localMidnight(day: string, zone: string): Date {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const target = Date.UTC(year, month - 1, date);
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let instant = target;
  for (let step = 0; step < 3; step++) {
    const values = Object.fromEntries(
      format.formatToParts(new Date(instant)).map((part) => [part.type, Number(part.value)]),
    );
    const represented = Date.UTC(
      values.year!,
      values.month! - 1,
      values.day!,
      values.hour!,
      values.minute!,
      values.second!,
    );
    instant = target - (represented - instant);
  }
  return new Date(instant);
}
export function nextDay(day: string): string {
  return new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
}
