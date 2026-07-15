// Seeds the client's actual sequence-of-work reference
// (20260524_Seq of Work.pdf, provided via chat — not stored in this repo) as
// real data: missing Works, a task for every step in the diagram (reusing
// the 15 existing demo tasks where they represent the same step), and a
// TaskDependency edge for every connection drawn in the diagram.
//
// Idempotent — safe to run multiple times: Works upsert by code, tasks
// upsert by taskName (skip if a task with that exact name already exists
// anywhere), edges upsert by the (taskId, dependsOnTaskId) unique pair.
//
// CONFIDENCE NOTE: this is a best-effort transcription of a dense, multi-
// column hand-drawn diagram read via a flattened text extraction (not a
// pixel-level view of the actual connecting lines). The top spine's fan-out/
// reconvergence (Steps 1-6 below) and the long single-column trade chains
// are high-confidence — that structure is unambiguous in the source. A
// handful of specific edges are genuinely uncertain and are marked
// `// AMBIGUOUS:` inline with the reasoning — see CHANGELOG_reference_seed.md
// for the full list to review.

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma';
import { wouldCreateCycle } from '../lib/utils/dependency-graph';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEMO_PROJECT_NAME = 'ABC Villa Construction';

// ── Additional Works beyond the 6 already created ──────────────────────
// These trade codes (PAINT, MODULAR, ALU.D&W, GLASS, LIGHT.V) appear in the
// PDF but weren't in the originally-named list of 6 — flagging that this
// goes slightly beyond the literal ask, per "every trade code in the PDF
// that doesn't already exist."
const MORE_WORKS = [
  { name: 'Painting',            code: 'PAINT',   color: '#D946EF', description: 'Wall and ceiling painting works' },
  { name: 'Modular Furniture',   code: 'MODULAR', color: '#1D4ED8', description: 'Modular kitchen, wardrobe, and vanity unit works' },
  { name: 'Aluminium Doors & Windows', code: 'ALUDW', color: '#64748B', description: 'Aluminium window and sliding door works' },
  { name: 'Glass & Mirrors',     code: 'GLASS',   color: '#9333EA', description: 'Mirror and shower partition works' },
  { name: 'Lighting Vendor',     code: 'LIGHTV',  color: '#0369A1', description: 'Decorative lighting vendor works' },
] as const;

// ── Task definitions ────────────────────────────────────────────────────
// `key` is only used internally by this script to wire up edges below —
// it is never persisted. `reuse` names an existing HvacTask.taskId to reuse
// instead of creating a new task (matched by meaning against the PDF step,
// not exact string — see CHANGELOG for the full match list, including the
// handful where the existing demo task's Work disagrees with the PDF's
// trade code for that same step).
interface TaskDef {
  key: string;
  name: string;
  work: string;
  reuse?: string;
}

