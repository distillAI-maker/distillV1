import { z } from 'zod';

export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 502,
    public readonly retryAfterSeconds = 60,
  ) {
    super(code);
    this.name = 'ProviderError';
  }
}
export type Fetch = typeof globalThis.fetch;
export type Json = Record<string, unknown>;
export const object = (value: unknown): Json => z.record(z.string(), z.unknown()).parse(value);
export const objects = (value: unknown): Json[] =>
  z.array(z.record(z.string(), z.unknown())).parse(value);
export const string = (value: unknown): string => z.string().parse(value);
export const number = (value: unknown): number | null =>
  value == null ? null : z.number().finite().parse(value);
export const minutes = (value: unknown, unitsPerMinute: number): number | null => {
  const n = number(value);
  return n === null ? null : n / unitsPerMinute;
};
export class ApiClient {
  constructor(
    private readonly base: string,
    private readonly token: () => Promise<string>,
    private readonly fetcher: Fetch = fetch,
  ) {}
  async get(path: string, params: Record<string, string> = {}): Promise<Json> {
    const url = new URL(path, this.base);
    if (url.origin !== new URL(this.base).origin) throw new ProviderError('unsafe_provider_url');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const response = await this.fetcher(url, {
      headers: { Authorization: `Bearer ${await this.token()}` },
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    if (!response.ok) {
      const retry = Number(response.headers.get('retry-after'));
      throw new ProviderError(
        response.status === 401
          ? 'reconnect_required'
          : response.status === 403
            ? 'scope_required'
            : 'provider_request_failed',
        response.status,
        Number.isFinite(retry) && retry > 0 ? Math.min(retry, 86400) : 60,
      );
    }
    return object(await response.json());
  }
  async pages(
    path: string,
    params: Record<string, string>,
    arrayKey: string,
    tokenParam: string,
  ): Promise<Json[]> {
    const rows: Json[] = [];
    const seen = new Set<string>();
    let token: string | undefined;
    do {
      const page = await this.get(path, { ...params, ...(token ? { [tokenParam]: token } : {}) });
      rows.push(...objects(page[arrayKey]));
      token =
        page.next_token == null || page.next_token === '' ? undefined : string(page.next_token);
      if (token && seen.has(token)) throw new ProviderError('pagination_loop');
      if (token) seen.add(token);
      if (seen.size > 10000) throw new ProviderError('pagination_limit');
    } while (token);
    return rows;
  }
}
