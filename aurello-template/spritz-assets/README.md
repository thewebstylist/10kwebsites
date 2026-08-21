# spritz-assets

`brands/aurello.json` points every image slot at this folder, using the filenames
from the original design. None of them are here yet, so the build draws stand-ins
from the palette and prints what it substituted.

Drop the real files in with these exact names and rebuild. Nothing else changes.

| File | Used by |
|------|---------|
| `aurello-can.png` | hero, product intro, transition, Orange Spritz card |
| `aurello-lemon-mint.png` | Lemon & Mint card |
| `aurello-pink-grapefruit.png` | Pink Grapefruit card |
| `muse.png` | illustration behind the product in the intro, transition and closing sections |
| `meeting.jpg` | first lifestyle card, and the story band |
| `work.jpg` | second lifestyle card |
| `portrait.jpg` | third lifestyle card |
| `orange-slice-pasted.svg` | the drifting motif |

Product images want to be transparent PNGs: the template rotates them, scales them
and casts a real `drop-shadow` on them, and never puts them in a rectangular
container. A cut-out on a white background will read as a white box.
