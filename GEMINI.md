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

### STRICT RULE: DISCOURAGE DROP SHADOWS
- **Avoid drop shadows on UI elements, buttons, cards, containers, and images.**
- Do NOT add prominent Tailwind shadow utility classes (e.g., `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`).
- Maintain a clean, flat, high-precision aesthetic. Visual separation, hierarchy, and depth must be established through:
  - **Color differentiation & contrast** (e.g., solid surface tones, elevated backgrounds, vibrant accent fills).
  - Clean whitespace, padding, rounded corners, and typography hierarchy.
- For buttons and controls that need to stand out or "pop", rely purely on **bold, high-contrast solid color fills** (e.g., brand blue fills like `bg-blue-600 dark:bg-blue-500` with crisp white icons/text), never artificial drop shadows or borders.
