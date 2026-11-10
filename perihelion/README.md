# Perihelion

A scroll-driven 3D concept site for a fictional space agency. One continuous voyage, rendered live with three.js:
Earth sunrise, an orbital shipyard where the starship assembles, the departure burn, then the Moon, Mars, Jupiter,
Saturn, and an interactive chart of the solar system. Below the voyage the page settles into a normal site
(fleet, programme, crew sign-up).

Everything in the scene is procedural (shader planets, primitive-built ship). No textures, models, or video.

## Run it

No build step. Serve the folder with any static server (ES modules do not load from `file://`):

    cd perihelion
    python3 -m http.server 8000

Then open http://localhost:8000. To deploy, upload the folder as-is to any static host.

## Files

- `index.html` page and copy
- `styles.css` layout and type
- `app.js` scene, shaders, scroll choreography (camera keyframes live in the `key(...)` list)
- `vendor/three/` three.js r180 (MIT), vendored so the site has no CDN dependency
