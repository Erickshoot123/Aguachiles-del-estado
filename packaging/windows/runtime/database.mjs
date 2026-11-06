import { mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { run } from './processes.mjs';

export class LocalDatabase {
  constructor(appDir, config) {
    this.config = config;
    this.bin = join(appDir, 'postgres', 'bin');
    this.data = join(config.root, 'data', 'postgres');
    this.logs = join(config.root, 'data', 'logs');
    this.env = { ...process.env, PGPASSWORD: config.dbPassword, PGCLIENTENCODING: 'UTF8' };
  }
  command(name, args, options = {}) { return run(join(this.bin, `${name}.exe`), args, { env: this.env, ignoreOutput: name === 'pg_ctl', ...options }); }
  connectionArgs() { return ['-h', '127.0.0.1', '-p', String(this.config.dbPort), '-U', 'aguachiles_admin']; }
  async sql(query, database = 'postgres') {
    return (await this.command('psql', [...this.connectionArgs(), '-d', database, '-X', '-At', '-v', 'ON_ERROR_STOP=1'], { input: query })).output.trim();
  }
  async start() {
    await mkdir(this.data, { recursive: true });
    await mkdir(this.logs, { recursive: true });
    const version = await readFile(join(this.data, 'PG_VERSION'), 'utf8').catch(() => null);
    if (!version) {
      if ((await readdir(this.data)).length) throw new Error('La carpeta de base de datos contiene una instalación incompleta. Conserva los archivos y solicita revisión.');
      const passwordFile = join(this.config.root, 'data', `.pg-password-${randomUUID()}`);
      await writeFile(passwordFile, this.config.dbPassword, { mode: 0o600 });
      try { await this.command('initdb', ['-D', this.data, '-U', 'aguachiles_admin', '--encoding=UTF8', '--locale=C',
        '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', `--pwfile=${passwordFile}`]); }
      finally { await unlink(passwordFile).catch(() => {}); }
    } else if (version.trim() !== '16') throw new Error('La base existente requiere otra versión mayor de PostgreSQL. No se modificó.');
    const status = await this.command('pg_ctl', ['status', '-D', this.data], { allowFailure: true });
    if (status.code !== 0) {
      const occupied = await new Promise((resolve) => {
        const socket = createConnection({ host: '127.0.0.1', port: this.config.dbPort });
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('error', () => resolve(false));
      });
      if (occupied) throw new Error(`El puerto ${this.config.dbPort} está ocupado por otra base. No se detuvo ese proceso.`);
      await this.command('pg_ctl', ['start', '-D', this.data, '-l', join(this.logs, 'postgres.log'), '-w', '-t', '60',
        '-o', `-h 127.0.0.1 -p ${this.config.dbPort} -c timezone=UTC -c jit=off`]);
    }
    const actual = await this.sql('SHOW data_directory;');
    if (actual.replaceAll('\\', '/').toLowerCase() !== this.data.replaceAll('\\', '/').toLowerCase()) {
      throw new Error('El puerto corresponde a otra base de datos. No se utilizará.');
    }
    if (!await this.sql("SELECT 1 FROM pg_database WHERE datname='aguachiles_pos';")) {
      await this.command('createdb', [...this.connectionArgs(), 'aguachiles_pos']);
    }
  }
  async grantAppAccess() {
    // Las contraseñas generadas son hexadecimales; no proceden de texto escrito por el usuario.
    if (!/^[a-f0-9]{64}$/.test(this.config.appPassword)) throw new Error('Credencial interna inválida');
    const exists = await this.sql("SELECT 1 FROM pg_roles WHERE rolname='aguachiles_app';");
    await this.sql(`${exists ? 'ALTER' : 'CREATE'} ROLE aguachiles_app LOGIN PASSWORD '${this.config.appPassword}';`);
    await this.sql('GRANT CONNECT ON DATABASE aguachiles_pos TO aguachiles_app;');
    await this.sql('GRANT USAGE ON SCHEMA public TO aguachiles_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aguachiles_app; GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO aguachiles_app;', 'aguachiles_pos');
  }
  async backup(label = 'manual') {
    const folder = join(this.config.root, 'data', 'backups');
    await mkdir(folder, { recursive: true });
    const path = join(folder, `${new Date().toISOString().replaceAll(':', '-')}-${label}.dump`);
    await this.command('pg_dump', [...this.connectionArgs(), '-d', 'aguachiles_pos', '-Fc', '-f', path]);
    return path;
  }
  async stop() { await this.command('pg_ctl', ['stop', '-D', this.data, '-m', 'fast', '-w', '-t', '30'], { allowFailure: true }); }
  url(admin = false) {
    const user = admin ? 'aguachiles_admin' : 'aguachiles_app';
    const password = admin ? this.config.dbPassword : this.config.appPassword;
    return `postgresql://${user}:${password}@127.0.0.1:${this.config.dbPort}/aguachiles_pos`;
  }
}