const TASKS: TaskDef[] = [
  // ── Main spine ──
  { key: 'tileBull',        name: 'Tile Bull Marking',                                                        work: 'FLOOR', reuse: 'FLOOR-013' },
  { key: 'falseCeilingMark',name: 'Gypsum & Wooden False Ceiling Levels Marking',                              work: 'FCEIL' },

  // ── Tier 3 (fans from falseCeilingMark) ──
  { key: 'ceilElecMark',    name: 'Ceiling Electrical Conduit Marking',                                       work: 'ELEC', reuse: 'ELEC-004' },
  { key: 'acLevelsMark',    name: 'AC Units Level Marking',                                                   work: 'HVAC', reuse: 'HVAC-001' },
  { key: 'ceilPlumMark',    name: 'CPVC & PVC Pipe Level Marking',                                             work: 'PLUM', reuse: 'PLUM-007' },

  // ── Tier 4 (reconverges the 3 above) ──
  { key: 'coreCuttings',    name: 'Core Cuttings for HVAC, Electrical & Plumbing',                             work: 'HVAC' },

  // ── Tier 5 (fans from coreCuttings) ──
  { key: 'elecFrameWorks',  name: 'Ceiling Electrical Conduit Frame Works',                                    work: 'ELEC' },
  { key: 'hvacSupportFrame',name: 'HVAC Support Framing Works',                                                work: 'HVAC' },
  { key: 'suspCeilFrame',   name: 'Suspended Ceiling Framing Works for PVC & CPVC',                            work: 'PLUM' },

  // ── Tier 6 (reconverges the 3 above; two parallel outputs) ──
  { key: 'woodSupport',     name: 'Wooden Supporting for Curtain Pelmets, Suspended Lights, Fans & Speakers',  work: 'CARP' },
  { key: 'giWoodFrame',     name: 'GI & Wood Framing Works',                                                   work: 'FCEIL' },

  // ── Swimming pool + terrace chain (parallel track, branches off falseCeilingMark) ──
  { key: 'poolCivilChange', name: 'Swimming Pool Civil Changes as per Vendor',                                 work: 'CIVIL' },
  { key: 'poolDebris',      name: 'Swimming Pool Debris Cleaning',                                             work: 'CIVIL' },
  { key: 'poolPlumElec',    name: 'Swimming Pool Plumbing & Electrical Work as per Vendor Spec',                work: 'PLUM' },
  { key: 'poolMasonry',     name: 'Swimming Pool Plumbing Masonry Packing & Plastering',                        work: 'CIVIL' },
  { key: 'poolWaterproof',  name: 'Swimming Pool Water Proofing',                                              work: 'WPROOF' },
  { key: 'poolTiling',      name: 'Swimming Pool Water Tiling & Dado Works',                                    work: 'FLOOR' },
  { key: 'terraceDebris',   name: 'Terrace/Balcony Debris Cleaning',                                            work: 'CIVIL', reuse: 'CIVIL-010' },
  { key: 'terraceWaterproof', name: 'Terrace, Balconies, Planter Box & Toilets Water Proofing',                 work: 'WPROOF' },
  { key: 'terraceSunkenTest', name: 'Terrace, Balconies, Planter Boxes & Toilets Sunken Slab Water Pond Test',  work: 'WPROOF' },
  { key: 'drainageMedium',  name: 'Drainage Medium Installation for Planter Boxes & Soil Filling',              work: 'LSCAPE' },

  // ── FABRI / MS staircase independent chain ──
  // CORRECTION: verified directly against the PDF screenshots (not the
  // earlier flattened-text extraction) — this column continues five boxes
  // further than originally seeded. All five below were entirely missing.
  { key: 'msStaircase',     name: 'MS Staircase Works and Terrace Pergola Works',                               work: 'FABRI' },
  { key: 'extElecWorks',    name: 'External Electrical Works',                                                 work: 'ELEC' },
  { key: 'extPlumWorks',    name: 'External Plumbing Works',                                                    work: 'PLUM' },
  { key: 'msStaircaseFloor',name: 'MS Staircase Works and Terrace Flooring Works',                              work: 'FLOOR' },
  { key: 'extPaintWorks',   name: 'External Paint Works',                                                       work: 'PAINT' },
  { key: 'extFlooring',     name: 'External Flooring',                                                          work: 'FLOOR' },
  { key: 'mainGateFab',     name: 'Main Gate & Wicket Gate Fabrication Work',                                    work: 'FABRI' },
  { key: 'mainGatePaint',   name: 'Main Gate & Wicket Gate Painting Work',                                       work: 'PAINT' },

  // ── CIVIL door/window independent chain ──
  { key: 'doorWindowCorrect', name: 'Door & Window Openings Right Angle Corrections & Plastering',             work: 'CIVIL' },
  { key: 'windowStoneJamb',  name: 'Window Stone Jambing Works',                                               work: 'FLOOR' },

  // ── Electrical main chain (from woodSupport/giWoodFrame) ──
  { key: 'switchBoardMark',  name: 'Switch Boards Levels Marking',                                             work: 'ELEC' },
  { key: 'wallElecChip',     name: 'Wall Electrical Conduit Chipping Work',                                    work: 'ELEC' },
  { key: 'wallBullMarksElec',name: 'Wall Bull Marks',                                                          work: 'POP' },
  { key: 'wallElecConduit',  name: 'Wall Electrical Conduit & Back Box Fixing',                                work: 'ELEC', reuse: 'ELEC-005' },
  { key: 'ceilWallWiring',   name: 'Ceiling & Wall Electrical Wiring Works',                                   work: 'ELEC' },
  { key: 'elecPlaster',      name: 'Electrical Switch Boards & Wall Conduits Plastering Works',                work: 'CIVIL' },

  // ── HVAC main chain (from woodSupport/giWoodFrame) ──
  { key: 'hvacRefrigPipe',   name: 'HVAC Refrigerant Piping',                                                  work: 'HVAC', reuse: 'HVAC-002' },
  { key: 'hvacWallChip',     name: 'Wall Chipping for HVAC Drain Outlet Pipe',                                 work: 'HVAC' },
  { key: 'hvacDrainRoute',   name: 'HVAC Drain Outlet Pipe Routing',                                           work: 'HVAC', reuse: 'HVAC-003' },
  { key: 'hvacDrainPlaster', name: 'HVAC Drain Pipes Plastering',                                              work: 'CIVIL' },

  // ── Plumbing main chain (from woodSupport/giWoodFrame) ──
  { key: 'suspCeilPipeWorks',name: 'Suspended Ceiling PVC & CPVC Pipe Works',                                  work: 'PLUM' },
  { key: 'sanitaryMark',     name: 'Sanitary & Kitchen Fittings Levels Marking',                                work: 'PLUM' },
  { key: 'plumWallChip',     name: 'Wall Chipping for CPVC, PVC Pipe & Concealed Parts for Kitchen & Toilets',  work: 'PLUM' },
  { key: 'plumPipeRoute',    name: 'Plumbing CPVC & PVC Pipe Routing',                                          work: 'PLUM' },
  { key: 'waterPressureTest',name: 'Water Pressure Testing',                                                    work: 'PLUM', reuse: 'PLUM-008' },
  { key: 'wcFlushFix',       name: 'WC Flush Tanks and Concealed Parts Fixing',                                 work: 'PLUM' },
  { key: 'toiletPlumPlaster',name: 'Toilet Plumbing Pipes & Ledge Wall Plastering',                              work: 'PLUM', reuse: 'PLUM-009' },

  // ── Ceiling/wall finishing section ──
  { key: 'wallHacking',      name: 'Wall Hacking Works',                                                       work: 'POP' },
  { key: 'gypsumSheeting',   name: 'Gypsum Ceiling Sheeting Work',                                             work: 'FCEIL' },
  { key: 'plywoodCeiling',   name: 'Ply Wood Sheet Fixing for Ceiling & Curtain Pelmets',                       work: 'CARP' },
  { key: 'sunkenFilling',    name: 'Sunken Filling',                                                            work: 'CIVIL', reuse: 'CIVIL-011' },
  { key: 'gypsumLightCut',   name: 'Gypsum Ceiling Cuttings for Lights Provision',                              work: 'FCEIL' },
  { key: 'woodenLightCut',   name: 'Wooden Ceiling Cuttings for Lights Provision',                              work: 'CARP' },
  { key: 'toiletFloorTile',  name: 'Toilet Floor Tile Laying Work',                                             work: 'CIVIL', reuse: 'CIVIL-012' },
  { key: 'wallPunning',      name: 'Wall Punning Works',                                                        work: 'POP' },
  { key: 'gypsumJointFinish',name: 'Gypsum Ceiling Joints Finishing Works',                                     work: 'FCEIL' },
  { key: 'flutedPanels',     name: 'Fluted Panels or Veneer Fixing to Ply Ceiling',                             work: 'CARP' },
  { key: 'toiletKitchenDado',name: 'Toilet & Kitchen Wall Dado Tile Laying',                                    work: 'FLOOR' },
  { key: 'aluWindowMeasure', name: 'Aluminium Windows & Sliding Doors Measurements',                            work: 'ALUDW' },
  { key: 'puttyGypsum',      name: 'Putty 2 Coats for Gypsum Ceilings',                                         work: 'PAINT' },
  { key: 'groutingDado',     name: 'Grouting Work for Toilet & Kitchen Dado Works',                             work: 'FLOOR' },
  { key: 'paperSandGypsum',  name: 'Paper Sanding for Gypsum Ceiling',                                          work: 'PAINT' },
  { key: 'nonElecFloorWiring', name: 'Non-Electrical Floor Conduiting and Wiring Works',                        work: 'ELEC' },
  { key: 'toiletLedgeStone', name: 'Toilet Ledge Seating Stone Laying',                                         work: 'FLOOR' },
  { key: 'mainDoorMeasure',  name: 'Main Door & Internal Doors Measurements',                                   work: 'CARP' },
  { key: 'basePrimerGypsum', name: 'Base Primer Paintings (Gypsum Ceiling)',                                    work: 'PAINT' },
  { key: 'mirrorMeasure',    name: 'Mirror & Shower Partitions Measurements',                                    work: 'GLASS' },
  // CORRECTION: the PDF draws this exact box ("Wall Bull marks (POP)") a
  // second time, lower in the diagram, between Wall Hacking and Wall Punning
  // — a distinct step, not the same box as wallBullMarksElec above. Suffixed
  // for DB uniqueness only; the PDF's own label text is identical both times.
  { key: 'wallBullMarksFinish', name: 'Wall Bull Marks (Ceiling Finishing)',                                    work: 'POP' },

  // ── Spine continues ──
  { key: 'internalMarble',   name: 'Internal Marble Flooring',                                                 work: 'FLOOR', reuse: 'FLOOR-014' },
  { key: 'modularMeasure',   name: 'Modular On-Site Measurements for Kitchen, Wardrobes & Vanity Units',        work: 'MODULAR' },
  { key: 'marblePolish',     name: 'Marble Polishing',                                                          work: 'FLOOR', reuse: 'FLOOR-015' },
  { key: 'marbleProtect',    name: 'Marble Floor Protection Sheets Laying',                                     work: 'FLOOR' },

  // ── Final fan-out (wall paint + erections + finishing) ──
  { key: 'puttyWalls',       name: 'Putty 2 Coats for Internal & External Walls',                               work: 'PAINT' },
  { key: 'paperSandWalls',   name: 'Paper Sanding for Internal & External Walls',                                work: 'PAINT' },
  { key: 'basePrimerWalls',  name: 'Base Primer for All Walls',                                                 work: 'PAINT' },
  { key: 'mainDoorErection', name: 'Main Door & Internal Doors Erection',                                       work: 'CARP' },
  { key: 'aluWindowErection',name: 'Aluminium Windows & Sliding Doors Erection',                                work: 'ALUDW' },
  { key: 'texturePaints',    name: 'Texture Paints',                                                            work: 'PAINT' },
  { key: 'modularErection',  name: 'Modular Erection for Kitchen, Wardrobes & Vanity Units',                     work: 'MODULAR' },
  { key: 'woodenWallPanel',  name: 'Wooden Wall Panelling',                                                     work: 'CARP' },
  { key: 'firstCoatPaint',   name: '1st Coat Paint for Internal, External Walls & Gypsum Ceiling',              work: 'PAINT' },
  // CORRECTION: the PDF draws "Mirrors & Shower partitions measurements
  // (GLASS)" a second time here, right before Wooden Wall Panelling in this
  // erection fan-out tier — a later re-measurement step, not the same box as
  // mirrorMeasure above (which sits much earlier, in the ceiling-finishing
  // tier). Suffixed for DB uniqueness only.
  { key: 'mirrorMeasure2',   name: 'Mirror & Shower Partitions Measurements (Pre-Erection)',                     work: 'GLASS' },

  // ── Final finishing row ──
  { key: 'wardrobeLights',   name: 'Wardrobe Profile Lights Fixing',                                            work: 'ELEC' },
  { key: 'kitchenCounter',   name: 'Kitchen Counter Stone Laying',                                              work: 'FLOOR' },
  { key: 'toiletVanity',     name: 'Toilet Vanity Counter Stone Laying',                                        work: 'FLOOR' },
  { key: 'sanitaryFix',      name: 'Sanitary Fittings Fixing',                                                  work: 'PLUM' },
  { key: 'ceilDownLights',   name: 'Ceiling Down Lights Fixing',                                                work: 'ELEC', reuse: 'ELEC-006' },
  { key: 'decorLights',      name: 'Decorative Lights Fixing',                                                  work: 'LIGHTV' },
  { key: 'elecSwitchFix',    name: 'Electrical Switch Boards Fixing',                                           work: 'ELEC' },
  { key: 'ceilFanFix',       name: 'Ceiling Fans and Exhaust Fans Fixing',                                       work: 'ELEC' },
  { key: 'secondCoatPaint',  name: '2nd Coat Paint for Walls & Gypsum Ceilings',                                 work: 'PAINT' },
  // AMBIGUOUS: the PDF literally labels this step (PAINT), which reads like it
  // may be a labeling slip in the source (AC fixing is HVAC's trade), but I'm
  // transcribing exactly as drawn rather than silently "fixing" it.
  { key: 'finalAcFix',       name: "Final Indoor and Outdoor AC's Fixing",                                       work: 'PAINT' },
  { key: 'mirrorFix',        name: 'Mirrors & Shower Partitions Fixing',                                        work: 'GLASS' },
  { key: 'plantationWorks',  name: 'Plantation Works',                                                          work: 'LSCAPE' },
];

