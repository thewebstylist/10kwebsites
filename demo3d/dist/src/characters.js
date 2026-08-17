// Character registry.
//
// Everything the viewer needs to know about a character lives here. Swapping a
// mesh is a one-line change: point `glb` at the new file and, if the engine
// picked a different "front", nudge `yaw`.
//
// `yaw` is a rotation in radians applied about Y *before* the bounding-box
// normalisation, so the figure stays centred on the turntable.

export const TARGET_HEIGHT = 2.0; // world units, feet at y=0

export const CHARACTERS = [
  {
    id: 'kage',
    index: '01',
    name: 'Kage',
    role: 'Cybernetic ninja',
    glb: 'assets/glb/01-kage.glb',
    thumb: 'assets/img/01-kage-src.webp',
    engine: 'Tripo H3.1',
    engineId: 'tripo_h3_1_image_to_3d',
    credits: 9,
    settings: 'texture · standard geometry · original-image alignment',
    yaw: 0,
  },
  {
    id: 'tetsu',
    index: '02',
    name: 'Tetsu',
    role: 'Cybernetic samurai',
    glb: 'assets/glb/02-tetsu.glb',
    thumb: 'assets/img/02-tetsu-src.webp',
    engine: 'Hunyuan3D v3',
    engineId: 'hunyuan3d_v3_image_to_3d',
    credits: 19,
    settings: 'PBR · normal generation · 800k faces',
    yaw: 0,
  },
  {
    id: 'kin',
    index: '03',
    name: 'Kin',
    role: 'Hooded cybernetic ninja',
    glb: 'assets/glb/03-kin.glb',
    thumb: 'assets/img/03-kin-src.webp',
    engine: 'Meshy',
    engineId: 'image_to_3d',
    credits: 30,
    settings: 'PBR · 250k target polycount · triangle topology',
    yaw: 0,
  },
];
