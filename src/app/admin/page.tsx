'use client';
import { useState } from 'react';
import { Alert, Button, Heading, Textfield } from '@digdir/designsystemet-react';
import type { GalleryItem } from '@/lib/gallery/types';

/** Moderering av Kunstveggen. Beskyttet med ADMIN_TOKEN (settes i Vercel). */
export default function AdminPage() {
  const [token, setToken] = useState('');
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    const res = await fetch('/api/admin/gallery', { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return setErr('Feil nøkkel, eller galleri ikke konfigurert.');
    setItems((await res.json()).items);
  };

  const act = async (id: string, action: 'approve' | 'reject') => {
    await fetch('/api/admin/gallery', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    setItems((x) => x?.filter((i) => i.id !== id) ?? null);
  };

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <Heading level={1} data-size="lg">
        Kunstveggen – til godkjenning
      </Heading>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        style={{ display: 'flex', gap: 8, alignItems: 'end', margin: '16px 0' }}
      >
        <Textfield label="Admin-nøkkel" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" />
        <Button type="submit">Hent</Button>
      </form>
      {err && <Alert data-color="danger">{err}</Alert>}
      {items?.length === 0 && <p>Ingenting venter på godkjenning.</p>}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
        {items?.map((i) => (
          <li key={i.id} style={{ display: 'grid', gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.url} alt={i.prompt} style={{ width: '100%', aspectRatio: '3/4', objectFit: 'contain', background: '#fff', border: '1px solid #ddd' }} />
            <strong>{i.prompt}</strong>
            <span>
              {i.kind === 'template' ? 'Mal' : 'Kunstverk'} av {i.author} · {new Date(i.createdAt).toLocaleString('nb-NO')}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button data-color="success" onClick={() => act(i.id, 'approve')}>
                Godkjenn
              </Button>
              <Button variant="secondary" data-color="danger" onClick={() => act(i.id, 'reject')}>
                Avvis
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
