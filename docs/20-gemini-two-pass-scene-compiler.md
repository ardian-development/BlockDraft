# Gemini two-pass scene compiler

The active MVP pipeline is Gemini-only and intentionally does not ask Gemini to emit thousands of voxel coordinates.

1. **Brief pass** (`GEMINI_PROMPT_MODEL`, normally `gemini-3.1-flash-lite`) converts the user prompt into a concise subject, silhouette, palette, focal features, orientation and build constraints.
2. **Part-plan pass** (`GEMINI_VOXEL_MODEL`, normally `gemini-3-flash-preview`) returns 4–24 semantic parts such as body, head, beak, eyes, roof or windows. Each part has a primitive, integer center/size and material role.
3. **Local compiler** expands those parts into boxes, ellipsoids, cylinders, cones and wedges. It applies role-aware materials, bounds, hollow rules, deterministic ordering and the 5,000-block cap.
4. **Validator** enforces allowed blocks, connectivity, requested-color coverage and focal-feature checks, then emits canonical ExplicitVoxelSpec v3 and `.mcfunction` output.

This separation is the key quality control: Gemini is used for semantic interpretation, while repeatable geometry and safety constraints stay local. A failed validation triggers one fresh part-plan attempt. No fal.ai, OpenAI or image-generation API is required for the current text-to-voxel MVP.

The part plan is deliberately compact so costs stay predictable. It is not a guarantee that every arbitrary organic object is perfect; uncommon silhouettes may need a later reference-image or multi-view mode. The current API exposes `pipeline`, `scenePlan.partCount`, `optimization` and `qualityReport` so failures can be measured instead of hidden.
