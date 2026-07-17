# Visual Reconstruction v4

Status: approved successor architecture; implementation requires an image-generation provider  
Date: 2026-07-14

## Why v3 is not the product architecture

A general language model can produce valid explicit coordinates, but semantic correctness varies between calls. More prompt rules merely turn visible defects into rejected generations; they do not reliably synthesize a correct arbitrary 3D subject. Raising the block count also adds cost without guaranteeing shape quality.

The competitor's exported `[x,y,z,material]` list and bottom-up animation do not reveal how the list was created. It may have been expanded from a compact internal representation, reconstructed from an image, generated from cached assets or produced by a specialized model.

## New canonical pipeline

```text
prompt or uploaded photo
  -> visual design brief
  -> one consistent orthographic 2x2 reference sheet
     (front, right, back, top; flat background; exact palette)
  -> background removal and view registration
  -> CPU visual-hull reconstruction on a 24-32 voxel grid
  -> surface-colour projection from the reference views
  -> connectivity, thin-part and cavity repair
  -> Minecraft palette quantization
  -> deterministic quality scoring
  -> explicit [x,y,z,material] list
  -> preview and export
```

This is a new generator, not another subject template and not a patch to direct-coordinate generation.

## Components

1. **Reference-sheet provider adapter**: requests all orthographic views in one image so style, proportions and colours remain consistent. An uploaded image can be used as the front view, but missing views must still be synthesized for a true 3D result.
2. **Sheet parser**: crops four fixed cells, removes the plain background using border-connected colour distance, centers each silhouette and normalizes scale.
3. **Visual-hull engine**: starts with a bounded voxel volume and removes voxels that fall outside any supplied silhouette. This runs deterministically on CPU and has no per-voxel AI cost.
4. **Surface painter**: visible surface voxels sample colours from the closest orthographic view. Conflicts are blended by view confidence, then mapped to a safe Minecraft palette.
5. **Geometry repair**: retains the main six-neighbour component, bridges one-voxel gaps, preserves thin features with conservative dilation and removes isolated noise.
6. **Quality gate**: compares re-rendered silhouettes and colours against every source view. A result is accepted only when intersection-over-union, colour coverage and connectivity pass defined thresholds.

## Acceptance thresholds

- Silhouette IoU per supplied view: target `>= 0.88`, hard reject `< 0.80`.
- Requested-colour pixel coverage preserved within `±15%` after palette mapping.
- One main six-neighbour component; repaired bridges are reported.
- No surface component smaller than two voxels unless it is a validated focal feature.
- Maximum `5,000` occupied voxels after reconstruction.
- Same input sheet, settings and compiler version produce the same voxel output.

## Hardware and cost reality

The current development machine has a GTX 1650 with 4 GB VRAM, an i5-3570 and 32 GB RAM. It can run the image-processing and voxel-reconstruction stages locally, but not modern high-quality multi-view diffusion or large image-to-3D models at practical speed. Therefore only the reference-sheet generation needs a hosted AI call; reconstruction, validation, preview and export remain local and deterministic.

## Migration

- Keep ExplicitVoxelSpec v3 as the canonical output/export format.
- Replace the Gemini coordinate generator behind `/api/generate` with a `ReferenceSheetProvider` and local reconstruction worker.
- Retain direct-coordinate v3 only as a benchmark/debug route, disabled in production.
- Do not launch paid “unlimited” plans until measured image-generation cost, success rate and repair rate establish safe unit economics.
