---
name: frontend-skill
description: Create visually strong landing pages, websites, apps, prototypes, demos, and game UIs using deliberate art direction, restrained composition, strong imagery, and tasteful motion. Use for frontend visual design and implementation, rather than backend-only work.
---

# Frontend Skill

Ship interfaces that feel deliberate, premium, and current: one big idea, strong imagery, sparse copy, rigorous spacing, and a small number of memorable motions. Apply these defaults within the user's brief and any established product design system.

## Working Model

Before building, write three things:

- **Visual thesis:** one sentence describing mood, material, and energy.
- **Content plan:** hero, support, detail, final CTA for landing pages; workspace, navigation, and secondary context for apps.
- **Interaction thesis:** two or three motion ideas that change the feel of the interface.

Each section gets one job, one dominant visual idea, and one primary takeaway or action.

## Beautiful Defaults

- Start with composition, not components.
- Prefer a full-bleed hero or full-canvas visual anchor for visually led pages.
- Make the brand or product name the loudest text on branded pages.
- Keep copy short enough to scan in seconds.
- Use whitespace, alignment, scale, cropping, and contrast before adding chrome.
- Limit the system to two typefaces and one accent color by default.
- Default to cardless layouts: sections, columns, dividers, lists, and media blocks.
- Treat a landing page's first viewport as a poster.

## Landing Pages

Default sequence:

1. **Hero:** brand or product, promise, CTA, and one dominant visual.
2. **Support:** one concrete feature, offer, or proof point.
3. **Detail:** atmosphere, workflow, product depth, or story.
4. **Final CTA:** convert, start, visit, or contact.

### Hero composition

- Use one composition with a full-bleed image or dominant visual plane.
- On branded landing pages, the hero itself runs edge-to-edge with no inherited page gutters, framed container, or shared max-width. Constrain only the inner text/action column.
- Establish hierarchy in this order: brand, headline, body, CTA.
- Avoid hero cards, stat strips, logo clouds, pill soup, and floating dashboards by default.
- Keep headlines to roughly two or three lines on desktop and readable in one glance on mobile.
- Keep the text column narrow and anchored to a calm area of the image.
- Maintain strong contrast over imagery and clear tap targets.
- Avoid split-screen heroes unless the text sits on a calm, unified side.

If the first viewport still works after removing the image, the image is too weak. If the brand disappears after hiding the navigation, the hierarchy is too weak.

### Viewport budget

A sticky or fixed header counts against the hero. Combined header and hero content must fit within the initial viewport at common desktop and mobile sizes. For `100vh` or `100svh` heroes, subtract persistent chrome with `calc(100svh - var(--header-height))`, or overlay the header instead of stacking it in normal flow.

## Apps and Operational Workspaces

Default to Linear-style restraint: calm surface hierarchy, strong typography and spacing, few colors, dense but readable information, and minimal chrome. Use cards when the card itself is the interaction.

Organize around a primary workspace, navigation, secondary context or inspector, and one clear accent for action or state.

Avoid dashboard-card mosaics, thick borders on every region, decorative gradients behind routine product UI, competing accent colors, and ornamental icons that do not improve scanning. If a panel can become plain layout without losing meaning, remove the card treatment.

### Utility copy

- Prioritize orientation, status, and action over promise, mood, or brand voice.
- Start with the working surface: KPIs, charts, filters, tables, status, or task context. Do not introduce a hero unless explicitly requested.
- Headings state what an area is or what users can do: "Selected KPIs", "Plan status", "Search metrics", "Top segments", "Last sync".
- Supporting text explains scope, behavior, freshness, or decision value in one sentence.
- Avoid aspirational hero lines, metaphors, campaign language, and executive-summary banners unless requested.
- Rewrite homepage or ad language as product UI. Remove sections that do not help users operate, monitor, or decide.

An operator scanning only headings, labels, and numbers should understand the page immediately.

## Imagery

Imagery must do narrative work. Use at least one strong, real-looking image for brands, venues, editorial pages, and lifestyle products.

- Prefer in-situ photography over abstract gradients or fake 3D objects.
- Choose or crop images with a stable tonal area for text.
- Avoid embedded signage, logos, or typographic clutter fighting the UI.
- Do not generate images with built-in UI frames, splits, cards, or panels.
- Use multiple images for multiple moments, rather than a collage.

A visually led first viewport needs a real visual anchor; decorative texture is insufficient.

## Copy

- Write in product language. Keep prompt language and design commentary out of the UI.
- Let the headline carry the meaning; supporting copy should usually be one short sentence.
- Cut repetition. Give every section one responsibility: explain, prove, deepen, or convert.
- If deleting 30 percent of the copy improves the page, keep deleting.

## Motion

For visually led work, ship two or three intentional motions:

- One entrance sequence in the hero.
- One scroll-linked, sticky, or depth effect.
- One hover, reveal, or layout transition that sharpens affordance.

Prefer Framer Motion when available for section reveals, shared layout transitions, scroll-linked opacity/translation/scale, sticky storytelling, narrative carousels, menus, drawers, and modal presence. Use the existing stack when it already provides an appropriate motion system.

Motion should be noticeable in a quick recording, smooth on mobile, fast, restrained, and consistent. Remove effects that are ornamental only. Honor reduced-motion preferences and keep content and controls usable without animation.

## Reject These Failures

- Generic SaaS card grids as the first impression.
- Hero cards or boxed, center-column heroes when the brief calls for full bleed.
- Beautiful images with weak brand presence, or headlines that overpower the brand.
- Strong headlines without a clear action.
- Busy imagery behind text.
- More than one dominant idea per section, or many tiny UI devices needed to explain it.
- Sections repeating the same mood statement or carrying filler copy.
- Carousels with no narrative purpose.
- App UI made of stacked cards instead of layout.
- More than two typefaces without a clear reason, or more than one accent color without an established product system.

## Litmus Checks

Inspect the implemented interface at desktop and mobile sizes:

- Is the brand or product unmistakable in the first screen?
- Does visually led work have one strong visual anchor?
- Can headings alone communicate the page?
- Does each section have one job?
- Are cards actually necessary?
- Does motion improve hierarchy or atmosphere?
- Would the design still feel premium with decorative shadows removed?
- Does the header and hero fit the initial viewport, with readable text and reachable actions?
