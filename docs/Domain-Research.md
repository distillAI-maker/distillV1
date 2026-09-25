# Domain research for Distill

Checked 24 September 2026. Availability was confirmed against the registries themselves (Verisign for .com, Identity Digital for .life and .today, Google for .app, GoDaddy Registry for .fit) plus nameserver lookups for the rest. Prices are the yearly renewal at Cloudflare Registrar (sells at cost) and at Porkbun, both including WHOIS privacy. First-year sale prices are noted separately because the renewal is what you pay for years.

## Recommendation

1. **hellodistill.com** as the main domain. A .com is still what a 25 to 45 audience trusts most, it costs about $10 a year, and "hello" is a well-worn pattern for consumer brands. Team email becomes `name@hellodistill.com`.
2. **distill.life** as the more distinctive option, or as a second domain that redirects to the first. It reads like a brand rather than a product name, and it says what the product does: reduce life to what matters. Costs about three times a .com. Some people will still type .com.
3. **distillhabits.com** as the plain backup. It says exactly what the product judges. A little literal for a premium brand.

Skip the .ai endings even though three are free. They cost $80 a year, usually with a two-year minimum, and they tell people "AI product", which the copy deliberately avoids.

The short names (distill.com, distill.co, distill.ai) are either in use or on the aftermarket at prices that are quoted on request and are normally in the thousands. Not worth it before there is revenue.

## Available now

| Name | Cloudflare / yr | Porkbun / yr | Read |
|---|---|---|---|
| hellodistill.com | $10.46 | $11.08 | Friendly, trusted ending. First choice. |
| distillhabits.com | $10.46 | $11.08 | Descriptive. Good backup or redirect. |
| distillsleep.com | $10.46 | $11.08 | Narrows the brand to sleep only. |
| stackdistill.com | $10.46 | $11.08 | "Stack" is insider language. Awkward. |
| distill.life | $28.20 | $29.35 (first year $2.57) | Short and brand-like. Second choice. |
| distill.today | $22.20 | $23.17 (first year $2.57) | Sounds like a news site. |
| distill.fit | $25.20 | $26.26 (first year $2.06) | Fitness connotation. Wrong for sleep and recovery. |
| distillhealth.app | $14.20 | $14.93 (first year $8.75) | .app forces HTTPS. "Health" leans medical, which the copy avoids. |
| trydistill.co, distillwellness.co, distillhealth.co | $30.00 | $31.20 (first year $15.76) | Confirmed free by the .co registry. "try" and "co" together read like a SaaS tool. |
| trydistill.ai, joindistill.ai, distillhealth.ai | $80.00 | $82.70 | Free, but see the note above. |

## Taken

- In use: distill.com, distill.app, distill.io, distill.health, distill.dev, distill.me, distill.so, distill.care, distill.bio, distill.page, distill.tech, distill.org, distill.net, distill.studio, distill.run, distill.one, distill.works, distill.site, distill.digital, distill.wiki, distill.us
- In use: getdistill.com, trydistill.com, usedistill.com, joindistill.com, mydistill.com, distillhealth.com, distillwellness.com, distillhq.com, distilllabs.com, distillai.com, distill-health.com, getdistill.app, trydistill.app, getdistill.co, getdistill.ai, usedistill.ai
- Parked for sale, price on request: distill.ai, distill.co, distill.xyz, distill.pro, distill.to, distill.world, distill.cc, distill-ai.com, distillapp.com, distillstack.com, distillit.com

## Where to buy

**Cloudflare Registrar** is the cheapest: it sells at the registry's wholesale price with no markup and privacy is included. It sells .com, .app, .life, .fit, .co, .today, .ai and .health. It does not sell .so. One setting to know: when the site is on Vercel, the DNS record at Cloudflare must be set to "DNS only" (grey cloud), not proxied.

**Vercel** also sells domains from the project's Domains screen. It costs a few dollars more per year than an at-cost registrar, but there is no DNS to set up at all, which is the easiest path for a first domain.

**Porkbun** is the fallback for an ending Cloudflare doesn't carry. Prices are close to cost and it has large first-year discounts on the newer endings.

Whatever the registrar, look at the renewal price, not the first-year price. Registrars that advertise a $1 first year often renew at $15 to $20.

One timing note: Verisign raises the wholesale .com price by about $0.70 on 1 November 2026, and at-cost registrars pass that through.

## After buying

1. In Vercel, open the project, then **Settings > Domains**, type the name and click **Add**.
2. Vercel shows the exact DNS records to create at the registrar (an A record for the bare name and a CNAME for `www`). Copy them into the registrar's DNS page. If you bought on Vercel, this step is done for you.
3. Wait for the check mark next to the domain. Certificates are automatic. The site now answers at the domain over HTTPS, and `vercel.app` keeps working too.
4. If you bought a second domain, add it as well and pick the main one under **Redirect to**.

## Sources for prices and policies

- Cloudflare Registrar price list: https://cfdomainpricing.com/ (mirror of the dashboard prices)
- Porkbun price list: https://porkbun.com/products/domains
- Verisign .com wholesale increase, 1 November 2026: https://startupowl.com/reviews/cloudflare-registrar
- Cloudflare Pages free plan and commercial use: https://developers.cloudflare.com/pages/platform/limits/
- Vercel Hobby plan is non-commercial only: https://vercel.com/docs/plans/hobby
- Supabase free projects pause after a week of inactivity: https://supabase.com/docs/guides/platform/free-project-pausing
