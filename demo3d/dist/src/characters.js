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
    id: 'vesper',
    index: '01',
    name: 'Vesper',
    role: 'Deep-sea salvage diver',
    glb: 'assets/glb/01-vesper.glb',
    thumb: 'assets/img/01-vesper-src.webp',
    engine: 'Tripo H3.1',
    engineId: 'tripo_h3_1_image_to_3d',
    credits: 9,
    settings: 'texture · standard geometry · original-image alignment',
    yaw: 0,
  },
  {
    id: 'kiro',
    index: '02',
    name: 'Kiro',
    role: 'Forest guardian',
    glb: 'assets/glb/02-kiro.glb',
    thumb: 'assets/img/02-kiro-src.webp',
    engine: 'Hunyuan3D v3',
    engineId: 'hunyuan3d_v3_image_to_3d',
    credits: 19,
    settings: 'PBR · normal generation · 800k faces',
    yaw: 0,
  },
  {
    id: 'ansel9',
    index: '03',
    name: 'Ansel-9',
    role: 'Botanist android',
    glb: 'assets/glb/03-ansel9.glb',
    thumb: 'assets/img/03-ansel9-src.webp',
    engine: 'Meshy',
    engineId: 'image_to_3d',
    credits: 30,
    settings: 'PBR · 250k target polycount · triangle topology',
    yaw: 0,
  },
];
