name: "BugChain - Ready Player One"

description: "A Blockhain based Bug Bounty platform on BOT Chain (escrow)"

colors:

  primary: "#00F0FF"

  secondary: "#FF007F"

  accent: "#FF007F"

  background: "#050010"

  surface: "#E0E0E0"

  text-primary: "#FFFFFF"

  text-secondary: "#A1A1AA"

  border: "#27272A"

typography:

  display-lg:

    fontFamily: "Plus Jakarta Sans"

    fontSize: "64px"

    fontWeight: 700

    lineHeight: "1.08"

    letterSpacing: "-0.02em"

  body-md:

    fontFamily: "Plus Jakarta Sans"

    fontSize: "16px"

    fontWeight: 400

    lineHeight: "1.6"

  label-md:

    fontFamily: "Plus Jakarta Sans"

    fontSize: "12px"

    fontWeight: 600

    lineHeight: "1.2"

spacing:

  base: "8px"

  gap: "16px"

  card-padding: "24px"

  section-padding: "80px"

rounded:

  card: "8px"

  control: "8px"

  pill: "9999px"

components:

  card:

    background: "Use the surface token with subtle borders and HTML-matched shadow depth"

    radius: "Match the declared card radius token"

  button:

    background: "Use primary or accent colors for the main action"

    radius: "Use the control or pill radius based on the source HTML"

---



## Colors

Anchor the palette in primary #00F0FF, secondary #FF007F, accent #FF007F, background #050010, surface #E0E0E0, text-primary #FFFFFF. Keep background, surface, text, and border roles distinct so generated layouts retain the same contrast pattern as the source.



## Typography

Use Plus Jakarta Sans across display moments, body copy, and UI labels for a clean, modern aesthetic. Technical metadata, wallet addresses, and code snippets should fall back to a monospace typeface like JetBrains Mono or Space Mono.



## Layout

Keep spacing deliberate and stable. Favor the same grid direction, max-width behavior, card density, and responsive stacking seen in the HTML. Do not replace distinctive source structures with generic SaaS sections.



## Components

Authentication and CTA controls should preserve the source button hierarchy, input density, and focused conversion path.



## Motion

Preserve existing motion cues such as masked reveals, staggered entrance, hover lift, scroll-triggered transitions, and ambient movement. Keep easing smooth and restrained.



## WebGL & Effects

If the source includes canvas, WebGL, Three.js, gradients, particles, or atmospheric effects, rebuild them as supporting layers behind the content. Keep effects performant, responsive, and secondary to the interface.



## Guardrails

- Do not flatten the source into a generic card grid.

- Do not swap the color mode unless the source clearly supports it.

- Preserve the first viewport signal, focal object, and visual density.

- Keep buttons, cards, and badges aligned to the same radius and border language. 
