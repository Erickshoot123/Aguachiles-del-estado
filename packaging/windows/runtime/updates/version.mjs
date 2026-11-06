export const UPDATER_VERSION = '1.0.0';
export function stableVersion(value) {
  if (
    typeof value !== 'string' ||
    !/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value)
  )
    throw new Error('La versión debe tener el formato 0.2.7, sin prefijos ni sufijos.');
  return value;
}
export function compareVersions(left, right) {
  const a = stableVersion(left).split('.').map(Number),
    b = stableVersion(right).split('.').map(Number);
  for (let index = 0; index < 3; index++)
    if (a[index] !== b[index]) return Math.sign(a[index] - b[index]);
  return 0;
}
export function newerThanInstalled(version, installed) {
  const match = /^(\d+\.\d+\.\d+)(-preview-\d+)?$/.exec(installed);
  if (!match)
    throw new Error('La versión instalada no es reconocible. Actualiza con el instalador manual.');
  const difference = compareVersions(version, match[1]);
  return difference > 0 || (difference === 0 && Boolean(match[2]));
}
