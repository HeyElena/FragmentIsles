# Fragment Isles Design Direction

## Design Intent

Fragment Isles should not feel like a generic admin dashboard. It should feel like a calm, artistic, lightweight research workspace that users can keep open for long periods while reading, thinking, and collecting fragments.

The interface should suggest a world of small connected islands of thought set within a quiet forest workspace: individual fragments are discrete, but relationships, reminders, and summaries gradually create bridges between them.

## Visual Keywords

- fragment islands
- floating paper cards
- soft glass
- forest green
- wood tones
- warm paper background
- research notebook
- dark moss atmosphere
- gentle motion
- subtle bridges between ideas
- calm
- elegant
- lightweight

## Experience Goals

- Make fragmented information feel organized without feeling rigid.
- Preserve a sense of quiet focus rather than operational pressure.
- Keep the UI breathable, with strong spacing and moderate information density.
- Let AI features feel assistive and explicit, not dominant or noisy.
- Support long sessions without visual fatigue.

## Things To Avoid

- Do not make it look like an enterprise admin system.
- Do not rely on dense table-heavy layouts.
- Do not use harsh, highly saturated colors.
- Do not use childish illustrations.
- Do not use flashy or overly complex animation.
- Do not make screens feel crowded.

## Color Direction

Use these as the starting palette:

```css
:root {
  --background: #E4DCCD;
  --surface: rgba(250, 244, 235, 0.76);
  --surface-solid: #F5EFE4;
  --primary: #4E6640;
  --accent: #6E5236;
  --sage: #738149;
  --text: #252B1F;
  --muted: #5F6651;
}
```

Interpretation:

- `--background` is warm paper, slightly darkened from cream toward aged parchment.
- `--primary` is the core forest green and should anchor navigation, emphasis, and brand presence.
- `--accent` is a wood tone, not a pink accent; use it for warmth, depth, and subtle contrast.
- `--sage` supports secondary green variation and environmental depth.
- `--surface` and `--surface-solid` should feel like layered paper resting on a darker forest desk.

## UI Guidance

- Prefer layered cards, panels, and soft surfaces over hard dashboard grids.
- Use spacing and composition to create visual rhythm.
- Let navigation and content areas feel calm and intentional.
- Use translucency carefully; soft glass is an accent, not the whole interface.
- Favor readable typography and notebook-like hierarchy over system-console aesthetics.
- Show future modules as lightweight placeholders when they are out of scope for the current phase.
- The home page should be more minimal than inner pages: mostly product name, tagline, and atmosphere rather than explanatory cards.
- The home page background may be richer and darker than other pages, but any decorative elements should remain subtle and low-contrast.
- Inner pages can return to layered paper cards, but they should still sit within the same forest-and-wood visual family.

## Motion Guidance

- Motion should be gentle and low-amplitude.
- Use motion to support spatial understanding, especially when opening details, revealing relations, or switching work areas.
- Avoid decorative motion that slows down core workflows.
- Background motion, if present, should feel like quiet drifting light or air rather than animated product marketing.

## Product-Specific UX Constraints

- AI actions should visually communicate that they are explicit, user-initiated operations.
- Costly operations should always present a confirmation state before execution.
- Markdown export actions should feel first-class and consistent across modules.
- Timeline, Relations, and Settings should each keep their own identity while still feeling like parts of one quiet research workspace.
- The home page should act like a cover or entry scene, not a busy overview dashboard.

## Design Check

Before shipping a new screen, verify:

1. Does it still feel like Fragment Isles rather than a generic SaaS dashboard?
2. Does it keep the interface light and breathable?
3. Are future modules preserved instead of removed?
4. Are AI actions explicit and visibly controlled?
5. Does the screen support a calm long-session workflow?
