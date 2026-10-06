'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { env } from '../../../../lib/env';
import { supabaseBrowser } from '../../../../lib/supabase/client';
import { useProgress } from '../../../../lib/progress/context';

export function ImportForm() {
  const router = useRouter();
  const { progress, update, saveNow, store } = useProgress();
  const [source, setSource] = useState<'csv' | 'apple_export'>('csv');
  const [sourceName, setSourceName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const token = (await supabaseBrowser()?.auth.getSession())?.data.session?.access_token;
      if (!token || store.id !== 'supabase') throw new Error('Sign in before importing data.');
      if (file.size > (source === 'csv' ? 20 : 256) * 1024 * 1024)
        throw new Error('This file exceeds the import size limit.');
      const next = {
        ...progress,
        dataSource: source,
        connectedAt: new Date().toISOString(),
        backfill: { nights: 0, done: false },
      };
      await saveNow(next);
      update(next);
      const created = await api<{ id: string; uploadUrl: string }>('/api/imports', {
        method: 'POST',
        body: JSON.stringify({
          source,
          ...(source === 'apple_export' ? { sourceName: sourceName.trim() } : {}),
        }),
      });
      const res = await fetch(created.uploadUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: env.supabaseAnonKey,
          'content-type': source === 'csv' ? 'text/csv' : 'application/zip',
          'x-upsert': 'false',
        },
        body: file,
      });
      if (!res.ok) throw new Error('The upload failed. Please retry with the same file.');
      await api(`/api/imports/${created.id}/complete`, { method: 'POST', body: '{}' });
      setJob(created.id);
      setMessage('Your file is queued. Check its status before continuing.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    setBusy(true);
    try {
      const status = await api<{
        imports: { id: string; status: string; errorCode: string | null }[];
      }>('/api/providers');
      const current = status.imports.find((i) => i.id === job);
      if (current?.status === 'done') {
        const next = {
          ...progress,
          dataSource: source,
          step: 'stack' as const,
          backfill: { nights: 0, done: true },
        };
        await saveNow(next);
        update(next);
        router.push('/stack');
      } else
        setMessage(
          current?.status === 'failed'
            ? 'The file could not be read. Check its format and try uploading again.'
            : `Import status: ${current?.status ?? 'unavailable'}. Check again shortly.`,
        );
    } catch {
      setMessage('Import status could not be loaded. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack">
      <h1>Import your nights</h1>
      <label>
        File format{' '}
        <select
          value={source}
          disabled={Boolean(job)}
          onChange={(e) => setSource(e.target.value as 'csv' | 'apple_export')}
        >
          <option value="csv">CSV nights</option>
          <option value="apple_export">Apple Health ZIP</option>
        </select>
      </label>
      <p>
        CSV files need a sleepDate column (YYYY-MM-DD). Optional columns include totalSleepMinutes,
        sleepLatencyMinutes, overnightHrvMs and restingHeartRateBpm. HRV requires hrvMethod (rmssd
        or sdnn). Empty measurements remain missing.
      </p>
      {source === 'apple_export' ? (
        <Field
          label="Exact device sourceName from your Apple Health export"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
        />
      ) : null}
      <input
        aria-label="Sleep data file"
        type="file"
        accept={source === 'csv' ? '.csv' : '.zip'}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <Button
        disabled={busy || !file || (source === 'apple_export' && !sourceName.trim())}
        onClick={() => void upload()}
      >
        Upload and import
      </Button>
      {job ? (
        <Button variant="ghost" disabled={busy} onClick={() => void check()}>
          Check import and continue
        </Button>
      ) : null}
      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