// ── Dependency edges: [dependentKey, prerequisiteKey] ──────────────────
const EDGES: [string, string][] = [
  // Main spine + fan-out/reconvergence (high confidence)
  ['falseCeilingMark', 'tileBull'],
  ['ceilElecMark', 'falseCeilingMark'],
  ['acLevelsMark', 'falseCeilingMark'],
  ['ceilPlumMark', 'falseCeilingMark'],
  ['coreCuttings', 'ceilElecMark'],
  ['coreCuttings', 'acLevelsMark'],
  ['coreCuttings', 'ceilPlumMark'],
  ['elecFrameWorks', 'coreCuttings'],
  ['hvacSupportFrame', 'coreCuttings'],
  ['suspCeilFrame', 'coreCuttings'],
  ['woodSupport', 'elecFrameWorks'],
  ['woodSupport', 'hvacSupportFrame'],
  ['woodSupport', 'suspCeilFrame'],
  ['giWoodFrame', 'elecFrameWorks'],
  ['giWoodFrame', 'hvacSupportFrame'],
  ['giWoodFrame', 'suspCeilFrame'],

  // Swimming pool + terrace chain — sequential (high confidence for the
  // sequence itself). AMBIGUOUS: anchoring the chain's start (poolCivilChange)
  // to falseCeilingMark is my best read of its vertical position (same tier
  // as the ceilElecMark/acLevelsMark/ceilPlumMark row) — review this one edge.
  ['poolCivilChange', 'falseCeilingMark'],
  ['poolDebris', 'poolCivilChange'],
  ['poolPlumElec', 'poolDebris'],
  ['poolMasonry', 'poolPlumElec'],
  ['poolWaterproof', 'poolMasonry'],
  ['poolTiling', 'poolWaterproof'],
  ['terraceDebris', 'poolTiling'],
  ['terraceWaterproof', 'terraceDebris'],
  ['terraceSunkenTest', 'terraceWaterproof'],
  ['drainageMedium', 'terraceSunkenTest'],

  // MS staircase / FABRI independent chain.
  // AMBIGUOUS: anchoring msStaircase's start to falseCeilingMark (same
  // reasoning as the pool chain — it's a parallel track "tied to the same
  // starting point" per your own description). Review this anchor edge.
  ['msStaircase', 'falseCeilingMark'],
  ['extElecWorks', 'msStaircase'],
  ['extPlumWorks', 'extElecWorks'],
  // CORRECTION: verified against the PDF screenshots — this column
  // continues through five more sequential boxes, terminating at the main
  // gate painting work with no further downstream connection.
  ['msStaircaseFloor', 'extPlumWorks'],
  ['extPaintWorks', 'msStaircaseFloor'],
  ['extFlooring', 'extPaintWorks'],
  ['mainGateFab', 'extFlooring'],
  ['mainGatePaint', 'mainGateFab'],

  // CIVIL door/window independent chain.
  // AMBIGUOUS: same anchor uncertainty as above.
  ['doorWindowCorrect', 'falseCeilingMark'],
  ['windowStoneJamb', 'doorWindowCorrect'],

  // Electrical main chain — sequential (high confidence for sequence itself).
  // AMBIGUOUS: anchoring switchBoardMark to BOTH woodSupport and giWoodFrame
  // (both tier-6 outputs feed every tier-7 chain root) — review if only one
  // of the two should actually gate this.
  ['switchBoardMark', 'woodSupport'],
  ['switchBoardMark', 'giWoodFrame'],
  ['wallElecChip', 'switchBoardMark'],
  ['wallBullMarksElec', 'wallElecChip'],
  ['wallElecConduit', 'wallBullMarksElec'],
  ['ceilWallWiring', 'wallElecConduit'],
  ['elecPlaster', 'ceilWallWiring'],

  // HVAC main chain — sequential.
  ['hvacRefrigPipe', 'woodSupport'],
  ['hvacRefrigPipe', 'giWoodFrame'],
  ['hvacWallChip', 'hvacRefrigPipe'],
  ['hvacDrainRoute', 'hvacWallChip'],
  ['hvacDrainPlaster', 'hvacDrainRoute'],

  // Plumbing main chain — sequential.
  ['suspCeilPipeWorks', 'woodSupport'],
  ['suspCeilPipeWorks', 'giWoodFrame'],
  ['sanitaryMark', 'suspCeilPipeWorks'],
  ['plumWallChip', 'sanitaryMark'],
  ['plumPipeRoute', 'plumWallChip'],
  ['waterPressureTest', 'plumPipeRoute'],
  ['wcFlushFix', 'waterPressureTest'],
  ['toiletPlumPlaster', 'wcFlushFix'],

  // Ceiling/wall finishing section.
  // AMBIGUOUS: wallHacking's prerequisite — anchored to elecPlaster as the
  // most visually-proximate prior step in the same column; genuinely unsure.
  ['wallHacking', 'elecPlaster'],
  ['gypsumSheeting', 'elecPlaster'],
  ['plywoodCeiling', 'hvacDrainPlaster'],
  ['sunkenFilling', 'toiletPlumPlaster'],
  ['gypsumLightCut', 'gypsumSheeting'],
  ['woodenLightCut', 'plywoodCeiling'],
  ['toiletFloorTile', 'sunkenFilling'],
  // CORRECTION: wallPunning now follows the second Wall Bull Marks box
  // (wallBullMarksFinish), not wallHacking directly — see TASKS comment.
  ['wallBullMarksFinish', 'wallHacking'],
  ['wallPunning', 'wallBullMarksFinish'],
  ['gypsumJointFinish', 'gypsumLightCut'],
  ['flutedPanels', 'woodenLightCut'],
  ['toiletKitchenDado', 'toiletFloorTile'],
  // CORRECTION: verified against the PDF screenshots — Alu. window
  // measurements continues the SAME vertical column as the door/window
  // CIVIL chain (doorWindowCorrect -> windowStoneJamb -> aluWindowMeasure ->
  // mainDoorMeasure), a single continuous dashed line — not anchored to
  // wallPunning as originally transcribed.
  ['aluWindowMeasure', 'windowStoneJamb'],
  ['puttyGypsum', 'gypsumJointFinish'],
  ['groutingDado', 'toiletKitchenDado'],
  ['paperSandGypsum', 'puttyGypsum'],
  ['nonElecFloorWiring', 'flutedPanels'],
  ['toiletLedgeStone', 'groutingDado'],
  // CORRECTION: mainDoorMeasure continues the same column as
  // aluWindowMeasure above it (not paperSandGypsum).
  ['mainDoorMeasure', 'aluWindowMeasure'],
  ['basePrimerGypsum', 'paperSandGypsum'],
  ['mirrorMeasure', 'toiletLedgeStone'],

  // Spine continues.
  // CORRECTION: the bottom border of the finishing-section box is itself a
  // 4-way merge (verified in the screenshots) — wallPunning and
  // nonElecFloorWiring also feed internalMarble, not just basePrimerGypsum
  // and mirrorMeasure as originally transcribed.
  ['internalMarble', 'basePrimerGypsum'],
  ['internalMarble', 'mirrorMeasure'],
  ['internalMarble', 'wallPunning'],
  ['internalMarble', 'nonElecFloorWiring'],
  ['modularMeasure', 'internalMarble'],
  ['marblePolish', 'modularMeasure'],
  ['marbleProtect', 'marblePolish'],

  // Final fan-out.
  ['puttyWalls', 'marbleProtect'],
  ['paperSandWalls', 'puttyWalls'],
  ['basePrimerWalls', 'paperSandWalls'],
  // CORRECTION: the erection pair branches off marbleProtect directly (same
  // row as puttyWalls, one step earlier than basePrimerWalls) — verified
  // against the screenshots, not basePrimerWalls as originally transcribed.
  ['mainDoorErection', 'marbleProtect'],
  ['aluWindowErection', 'marbleProtect'],
  ['texturePaints', 'basePrimerWalls'],
  ['modularErection', 'mainDoorErection'],
  // CORRECTION: woodenWallPanel is part of the SAME 3-way split off
  // basePrimerWalls as texturePaints/firstCoatPaint (verified in the
  // screenshots), not downstream of mainDoorErection.
  ['woodenWallPanel', 'basePrimerWalls'],
  // CORRECTION: mirrorMeasure2 sits in the aluWindowErection column
  // (same vertical pairing as modularErection/mainDoorErection), not
  // mainDoorErection's column.
  ['mirrorMeasure2', 'aluWindowErection'],
  ['firstCoatPaint', 'basePrimerWalls'],

  // Final finishing row — all gated on the erections/first coat completing.
  ['wardrobeLights', 'modularErection'],
  ['kitchenCounter', 'modularErection'],
  ['toiletVanity', 'modularErection'],
  ['sanitaryFix', 'modularErection'],
  ['ceilDownLights', 'firstCoatPaint'],
  ['decorLights', 'firstCoatPaint'],
  ['elecSwitchFix', 'firstCoatPaint'],
  ['ceilFanFix', 'firstCoatPaint'],
  // CORRECTION: secondCoatPaint is positioned specifically below
  // elecSwitchFix in the screenshots, not spanning the whole firstCoatPaint
  // row like its siblings.
  ['secondCoatPaint', 'elecSwitchFix'],
  ['finalAcFix', 'secondCoatPaint'],
  // CORRECTION: mirrorFix now follows the second (pre-erection) measurement
  // step directly, its more specific same-trade prerequisite, rather than
  // woodenWallPanel — see TASKS comment on mirrorMeasure2.
  ['mirrorFix', 'mirrorMeasure2'],
  ['plantationWorks', 'drainageMedium'],
];

