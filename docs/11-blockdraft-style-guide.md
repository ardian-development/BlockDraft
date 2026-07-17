# BlockDraft Visual Style Guide v1

## Purpose

BlockDraft should feel like a playful, high-energy builder laboratory: quick to understand, confident enough for creators, and technically credible enough for server owners. The reference direction combines the prompt-first, creator-friendly energy associated with Lemonade with the Minecraft-specific proof, gallery, export and community structure visible on BlockGPT. The implementation must remain an independent BlockDraft identity.

Reference review: [Lemonade](https://lemonade.gg/) and [BlockGPT](https://blockgpt.ai/).

## Approved UI direction v2

The current implementation uses a bright cyan/turquoise creator canvas rather than a dark dashboard. The primary surface is a soft cyan gradient, with white text, translucent glass borders, white rounded controls and a large white prompt composer. The 3D result itself may remain dark for contrast and readability. This is an original BlockDraft treatment; it does not use the reference logo, copy or artwork.

## Non-infringement boundary

We may use general UI conventions such as a dark workspace, bright action color, prompt composer, gallery cards, social proof and clear export CTAs. We must not copy either site's logo, wordmark, illustrations, exact screenshots, exact copy, proprietary icons, distinctive character art, exact layout sequence, CSS values or branded terminology. All BlockDraft artwork is original, generated from our own prompts or sourced under a compatible license.

Do not use Minecraft or Roblox logos in the BlockDraft mark. Use neutral block geometry, a blueprint grid and an original monogram instead.

## Brand idea

**Brand promise:** From a rough idea to a usable build plan.

**Design concept:** `Playful Builder Lab` — a calm dark canvas with citrus-like energy used only for actions and progress, plus a block/blueprint visual language for credibility.

**Personality:** inventive, direct, optimistic, practical.

**Avoid:** noisy gamer UI, fake technical jargon, excessive neon, childish mascots, generic “AI magic” claims and a dashboard that looks like an admin panel before the user has created anything.

## Visual hierarchy

1. The primary action is always the prompt composer: “Describe a build”.
2. The second action is seeing the result: a large preview stage with useful metrics.
3. The third action is activation: export, copy command or remix.
4. Gallery, pricing and account features support those actions instead of competing with them.

## Color system

Use semantic roles, not colors tied to a reference site. These values are the initial BlockDraft tokens:

| Token | Hex | Role |
|---|---|---|
| `--bd-ink-950` | `#071014` | page background |
| `--bd-ink-900` | `#0C191D` | top navigation and deep panels |
| `--bd-surface-800` | `#12252A` | cards and work surfaces |
| `--bd-surface-700` | `#193237` | elevated cards and inputs |
| `--bd-paper` | `#F4F7EF` | high-contrast light surfaces |
| `--bd-text` | `#F1F7F1` | primary text on dark surfaces |
| `--bd-muted` | `#9BAEAD` | secondary text |
| `--bd-lime` | `#C9F36A` | primary CTA, selection and progress |
| `--bd-mint` | `#79E4B0` | success and “ready” state |
| `--bd-sky` | `#87D9FF` | informational links and preview metadata |
| `--bd-coral` | `#FF8A70` | warnings, photo mode and destructive emphasis |
| `--bd-border` | `rgba(201,243,106,.18)` | subtle borders |

Rules:

- Lime is an action color, not a full-page background.
- Text contrast must meet WCAG AA; never use muted text for essential instructions.
- Coral is reserved for warnings/errors and must not be used for ordinary decoration.
- Use one strong accent per component; do not combine lime, coral and sky in one button.

## Typography

- UI and body: `Inter`, `ui-sans-serif`, system fallback.
- Display headings: `Space Grotesk` or a bundled open-source equivalent; use only for hero and section headings.
- Body text: 15–16 px, line-height 1.5.
- Label text: 11–12 px, medium weight, sentence case. Avoid all-caps labels except compact status badges.
- Hero heading: clamp 42–76 px, maximum line length 10–12 words.
- Never use more than two font families or more than four weight levels.

## Shape, spacing and depth

- Base spacing unit: 4 px; standard gaps: 8, 12, 16, 24, 32, 48.
- Card radius: 18 px; input radius: 12 px; pill radius: 999 px.
- Borders are 1 px and low contrast. Avoid thick outlines around every element.
- Shadows are broad and soft (`0 24px 80px rgba(0,0,0,.24)`), never hard black drop shadows.
- Use a faint blueprint/grid texture at 3–5% opacity behind hero and preview areas. It must be CSS-generated or original SVG, not copied artwork.
- Use block-shaped accents sparingly: a three-cube motif is enough for the brand mark.

## Logo and icon direction

The BlockDraft mark is an original three-cube or folded-plan symbol. It must work in one color, at 16 px, and without the wordmark. Do not use a Minecraft grass block, pickaxe, creeper or the reference brands' marks.

Icons should be simple 1.75 px outline icons with rounded joins. Use an icon plus text for critical actions; never communicate an error by color alone.

## Page architecture

### Landing page

1. Compact navigation: BlockDraft mark, `Create`, `Gallery`, `How it works`, `Pricing`, login and one primary CTA.
2. Hero split into copy and an interactive prompt card. Show one original generated structure image or a real preview fixture, not a stock Minecraft screenshot.
3. Three proof points: `Prompt → BuildSpec`, `Preview before export`, `Java export ready`.
4. Gallery strip with filters (`Architecture`, `Fantasy`, `Modern`, `Remixable`).
5. Three-step workflow with small diagrams.
6. Trust section: real usage metrics, moderation statement and export compatibility; no invented testimonials.
7. FAQ and final create CTA.

### Create workspace

- Desktop: two-column layout. Left = prompt, photo reference, palette, size and generation state. Right = preview, stats, warnings and export.
- Mobile: prompt first, preview second, export actions sticky at the bottom.
- The empty state should show a short example and one-click starter prompts, not a blank dark rectangle.
- Keep the “Generate” button visually dominant; `Remix`, `Download` and `Copy command` are secondary until a result exists.

### Gallery

- Use a masonry-like grid only for images; use fixed aspect-ratio cards for predictable loading.
- Every card shows title, author, block count, dimensions, materials and `Remix`.
- Hover reveals actions; keyboard focus must reveal the same actions.
- Avoid infinite scroll in the first version; use pagination or “load more” for predictable performance.

## Component specifications

### Primary button

- Background `--bd-lime`, text `--bd-ink-950`, 12 px radius, 48 px minimum height.
- Label uses a verb: `Generate build`, `Create remix`, `Export Java file`.
- Hover: brighten by 6%; active: translate Y by 1 px; disabled: 45% opacity and a reason shown nearby.

### Secondary button

- Transparent or `--bd-surface-700`, 1 px border, `--bd-text` label.
- Use for `Preview`, `Gallery`, `Copy command` and `Cancel`.

### Prompt composer

- Large textarea with an example prompt, character counter and prompt tips below it.
- Include mode chips: `Architecture`, `Photo reference`, `Modular pack`.
- Show expected dimensions, estimated blocks and credit cost before the AI request.

### Preview stage

- Dark elevated canvas with a subtle grid, camera controls and a small `Preview fidelity` badge.
- Stats row: blocks, dimensions, materials and generation time.
- Warnings appear below the preview, not hidden in a tooltip.
- The export CTA remains visible without scrolling on desktop.

### Status and feedback

- Generation states: `Preparing`, `Planning`, `Compiling`, `Ready`, `Needs review`, `Failed`.
- Pair every state with an icon, text and accessible live-region announcement.
- On failure, explain whether the problem was prompt scope, provider error, validation or quota.

## Motion

- Use 150–220 ms transitions for controls.
- Use one subtle “blocks assembling” animation while a build is processing.
- Do not autoplay large 3D camera movements or background videos.
- Respect `prefers-reduced-motion` and provide a static preview.

## Content voice

Short, concrete and creator-oriented:

- Good: “Describe one build. We’ll turn it into a validated blueprint.”
- Good: “Photo reference: hidden sides are inferred.”
- Good: “Large idea? Generate it as a modular pack.”
- Avoid: “Our revolutionary proprietary AI unleashes infinite creativity.”
- Avoid claiming exact reconstruction, universal game compatibility or guaranteed quality.

## Responsive and accessibility requirements

- Support 320 px, 768 px, 1024 px and 1440 px widths.
- Keyboard navigation must cover prompt, palette, preview actions, gallery cards and export.
- Visible focus ring: 2 px `--bd-sky` with 2 px offset.
- Minimum touch target: 44 × 44 px.
- All images require useful alt text; decorative grid art uses empty alt text.
- Do not rely on 3D preview alone: show textual stats and export status.

## Design tokens for implementation

```css
:root {
  --bd-ink-950: #071014;
  --bd-ink-900: #0c191d;
  --bd-surface-800: #12252a;
  --bd-surface-700: #193237;
  --bd-paper: #f4f7ef;
  --bd-text: #f1f7f1;
  --bd-muted: #9baead;
  --bd-lime: #c9f36a;
  --bd-mint: #79e4b0;
  --bd-sky: #87d9ff;
  --bd-coral: #ff8a70;
  --bd-border: rgba(201, 243, 106, .18);
  --bd-radius-card: 18px;
  --bd-radius-control: 12px;
  --bd-shadow-card: 0 24px 80px rgba(0, 0, 0, .24);
}
```

## Acceptance checklist

- The first screen explains the product in under five seconds.
- The prompt composer is the obvious first action.
- A user can reach a generated preview and export without hunting through navigation.
- The page feels energetic through color and motion, not through copied artwork.
- No visual asset, copy block, logo or distinctive layout is reused from Lemonade or BlockGPT.
- All states (empty, loading, ready, warning, error) are designed and accessible.
- Lighthouse performance is protected: lazy-load gallery images and keep 3D preview assets separate from landing-page content.
