# AudioCake — Engineering Dev Log

Append-only journal. One entry per work session.

---

## 2026-05-21 — Phase 0 scaffold

### Done

- Cloned `dudumaluf/audioCake` (empty repo) into `/Users/morpheus/Documents/Apps/AudioCake/audiocake/`.
- Ran `pnpm create next-app@latest .` with: TS, Tailwind v4, App Router, src dir, Turbopack, pnpm. Got Next 16.2.6, React 19.2.4, Tailwind 4.3.0, TypeScript 5.9.3.
- TS strict already on by default.
- Ran `pnpm dlx shadcn@latest init --defaults --pointer --force`. Initialized with `base-nova` preset, neutral palette, `--pointer` for clean button cursors. Created `src/components/ui/button.tsx`, `src/lib/utils.ts`, `components.json`, and wired `src/app/globals.css` with `tw-animate-css` and `shadcn/tailwind.css` imports plus a complete OKLCH palette (light + dark variants).
- Added shadcn components: button, sonner, dialog, dropdown-menu, input, label, resizable, select, separator, slider, switch, toggle, tooltip, card.
- `lucide-react` already pulled in by shadcn.
- Installed Prettier + `prettier-plugin-tailwindcss` + `eslint-config-prettier`. Wrote `.prettierrc`, `.prettierignore`. Added `format` / `format:check` scripts. Wired `prettier` into `eslint.config.mjs`.
- Copied `andrej-karpathy-skills-main/.cursor/rules/karpathy-guidelines.mdc` → `.cursor/rules/`.
- Created `docs/` with all eight seed files (this one + VISION, ROADMAP, ARCHITECTURE, DECISIONS, CHANGELOG, KEYMAP, BROWSER_SUPPORT) and root README.
- Verified `pnpm dev` runs and serves on `http://localhost:3000` (Next 16 + Turbopack ready in 212 ms).

### Notes & surprises

- **Next 16 instead of 15.5**: `create-next-app@latest` installed Next 16. Plan said 15.5. Decided to take 16 — newer, default-Turbopack, fully supported (see ADR-015). The auto-generated `AGENTS.md` notes that Next 16 has breaking changes from training-data Next and advises reading `node_modules/next/dist/docs/` before writing Next-specific code. Will heed this in Phase 1.
- **shadcn flags changed**: `--base-color` is no longer a flag; instead `--preset` or `--defaults` (which picks the `base-nova` preset). The `base-nova` preset writes neutral OKLCH variables. The brand color tokens from the plan (warm amber accent, teal monitor, red record) will be layered on in Phase 1 when we build the actual UI.
- **Default Next scaffold added `AGENTS.md` + `CLAUDE.md`**: left both alone per Karpathy #3 (surgical changes). They contain Next 16 guidance from Vercel.

### Next

- Phase 0 final steps: write root README (in progress), git commit + push, instruct user on Vercel connect.
- Then immediately into Phase 1: dark theme tokens + app shell layout.
