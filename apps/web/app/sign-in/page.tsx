import type { Metadata } from 'next';
import { ButtonLink, Footer, Wordmark } from '../../components/ui';
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
    <div className="page">
      <header className="obar">
        <div className="wrap" style={{ gridTemplateColumns: '1fr' }}>
          <Wordmark href="/" />
        </div>
      </header>
      <main className="main wrap">
        {supabaseConfigured ? (
          <SignInForm expired={error === 'expired'} />
        ) : (
          <section className="stack">
            <h1>{copy.signIn.noAccountsTitle}</h1>
            <p className="lede">{copy.signIn.noAccountsLine}</p>
            <div className="actions-row">
              <ButtonLink href="/connect">{copy.signIn.beginWithout}</ButtonLink>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
