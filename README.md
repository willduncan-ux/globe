# Right Now on Earth

A live, mobile-first 3D globe of the planet **right now** — the day/night
terminator sweeping across the world, city lights on the night side, and every
aircraft currently in the air. Tap a plane to see where it's going. One tap
captures the view to share. Installable as a PWA and works offline (the globe is
pure astronomy; only the flight layer needs the network).

## Layers

Each layer toggles independently from the floating control panel, which doubles
as the legend — every toggle is tinted to its layer's colour.

- **☀ Terminator** — the real day/night curve, computed from the Sun's position
  (no API). The signature **"Dawn Ribbon"** glows along the live terminator.
- **◔ City lights** — illuminated cities emerging on the night side.
- **✈ Flights** — live aircraft from [OpenSky](https://opensky-network.org),
  rendered as heading-oriented plane glyphs with speed-scaled motion trails.
  Opens focused on **your region** (from your timezone); a region query is also
  cheaper on OpenSky credits. Tap a plane for callsign, origin → destination
  airports, altitude, speed and heading.
- **✦ Starfield** — ambient backdrop.

Plus: a live UTC clock with a switchable location/timezone, a one-tap
**capture/share** button (Web Share API, falling back to PNG download), and a
cinematic intro — all gated behind `prefers-reduced-motion`.

## Tech

- **Vite + React + TypeScript**, **Tailwind CSS v4**
- **globe.gl** / **three.js**, with `UnrealBloomPass` post-processing and a
  custom day/night `ShaderMaterial`
- **Framer Motion**, **Zustand**, **lucide-react**
- One **Vercel serverless function** proxies OpenSky (holds the OAuth secret)
- **vite-plugin-pwa** (Workbox) for the manifest, service worker and offline shell

## Design system ("Umbral")

A *chosen* indigo-black space, not a default near-black, with one accent per data
layer derived from the phenomenon:

| Token | Hex | Use |
|---|---|---|
| Void | `#070A12` | background |
| Frost | `#E9EEF8` | primary text |
| Haze | `#8794AC` | muted text |
| Dawn | `#FF9E5A` | terminator |
| Sodium | `#FFE08A` | city lights |
| Ion | `#5FE3FF` | flights |
| Stellar | `#C9D6FF` | starfield |

Type: **Space Grotesk** (display, used sparingly) · **Inter** (body/UI) ·
**JetBrains Mono** (live data only — monospace signals "live").

## Local development

**Prerequisites:** Node 18+ and an OpenSky account with an API client
(free for personal/non-profit use). Create one at OpenSky → Account → API clients.

```bash
npm install

# create .env.local with your OpenSky OAuth2 client credentials
cat > .env.local <<'EOF'
OPENSKY_CLIENT_ID=your-client-id
OPENSKY_CLIENT_SECRET=your-client-secret
EOF

npm run dev      # http://localhost:5173 (serves /api/flights locally too)
```

`.env.local` is git-ignored — never commit it.

```bash
npm run build    # type-checks (tsc -b) and builds to dist/ + generates the PWA
npm run preview  # serve the production build locally
```

> Note: `npx tsc --noEmit` is a no-op here (the root tsconfig is references-only).
> Use `npm run build` for a real type-check.

## Deploy (Vercel — free Hobby tier)

The `api/` folder is already written as Vercel serverless functions, so no extra
config is needed.

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
   Vercel auto-detects Vite (build `npm run build`, output `dist/`) and turns
   `api/` into serverless functions.
3. **Project → Settings → Environment Variables** — add:

   | Variable | Value |
   |---|---|
   | `OPENSKY_CLIENT_ID` | your OpenSky client id |
   | `OPENSKY_CLIENT_SECRET` | your OpenSky client secret |

4. **Deploy.** You get HTTPS, a global CDN, a `*.vercel.app` domain (or attach
   your own), and the PWA installs straight from it.

Hobby is free for non-commercial use; the real ceiling is OpenSky's daily credit
allowance, which the app stays within (30s poll, region-scoped queries, and 429
back-off that keeps showing the last good data).

## Data & imagery

- Flights — [OpenSky Network](https://opensky-network.org)
- Routes — [adsbdb](https://www.adsbdb.com)
- Earth imagery — [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0)

Personal, non-commercial project.
