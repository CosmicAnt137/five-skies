# Five Skies

A small static site: 5 pages, each locked behind its own access code,
each showing the real night sky as seen from a different place on
Earth — all at the same fixed moment in time. Because the moment is
shared, some of the brighter stars naturally show up on more than one
page. That's real astronomy, not a scripted coincidence (see
"Why some stars repeat" below).

Everything runs client-side. Open `index.html` in a browser, or upload
the whole `site` folder to any static host (GitHub Pages, Netlify,
even a shared folder).

## Files

```
site/
├── index.html                    landing page, links to all 5 skies
├── page-1-new-york.html
├── page-2-london.html
├── page-3-tokyo.html
├── page-4-sydney.html
├── page-5-cape-town.html
├── code-generator.html           tool: turn a new code into its hash
├── _template-for-new-page.html   copy this to add a 6th location
└── assets/
    ├── stars-data.js             1,637 real stars (HYG catalog), mag ≤ 5.0
    ├── observation-time.js       the ONE shared moment in time, edit here
    ├── starmap.js                astronomy + canvas rendering engine
    └── styles.css                shared look, per-page accent color
```

## The default placeholder codes

Each page ships with a placeholder code so you can test it immediately.
**Change these before sharing the site** — see below.

| Page       | Location                | Code          |
|------------|--------------------------|---------------|
| Sky 1      | New York City, USA        | `starlight1`  |
| Sky 2      | London, United Kingdom    | `starlight2`  |
| Sky 3      | Tokyo, Japan              | `starlight3`  |
| Sky 4      | Sydney, Australia         | `starlight4`  |
| Sky 5      | Cape Town, South Africa   | `starlight5`  |

## How to customize

**1. Change a location.** Open the page's HTML file and edit the
`PAGE_CONFIG` block near the bottom:

```js
const PAGE_CONFIG = {
  placeName: "New York City, USA",
  lat: 40.7128,
  lon: -74.0060,          // negative = West, positive = East
  accessCodeHash: "...",
};
```

You can also change the `<title>`, the `<body style="--accent-hue: ...">`
value (0–360, a color wheel position) for a different accent color, and
the text inside `.lock-card` if you want different lock-screen copy.

**2. Change an access code.** Open `code-generator.html` in a browser,
type the new code, and copy the resulting hash into that page's
`accessCodeHash`. The plain code is never stored in the file — only its
hash is — so someone reading the page's source can't just read the
code off. This is obscurity, not real security: since everything runs
in the browser, someone with the file and enough patience could still
try to brute-force or work around it. Good for a personal project,
puzzle, or gift; not for protecting anything sensitive.

**3. Change the shared moment in time.** Edit `assets/observation-time.js`.
This is the one value that must stay identical across all 5 pages —
it's what makes the overlap in visible stars a real reflection of the
sky rather than a coincidence.

```js
const OBSERVATION_TIME_UTC = "2026-09-11T20:00:00Z";
```

**4. Add a 6th (or 7th…) location.** Copy `_template-for-new-page.html`,
rename it, and fill in `__PLACE__`, `__LAT__`, `__LON__`, `__HUE__`, and
`__HASH__` (get the hash from `code-generator.html`).

## Why some stars repeat

Which stars are visible from a given spot depends on two things: your
**latitude** (which declinations ever rise above your horizon) and the
**exact moment** (which right ascensions happen to be facing away from
the sun right then). All 5 pages use the same `OBSERVATION_TIME_UTC`,
so a bright star that happens to sit in the right part of the sky at
that instant will be up in every location whose latitude allows it.
With the current default locations and time, for example, Deneb is
above the horizon in 4 of the 5 cities, and Vega in 3 — genuinely,
not by design of the star list. Change the time or the locations and
the overlap will change too.

## Notes on accuracy

- Star positions, magnitudes, and colors come from the [HYG
  database](https://github.com/astronexus/HYG-Database) (Hipparcos +
  Yale Bright Star + Gliese catalogs combined), licensed CC BY-SA 4.0.
  Limited here to the ~1,637 stars of naked-eye brightness (magnitude
  ≤ 5.0).
- Star color on screen is a stylistic approximation from each star's
  B−V color index via an approximate blackbody-temperature mapping —
  good for a believable sky, not a scientific rendering.
- The sky is drawn as a dome: zenith at the center, horizon at the
  edge, N/E/S/W marked around the rim. Precession, atmospheric
  refraction, and proper motion since epoch J2000 are not modeled —
  irrelevant at this visual scale.
- Everything is computed from real spherical astronomy (Julian date →
  Greenwich sidereal time → local sidereal time → alt/az), not a
  lookup table, so any date, time, or coordinate you enter will
  produce a correct sky.
