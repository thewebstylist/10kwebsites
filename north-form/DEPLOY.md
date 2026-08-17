# Deploying to Bunny.net

Everything in this folder is static. No build step, no server code.
Upload the contents so `index.html` sits at the root of the zone.

## Do this one edit first (2 minutes)

Open `index.html`, find and replace **`YOUR-DOMAIN.com`** with your real
hostname. It appears exactly twice, both in the social preview block near
the top:

```html
<meta property="og:url"   content="https://YOUR-DOMAIN.com/" />
<meta property="og:image" content="https://YOUR-DOMAIN.com/assets/og-image.jpg" />
```

These must be absolute URLs. Facebook and LinkedIn will not resolve a relative
`og:image`, and the link preview quietly falls back to plain text instead of
showing the hero. Everything else on the page works untouched.

## Bunny steps

1. **Storage → Add Storage Zone.** Pick a region near your audience.
2. **Upload the files.** Either drag them into the dashboard file manager, or
   use the FTP credentials on the zone's *FTP & API Access* tab. Upload the
   *contents* of this folder, so the zone root holds `index.html` and an
   `assets/` folder beside it, not a nested `north-form/` folder.
3. **CDN → Add Pull Zone.** Set **Origin Type: Storage Zone** and point it at
   the zone from step 1.
4. **Add your hostname** under the Pull Zone's *Hostnames* tab, then create the
   matching CNAME at your DNS provider pointing to the `b-cdn.net` hostname
   Bunny gives you.
5. **Turn on SSL** for that hostname (Bunny issues a free Let's Encrypt cert),
   and enable *Force SSL*.

## Worth knowing

- **Videos.** `hero.mp4` is scrubbed by scroll position, which means the
  browser seeks it constantly. Leave Bunny's default caching on so those range
  requests come from the edge rather than the origin. It is encoded with a
  keyframe every 6 frames specifically so seeking stays cheap.
- **Total payload** is about 7MB, most of it the three video files. They are
  `preload="metadata"`, so a first visit only pulls headers until each clip is
  actually needed.
- **External dependencies.** The page pulls Tailwind, GSAP, Lenis and Google
  Fonts from public CDNs at runtime. That is how the original was specified and
  it works, but it does mean the layout depends on `cdn.tailwindcss.com` being
  reachable, and Tailwind's CDN build compiles in the browser on every load.
  Vendoring those four into `assets/` is a small change and makes the site
  fully self-contained and faster. Worth doing before this is anything more
  than a demo.
