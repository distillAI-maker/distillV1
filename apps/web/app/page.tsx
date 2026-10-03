import { copy } from '../lib/copy';
import { supabaseConfigured } from '../lib/env';
import { ButtonLink, Footer, Wordmark } from '../components/ui';

export default function Welcome() {
  return (
    <div className="page">
      <div />
      <main className="main wrap">
        <section className="hero">
          <Wordmark large />
          <h1 className="display rise">{copy.welcome.title}</h1>
          <p className="lede rise">{copy.welcome.line}</p>
          <div className="actions-row rise">
            <ButtonLink href={supabaseConfigured ? '/sign-in' : '/connect'}>
              {copy.welcome.begin}
            </ButtonLink>
            {supabaseConfigured ? (
              <ButtonLink href="/sign-in" variant="link">
                {copy.welcome.haveAccount}
              </ButtonLink>
            ) : null}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