// ── Stale edges from the pre-screenshot transcription, superseded above ──
// These were inserted by an earlier run of this script based on a flattened-
// text extraction of the PDF; re-verifying against actual screenshots of the
// diagram showed each of these anchors was wrong. Removed explicitly here
// since the normal insert loop below only ever adds — it has no way to
// retract a previously-created edge on its own.
const STALE_EDGES: [string, string][] = [
  ['aluWindowMeasure', 'wallPunning'],
  ['mainDoorMeasure', 'paperSandGypsum'],
  ['mainDoorErection', 'basePrimerWalls'],
  ['aluWindowErection', 'basePrimerWalls'],
  ['woodenWallPanel', 'mainDoorErection'],
  ['mirrorMeasure2', 'mainDoorErection'],
  ['secondCoatPaint', 'firstCoatPaint'],
];

async function seedMoreWorks(projectId: string) {
  for (const w of MORE_WORKS) {
    await prisma.work.upsert({
      where: { code: w.code },
      update: { name: w.name, color: w.color, description: w.description, projectId },
      create: { name: w.name, code: w.code, color: w.color, description: w.description, projectId },
    });
  }
}

async function main() {
  const project = await prisma.project.findFirst({ where: { name: DEMO_PROJECT_NAME } });
  if (!project) throw new Error(`Expected the "${DEMO_PROJECT_NAME}" demo project to already exist.`);

  await seedMoreWorks(project.id);

  const works = await prisma.work.findMany({ select: { id: true, code: true } });
  const workByCode = new Map(works.map((w) => [w.code, w.id]));
  for (const t of TASKS) {
    if (!workByCode.has(t.work)) throw new Error(`Unknown work code "${t.work}" for task "${t.name}"`);
  }

  // Resolve each key to a real HvacTask row: reuse if named, else find-or-create by name.
  const keyToTaskId = new Map<string, string>();
  let createdCount = 0;
  let reusedCount = 0;

  for (const t of TASKS) {
    if (t.reuse) {
      const existing = await prisma.hvacTask.findUnique({ where: { taskId: t.reuse }, select: { id: true } });
      if (!existing) throw new Error(`Expected existing task "${t.reuse}" to reuse for "${t.name}" — not found.`);
      keyToTaskId.set(t.key, existing.id);
      reusedCount++;
      continue;
    }

    const existingByName = await prisma.hvacTask.findFirst({ where: { taskName: t.name }, select: { id: true } });
    if (existingByName) {
      keyToTaskId.set(t.key, existingByName.id);
      reusedCount++;
      continue;
    }

    const workId = workByCode.get(t.work)!;
    const work = await prisma.work.findUnique({ where: { id: workId }, select: { code: true, project: { select: { name: true } } } });
    const taskIdPrefix = work!.code;
    const maxExisting = await prisma.hvacTask.findMany({
      where: { taskId: { startsWith: `${taskIdPrefix}-` } },
      select: { taskId: true },
    });
    const maxNum = maxExisting.reduce((max, r) => {
      const n = parseInt(r.taskId.split('-')[1] ?? '0', 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    const newTaskId = `${taskIdPrefix}-${String(maxNum + 1).padStart(3, '0')}`;

    const created = await prisma.hvacTask.create({
      data: {
        taskId: newTaskId,
        taskName: t.name,
        projectName: work!.project?.name ?? DEMO_PROJECT_NAME,
        workId,
        status: 'draft',
      },
      select: { id: true },
    });

    const templateItems = await prisma.dependencyTemplateItem.findMany();
    if (templateItems.length > 0) {
      await prisma.dependencyItem.createMany({
        data: templateItems.map((ti) => ({ taskId: created.id, category: ti.category, itemLabel: ti.label, sortOrder: ti.sortOrder })),
      });
    }
    await prisma.activityLog.create({ data: { taskId: created.id, actionType: 'task_created', payload: { taskId: newTaskId, source: 'seed-reference-sequence' } } });

    keyToTaskId.set(t.key, created.id);
    createdCount++;
  }

  console.log(`Tasks: ${reusedCount} reused, ${createdCount} newly created, ${TASKS.length} total.`);

  // Remove stale edges from the prior (pre-screenshot) transcription before
  // inserting the corrected ones below.
  let staleRemoved = 0;
  for (const [depKey, prereqKey] of STALE_EDGES) {
    const taskId = keyToTaskId.get(depKey);
    const dependsOnTaskId = keyToTaskId.get(prereqKey);
    if (!taskId || !dependsOnTaskId) continue;
    const { count } = await prisma.taskDependency.deleteMany({ where: { taskId, dependsOnTaskId } });
    staleRemoved += count;
  }
  console.log(`Stale edges removed: ${staleRemoved}`);

  // Resolve edges, run the SAME cycle-detection the interactive UI uses,
  // and insert only new, non-cyclic, non-duplicate edges.
  const existingEdges = await prisma.taskDependency.findMany({ select: { taskId: true, dependsOnTaskId: true } });
  const existingEdgeSet = new Set(existingEdges.map((e) => `${e.taskId}:${e.dependsOnTaskId}`));
  const workingEdges = [...existingEdges];

  let edgesCreated = 0, edgesSkippedDup = 0, edgesSkippedCycle = 0;
  for (const [depKey, prereqKey] of EDGES) {
    const taskId = keyToTaskId.get(depKey);
    const dependsOnTaskId = keyToTaskId.get(prereqKey);
    if (!taskId || !dependsOnTaskId) throw new Error(`Unresolved edge key: ${depKey} -> ${prereqKey}`);
    if (taskId === dependsOnTaskId) continue; // a reused task can legitimately collapse two PDF steps into one

    const dedupeKey = `${taskId}:${dependsOnTaskId}`;
    if (existingEdgeSet.has(dedupeKey)) { edgesSkippedDup++; continue; }

    if (wouldCreateCycle(workingEdges.map((e) => ({ id: e.taskId, dependsOnId: e.dependsOnTaskId })), taskId, dependsOnTaskId)) {
      console.warn(`SKIPPED (would create a cycle): ${depKey} -> ${prereqKey}`);
      edgesSkippedCycle++;
      continue;
    }

    await prisma.taskDependency.create({ data: { taskId, dependsOnTaskId } });
    workingEdges.push({ taskId, dependsOnTaskId });
    existingEdgeSet.add(dedupeKey);
    edgesCreated++;
  }

  console.log(`Edges: ${edgesCreated} created, ${edgesSkippedDup} already existed, ${edgesSkippedCycle} skipped as cycles.`);

  const totalTasks = await prisma.hvacTask.count();
  const totalWorks = await prisma.work.count();
  const totalEdges = await prisma.taskDependency.count();
  console.log(`\nFinal counts — Works: ${totalWorks}, Tasks: ${totalTasks}, TaskDependency edges: ${totalEdges}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
