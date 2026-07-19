import pg from 'pg';

/* PostgreSQL-backed store with the same interface as JsonStore (init/read/write/transaction).
   The whole app state lives in one JSONB row guarded by a row lock, so the demo data model
   is unchanged while durability moves to RDS. DATABASE_URL selects this store. */
export class PgStore {
  constructor(databaseUrl, seedFactory) {
    const local = /localhost|127\.0\.0\.1/.test(databaseUrl);
    this.pool = new pg.Pool({
      connectionString: databaseUrl,
      max: Number(process.env.PGPOOL_MAX || 5),
      ssl: local || process.env.PGSSL === 'disable' ? undefined : { rejectUnauthorized: false },
    });
    this.seedFactory = seedFactory;
  }

  async init(retries = 30, delayMs = 2000) {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        await this.pool.query(
          'CREATE TABLE IF NOT EXISTS app_state (id integer PRIMARY KEY CHECK (id = 1), doc jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())'
        );
        await this.pool.query(
          'INSERT INTO app_state (id, doc) VALUES (1, $1) ON CONFLICT (id) DO NOTHING',
          [JSON.stringify(this.seedFactory())]
        );
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error(`PostgreSQL never became ready: ${lastError?.message}`);
  }

  async read() {
    const { rows } = await this.pool.query('SELECT doc FROM app_state WHERE id = 1');
    return rows[0].doc;
  }

  async write(data) {
    await this.pool.query('UPDATE app_state SET doc = $1, updated_at = now() WHERE id = 1', [
      JSON.stringify(data),
    ]);
  }

  async transaction(update) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT doc FROM app_state WHERE id = 1 FOR UPDATE');
      const data = rows[0].doc;
      const result = await update(data);
      await client.query('UPDATE app_state SET doc = $1, updated_at = now() WHERE id = 1', [
        JSON.stringify(data),
      ]);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
