# MealApp - Project Guide

## IMPORTANT: Never delete CLAUDE.md, memory files, or documentation files (docs/THEME.md).

## Tech Stack
- Vue 3 with Composition API
- TypeScript
- Vite (build tool)
- shadcn-vue v1 (UI components)
- Tailwind CSS v4
- Vue Router 4

## Dev Commands
- `npm run dev` - Start dev server with hot reload
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `bash scripts/deploy-frontend.sh` - Deploy frontend to S3/CloudFront (use for all frontend deploys)

## Git Flow
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature branches off develop
- **Always create new commits** — never amend pushed commits
- **Ask before any risky git operation** (force push, rebase, reset, amend) — explain what it does and why before proceeding

## Coding Conventions
- Vue SFCs use `<script setup lang="ts">`
- shadcn-vue components import from `@/components/ui/`
- Path alias: `@` maps to `src/`
- Use `defineProps` and `defineEmits` for component API
- Prefer Composition API (`ref`, `computed`, `watch`) over Options API

## Theme
- Material Theme with seed color `#63A002`
- Source file: `/mnt/c/Users/mr_gr/Documents/material-theme.json`
- Colors use oklch format in CSS variables
- See `docs/THEME.md` for full color reference

## Project Structure
```
src/
  assets/         # CSS and static assets
  components/     # Reusable components
    ui/           # shadcn-vue components
  lib/            # Utilities (utils.ts)
  router/         # Vue Router config
  types/          # TypeScript type definitions
  views/          # Route-level view components
  App.vue         # Root component
  main.ts         # App entry point
```
