# Noozha — Piscine Privee a Chelles

Site vitrine pour la location d'une piscine privee a Chelles (77500), Ile-de-France.

## Stack

- **Runtime** : Bun
- **Build** : Vite 8
- **Framework** : React 19 + TypeScript
- **CSS** : Tailwind CSS v4
- **Linter** : oxlint
- **Animations** : Motion
- **i18n** : react-i18next (FR par defaut, EN, AR avec RTL)
- **Analytics** : Umami
- **Deploiement** : Docker + Dokploy (Oracle VPS)

## Developpement

```bash
bun install
bun dev          # Serveur de dev
bun run build    # Build production
bun run lint     # oxlint
bun run typecheck # TypeScript
```

## Deploiement

Le deploiement est automatise via Dokploy :

- **Push sur `main`** → auto-deploy via Dokploy
- **Compose** : `docker-compose.dokploy.yml`
- **URL** : https://noozha.fr

### Monitoring

- **Analytics** : Umami
- **Uptime** : Uptime Kuma

## Structure

```
src/
├── components/
│   ├── layout/      # Header, Footer
│   └── sections/    # Hero, Experience, Gallery, Pricing, HowItWorks, Trust, Location, Contact, FAQ
├── hooks/           # useTheme, useDirection, useLenis
├── i18n/            # config.ts
├── lib/             # utils.ts, analytics.ts
├── pages/           # Home.tsx
└── styles/          # global.css
public/
├── locales/{fr,en,ar}/  # Traductions
├── images/              # Photos
├── videos/              # Videos
└── favicon.svg
```
