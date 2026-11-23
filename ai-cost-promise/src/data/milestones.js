/**
 * Constellation timeline. `cites` keys point into SOURCES (src/data/sources.js).
 */
export const MILESTONES = [
  { year: 2012, kicker: 'Perception', title: 'Machines learn to see', body: 'A deep neural network, AlexNet, wins a major image-recognition contest by a wide margin, launching the modern deep-learning era.', cites: ['alexnet'] },
  { year: 2016, kicker: 'Strategy', title: 'AlphaGo masters Go', body: 'Deep networks combined with search defeat top professionals at Go, a game long thought decades out of reach.', cites: ['alphago'] },
  { year: 2020, kicker: 'Biology', title: 'Protein folding, cracked', body: 'AlphaFold 2 predicts protein structures with near-experimental accuracy at the CASP14 assessment, a 50-year grand challenge.', cites: ['alphafold2'] },
  { year: 2022, kicker: 'Language', title: 'AI goes public', body: 'ChatGPT brings conversational AI to the general public, and with it a surge in demand for data centres.', cites: ['chatgpt'] },
  { year: 2023, kicker: 'Discovery', title: 'New materials, better forecasts', body: 'GNoME predicts 2.2 million new crystal structures; GraphCast out-forecasts the leading conventional weather model on most measures.', cites: ['gnome', 'graphcast'] },
  { year: 2024, kicker: 'Recognition', title: 'A Nobel for AI in science', body: 'The Chemistry prize honours protein structure prediction and computational protein design.', cites: ['nobel-2024'] },
  { year: 2025, kicker: 'Medicine', title: 'From lab to clinic', body: 'An AI-discovered drug reports Phase IIa results, and AI-supported mammography finds 29% more cancers in a randomised trial.', cites: ['insilico-2025', 'masai-2025'] },
  { year: 2026, kicker: 'Accounting', title: 'Both ledgers, on the record', body: 'Data-centre electricity jumps 17% in a year, while companies begin publishing per-prompt footprints. The cost and the promise are now measured side by side.', cites: ['iea-key-questions', 'google-gemini'] },
];
