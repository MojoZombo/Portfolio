# Portfolio Site Design & Styling Rules

## UI & Visual Design Constraints

### STRICT RULE: NO BORDERS ON BUTTONS AND SECTIONS
- **NEVER use borders on buttons, cards, section dividers, or modal headers/footers.**
- Do NOT add Tailwind border utility classes to UI elements, including but not limited to:
  - `border`, `border-slate-...`, `border-blue-...`, `border-black/...`, `border-white/...`
  - `border-t`, `border-b`, `border-l`, `border-r`
  - `border-dashed`, `border-dotted`
- This applies to:
  - All buttons (CTA buttons, theme toggles, play/pause controls, fullscreen toggles, close buttons, arrow navigators, external links).
  - All content sections, cards, and containers (Technical Specifications, Engineering Challenges, structured sections, 3D viewport containers, modal titlebars/headers, bottom caption bars).
  - QuickNav floating containers and modals.
- **How to establish visual hierarchy without borders**:
  - Rely exclusively on **background color differentiation and contrast** (e.g., solid surface tones like `dark:bg-[#0c121e]`, elevated cards like `dark:bg-slate-800/60`, headers like `dark:bg-slate-950`).
  - Use whitespace, padding, rounded corners, and subtle typography hierarchy (font weights, muted mono captions).
  - For button hover states, use clean solid color fills (e.g. vibrant blue `#2563eb` / `#3b82f6` with instant color switching) with **zero borders**.
