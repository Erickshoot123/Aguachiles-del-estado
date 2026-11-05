import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { githubRequest, limitedBytes } from './http.mjs';
import { assetUrl, validateChannel, verifyManifest } from './manifest.mjs';
import { newerThanInstalled, stableVersion } from './version.mjs';
import { downloadVerified, fileHash } from './download.mjs';

export class UpdateManager {
  constructor({
    root,
    appDir,
    installedVersion,
    request = githubRequest,
    downloader = downloadVerified,
    prepareInstall,
  }) {
    Object.assign(this, { root, appDir, installedVersion, request, downloader, prepareInstall });
    this.request = (url, fetcher, timeout) =>
      request(url, fetcher, timeout, this.abortController?.signal);
    this.state = {
      phase: 'idle',
      installedVersion,
      availableVersion: null,
      releaseNotes: '',
      bytes: 0,
      progress: 0,
      message: '',
      checkedAt: null,
    };
  }
  async initialize() {
    try {
      this.channel = validateChannel(
        JSON.parse(await readFile(join(this.appDir, 'update-channel.json'), 'utf8')),
      );
    } catch {
      this.channel = null;
      this.state = {
        ...this.state,
        phase: 'unconfigured',
        message:
          'No se pudo validar la configuración de actualizaciones. El POS puede seguir operando; revisa el canal de distribución.',
      };
      return;
    }
    if (!this.channel) {
      this.state = {
        ...this.state,
        phase: 'unconfigured',
        message: 'El canal de actualizaciones todavía no está configurado en esta instalación.',
      };
      return;
    }
    // Recuperar un paquete ya descargado no consulta Internet ni lo instala.
    try {
      const cached = await readFile(join(this.root, 'updates', 'ready.json'), 'utf8');
      if (cached.length > 100000) throw new Error('Caché demasiado grande');
      const plan = JSON.parse(cached),
        bytes = Buffer.from(plan.manifest, 'base64'),
        signature = Buffer.from(plan.signature, 'base64');
      const manifest = verifyManifest(bytes, signature, this.channel);
      if (newerThanInstalled(manifest.version, this.installedVersion)) {
        this.candidate = { bytes, signature, manifest };
        if ((await stat(this.destination())).size !== manifest.size)
          throw new Error('El paquete está incompleto');
        this.state = {
          ...this.state,
          phase: 'ready',
          availableVersion: manifest.version,
          releaseNotes: manifest.releaseNotes,
          bytes: manifest.size,
          progress: 100,
          message:
            'Hay una descarga guardada. Se verificará de nuevo antes de instalar; no necesitas descargarla otra vez.',
        };
      }
    } catch (error) {
      if (error.code !== 'ENOENT')
        this.state = {
          ...this.state,
          phase: 'error',
          message:
            'No se pudo recuperar la descarga anterior. Busca nuevamente las actualizaciones.',
        };
    }
  }
  status() {
    return { ...this.state };
  }
  action(action) {
    if (action === 'status') return this.status();
    if (!this.channel) throw new Error('El canal de actualizaciones todavía no está configurado.');
    if (['checking', 'downloading', 'installing'].includes(this.state.phase))
      throw new Error('Ya hay una operación de actualización en curso.');
    if (action === 'check') this.run('checking', () => this.check());
    else if (action === 'download') {
      if (!this.candidate || !['available', 'ready', 'error'].includes(this.state.phase))
        throw new Error('Primero busca una actualización disponible.');
      this.run('downloading', () => this.download());
    } else if (action === 'install') {
      if (this.state.phase !== 'ready')
        throw new Error('Primero descarga y verifica la actualización.');
      // El estado cambia inmediatamente; la API mantiene el bloqueo de operación hasta reiniciar.
      this.run('installing', () => this.install());
    } else throw new Error('Acción de actualización desconocida.');
    return this.status();
  }
  run(phase, task) {
    this.abortController = new globalThis.AbortController();
    this.state = { ...this.state, phase, message: '', progress: 0 };
    this.pending = Promise.resolve()
      .then(task)
      .catch((error) => {
        this.state = {
          ...this.state,
          phase: 'error',
          message: error.message.includes('fetch')
            ? 'No se pudo contactar GitHub. Revisa la conexión e inténtalo nuevamente.'
            : error.message,
        };
      });
  }
  async close() {
    this.abortController?.abort();
    await this.pending;
  }
  async check() {
    this.candidate = null;
    this.state = { ...this.state, availableVersion: null, releaseNotes: '', bytes: 0 };
    const response = await this.request(
      `https://api.github.com/repos/${this.channel.repository}/releases/latest`,
    );
    if (response.status === 404) {
      this.state = {
        ...this.state,
        phase: 'current',
        checkedAt: new Date().toISOString(),
        message: 'No hay una versión estable pública disponible en este canal.',
      };
      return;
    }
    const release = JSON.parse((await limitedBytes(response, 1048576)).toString('utf8'));
    if (
      release.draft ||
      release.prerelease ||
      typeof release.tag_name !== 'string' ||
      !release.tag_name.startsWith('v')
    )
      throw new Error('GitHub no devolvió una versión estable válida.');
    const version = stableVersion(release.tag_name.slice(1));
    if (!newerThanInstalled(version, this.installedVersion)) {
      this.state = {
        ...this.state,
        phase: 'current',
        checkedAt: new Date().toISOString(),
        message: 'Esta instalación ya está actualizada.',
      };
      return;
    }
    const bytes = await limitedBytes(
      await this.request(assetUrl(this.channel, version, 'update-manifest.json')),
      65536,
    );
    const signature = await limitedBytes(
      await this.request(assetUrl(this.channel, version, 'update-manifest.sig')),
      2048,
    );
    const manifest = verifyManifest(bytes, signature, this.channel);
    if (manifest.version !== version)
      throw new Error('La versión publicada no coincide con el manifiesto firmado.');
    this.candidate = { bytes, signature, manifest };
    this.state = {
      ...this.state,
      phase: 'available',
      availableVersion: version,
      releaseNotes: manifest.releaseNotes,
      bytes: manifest.size,
      checkedAt: new Date().toISOString(),
    };
  }
  destination() {
    return join(
      this.root,
      'updates',
      this.candidate.manifest.version,
      this.candidate.manifest.asset,
    );
  }
  async download() {
    const { manifest } = this.candidate;
    await this.downloader(
      assetUrl(this.channel, manifest.version, manifest.asset),
      this.destination(),
      manifest,
      (progress) => {
        this.state.progress = progress;
      },
      this.request,
    );
    const marker = join(this.root, 'updates', 'ready.json');
    const pending = marker + '.' + randomUUID() + '.tmp';
    await writeFile(
      pending,
      JSON.stringify({
        manifest: this.candidate.bytes.toString('base64'),
        signature: this.candidate.signature.toString('base64'),
      }),
      { flag: 'wx' },
    );
    await rename(pending, marker);
    this.state = {
      ...this.state,
      phase: 'ready',
      progress: 100,
      message: 'Descarga verificada. Puedes instalar cuando cierres caja y termines la operación.',
    };
  }
  async install() {
    const { bytes, signature, manifest } = this.candidate;
    verifyManifest(bytes, signature, this.channel);
    if (
      !newerThanInstalled(manifest.version, this.installedVersion) ||
      (await stat(this.destination())).size !== manifest.size ||
      (await fileHash(this.destination())) !== manifest.sha256
    )
      throw new Error(
        'El paquete descargado cambió. Busca y descarga nuevamente la actualización.',
      );
    const folder = join(this.root, 'updates');
    await mkdir(folder, { recursive: true });
    const plan = join(folder, 'install-plan.json');
    await writeFile(
      plan,
      JSON.stringify({
        manifest: bytes.toString('base64'),
        signature: signature.toString('base64'),
      }),
    );
    await this.prepareInstall(plan);
  }
}
