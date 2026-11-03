import type { Metadata } from 'next';
import Link from 'next/link';
import { Arrow, Brand } from '../../components/ds/ui';
import { copy } from '../../lib/copy';
import { supabaseConfigured } from '../../lib/env';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="ds">
      <div className="ds-col">
        <main className="si">
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            <Brand />
          </Link>
          {supabaseConfigured ? (
            <SignInForm expired={error === 'expired'} />
          ) : (
            <section className="ds-card si-card">
              <h1>{copy.signIn.noAccountsTitle}</h1>
              <p>{copy.signIn.noAccountsLine}</p>
              <Link className="ds-primary" href="/connect">
                {copy.signIn.beginWithout}
                <Arrow />
              </Link>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
