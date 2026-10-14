'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Skeleton } from '../../../../components/ui';
import { copy } from '../../../../lib/copy';
import { useProgress } from '../../../../lib/progress/context';
import { track } from '../../../../lib/track';
import {
  newItemId,
  pictureKindSchema,
  type PictureKind,
  type PictureLine,
  type Progress,
} from '../../../../lib/progress/types';
import s from '../home.module.css';

type Picture = NonNullable<Progress['picture']>;

/**
 * What we've learned about you: the picture Claude keeps from their words, in four parts. It is
 * theirs: any line can be changed (it then stays in their words), deleted (and never comes back),
 * or added.
 */
export function YouView() {
  const { ready, progress, update } = useProgress();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  if (!ready)
    return (
      <section className={s.page} aria-busy="true">
        <Skeleton kind="title" count={2} />
      </section>
    );

  const lines = progress.picture?.lines ?? [];
  const change = (fn: (picture: Picture) => Picture) =>
    update((p) => ({
      ...p,
      picture: {
        ...fn(p.picture ?? { lines: [], removed: [], updatedAt: '' }),
        updatedAt: new Date().toISOString(),
      },
    }));
  const forget = (picture: Picture, text: string) =>
    [...picture.removed.filter((r) => r !== text), text].slice(-100);

  function open(key: string, text = '') {
    setEditing(key);
    setDraft(text);
  }
  function close() {
    setEditing(null);
    setDraft('');
  }
  function save(kind: PictureKind, line?: PictureLine) {
    const text = draft.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!text) return;
    const at = new Date().toISOString();
    // What people change in the picture is how we learn where Claude reads them wrong.
    track('picture_changed', { action: line ? (line.by === 'distill' ? 'edit' : 'reedit') : 'add', kind });
    change((picture) =>
      line
        ? {
            ...picture,
            lines: picture.lines.map((l) => (l.id === line.id ? { ...l, text, by: 'you', at } : l)),
            // What we wrote before their edit is not offered again.
            removed: line.text === text ? picture.removed : forget(picture, line.text),
          }
        : { ...picture, lines: [...picture.lines, { id: newItemId(), kind, text, by: 'you', at }] },
    );
    close();
  }
  function remove(line: PictureLine) {
    track('picture_changed', { action: 'delete', kind: line.kind, by: line.by });
    change((picture) => ({
      ...picture,
      lines: picture.lines.filter((l) => l.id !== line.id),
      removed: forget(picture, line.text),
    }));
  }

  const editor = (kind: PictureKind, line?: PictureLine) => (
    <div className={s.lineEdit}>
      <textarea
        aria-label={line ? copy.you.edit : copy.you.addLabel(copy.you.parts[kind])}
        rows={2}
        maxLength={200}
        value={draft}
        autoFocus
        placeholder={copy.you.placeholder}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className={s.actions}>
        <button
          type="button"
          className={s.primary}
          disabled={!draft.trim()}
          onClick={() => save(kind, line)}
        >
          {copy.you.save}
        </button>
        <button type="button" className={s.secondary} onClick={close}>
          {copy.you.cancel}
        </button>
      </div>
    </div>
  );

  return (
    <div className={s.page}>
      <Link className={s.link} href="/home">
        ← {copy.you.back}
      </Link>
      <h1 className={`${s.title} ${s.ritualTitle}`}>{copy.you.title}</h1>
      <p className={s.caption}>{lines.length ? copy.you.line : copy.you.empty}</p>

      {pictureKindSchema.options.map((kind) => {
        const part = lines.filter((l) => l.kind === kind);
        return (
          <section key={kind} className={s.part} aria-label={copy.you.parts[kind]}>
            <p className={s.eyebrow}>{copy.you.parts[kind]}</p>
            {part.length ? (
              <ul className={s.plines}>
                {part.map((line) =>
                  editing === line.id ? (
                    <li key={line.id}>{editor(kind, line)}</li>
                  ) : (
                    <li key={line.id}>
                      <p>
                        {line.text}
                        {line.by === 'you' ? <small>{copy.you.yours}</small> : null}
                      </p>
                      <span className={s.lineActions}>
                        <button
                          type="button"
                          className={s.link}
                          onClick={() => open(line.id, line.text)}
                        >
                          {copy.you.edit}
                        </button>
                        <button
                          type="button"
                          className={s.link}
                          aria-label={copy.you.remove}
                          onClick={() => remove(line)}
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ),
                )}
              </ul>
            ) : null}
            {editing === `new:${kind}` ? (
              editor(kind)
            ) : (
              <button
                type="button"
                className={s.link}
                aria-label={copy.you.addLabel(copy.you.parts[kind])}
                onClick={() => open(`new:${kind}`)}
              >
                + {copy.you.add}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
