import {
  ApiClient,
  FitbitProvider,
  OuraProvider,
  WhoopProvider,
  ProviderError,
  dateLabel,
  parseAppleZip,
  parseNightCsv,
} from '@distill/providers';
import type { OAuthProviderId, Provider } from '@distill/providers';
import { TokenCipher, exchange, tokenSchema } from '@distill/providers/server';
import type { OAuthConfig } from '@distill/providers/server';
import { rawCollector } from '@distill/data';
import type { Connection, ImportJob, Repository } from '@distill/data';

export const HISTORY_FLOOR = '1970-01-01';
/** Backfill never stops on an empty month; gaps and old history must remain discoverable. */
export function syncWindow(
  connection: Pick<Connection, 'lastSyncedAt' | 'backfillBefore' | 'provider'>,
  now: Date,
) {
  const tomorrow = new Date(+new Date(dateLabel(now)) + 86400000);
  const fresh = !connection.lastSyncedAt || +now - +connection.lastSyncedAt >= 86400000;
  if (fresh || !connection.backfillBefore)
    return {
      from: new Date(+tomorrow - 8 * 86400000),
      to: tomorrow,
      mode: 'daily' as const,
    };
  const to = new Date(connection.backfillBefore);
  return {
    from: new Date(
      Math.max(
        +new Date(HISTORY_FLOOR),
        +to - (connection.provider === 'fitbit' ? 30 : 365) * 86400000,
      ),
    ),
    to,
    mode: 'backfill' as const,
  };
}
export interface WorkerDependencies {
  repo: Repository;
  cipher: TokenCipher;
  oauth: (id: OAuthProviderId) => OAuthConfig;
  download: (path: string) => Promise<AsyncIterable<Uint8Array>>;
  fetcher?: typeof fetch;
  now?: () => Date;
}
export class Worker {
  constructor(private deps: WorkerDependencies) {}
  private now() {
    return this.deps.now?.() ?? new Date();
  }
  async sync(row: Connection) {
    const { repo, cipher, oauth } = this.deps;
    try {
      let tokens = tokenSchema.parse(
        cipher.open(row.tokenEnvelope, `${row.userId}:${row.provider}`),
      );
      const config = oauth(row.provider);
      const access = async () => {
        if (tokens.expiresAt <= +this.now() + 60000) {
          tokens = await exchange(
            config,
            { refreshToken: tokens.refreshToken, scopes: tokens.scopes },
            this.deps.fetcher,
            +this.now(),
          );
          await repo.saveTokens(row, cipher.seal(tokens, `${row.userId}:${row.provider}`));
        }
        return tokens.accessToken;
      };
      const raw = rawCollector(row.userId, row.provider);
      const base =
        row.provider === 'oura'
          ? 'https://api.ouraring.com'
          : row.provider === 'whoop'
            ? 'https://api.prod.whoop.com'
            : 'https://api.fitbit.com';
      const api = new ApiClient(base, access, this.deps.fetcher);
      const provider: Provider =
        row.provider === 'oura'
          ? new OuraProvider(api, raw.write, row.userId, tokens.scopes)
          : row.provider === 'whoop'
            ? new WhoopProvider(api, raw.write, row.userId)
            : new FitbitProvider(api, raw.write, row.userId, config.legacyFitbitEnabled, () =>
                this.now(),
              );
      const window = syncWindow(row, this.now());
      // Sequential requests ensure rotating refresh tokens cannot race within a lease.
      const nights = await provider.fetchNights(row.userId, window.from, window.to);
      const workouts = await provider.fetchWorkouts(row.userId, window.from, window.to);
      const tags = (await provider.fetchTags?.(row.userId, window.from, window.to)) ?? [];
      const backfillBefore =
        window.mode === 'backfill'
          ? dateLabel(window.from) <= HISTORY_FLOOR
            ? null
            : dateLabel(window.from)
          : row.backfillBefore;
      await repo.finishConnection(row, { nights, workouts, tags }, raw.rows.values(), {
        backfillBefore,
        lastSyncedAt: window.mode === 'daily' ? this.now() : row.lastSyncedAt,
        nextSyncAt: backfillBefore ? this.now() : new Date(+this.now() + 86400000),
      });
    } catch (error) {
      const e = error instanceof ProviderError ? error : new ProviderError('sync_failed');
      await repo.failConnection(
        row,
        e.code,
        new Date(+this.now() + Math.max(e.retryAfterSeconds, 60) * 1000),
        [400, 401, 403].includes(e.status) || e.code === 'fitbit_migration_required',
      );
    }
  }
  async import(row: ImportJob) {
    try {
      const raw = rawCollector(row.userId, row.source),
        stream = await this.deps.download(row.path);
      const data =
        row.source === 'apple_export'
          ? await parseAppleZip(stream, { sourceName: row.sourceName ?? '' }, raw.write)
          : await parseNightCsv(stream, raw.write);
      await this.deps.repo.finishImport(row, data, raw.rows.values());
    } catch {
      await this.deps.repo.failImport(row);
    }
  }
  async run(userId?: string, budgetMs = 240000) {
    const start = Date.now();
    let units = 0;
    // A durable lease survives termination; another invocation resumes after expiration.
    do {
      const upload = await this.deps.repo.claimImport(this.now(), userId);
      if (upload) {
        await this.import(upload);
        units++;
      }
      const connection = await this.deps.repo.claimConnection(this.now(), userId);
      if (connection) {
        await this.sync(connection);
        units++;
      }
      if (!upload && !connection) break;
    } while (Date.now() - start < budgetMs);
    await this.deps.repo.pruneStates(this.now());
    return { units };
  }
}
