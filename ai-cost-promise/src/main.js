/**
 * The Cost and the Promise of AI · entry point.
 * Order matters a little: citations first (so counters see final markup),
 * then interaction, then scroll choreography, then lazy 3D scenes.
 */
import './styles/main.css';
import { REDUCED_MOTION } from './lib/env.js';
import { initScenes } from './lib/scene-manager.js';
import { initCitations } from './ui/citations.js';
import { initCounters } from './ui/counters.js';
import { initDivider } from './ui/divider.js';
import { initCalculator } from './ui/calculator.js';
import { initHeader } from './ui/header.js';
import { initSmoothAnchors } from './ui/smooth-anchors.js';
import { initChoreography, refreshAll } from './ui/choreography.js';

initCitations();
initScenes();
initHeader(REDUCED_MOTION);
initDivider();
initCalculator(REDUCED_MOTION);
initChoreography(REDUCED_MOTION);
initCounters(REDUCED_MOTION);
refreshAll();
initSmoothAnchors(REDUCED_MOTION); // after triggers/pins exist, so deep links land correctly

// Re-measure once web fonts settle (they shift layout slightly).
document.fonts?.ready.then(refreshAll);
