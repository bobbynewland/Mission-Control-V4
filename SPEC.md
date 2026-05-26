# Mission Control V3 - Technical Design Spec
**Vibe:** Cinematic Business (Luxury + Raw Hip-Hop)
**Stack:** React, Tailwind CSS, Framer Motion, Lucide React, Firebase (winslow-756c3)

## 1. Design Language
- **Color Palette:**
  - Background: `#050505` (Deep Charcoal/Black)
  - Cards: Glassmorphism (RGBA 255, 255, 255, 0.03) with 1px border (`border-white/10`)
  - Accent: `#EAB308` (Gold) or `#A855F7` (Purple) - sparingly for CTA/Active states
  - Text: High-contrast White (`#FFFFFF`) for headers, Muted Gray (`#9CA3AF`) for meta.
- **Typography:**
  - Headers: Bold Sans-Serif (Inter or System UI) with wide tracking.
  - Body: Clean, readable monospace for "data" feel.
- **Spacing:** Generous "air" (Luxury). No clutter.

## 2. Core Components (Mobile-First)

### A. Main Dashboard Shell
- Bottom navigation bar (Mobile focus).
- Safe-area-inset padding for iPhone/Android.
- Header with "Mission Control" and "Active Subscriptions" indicator.

### B. Horizontal Kanban Board
- **Container:** `overflow-x-auto snap-x snap-mandatory flex gap-4`.
- **Columns:** 90vw width cards, snapping to center.
- **Cards:** Touch-friendly drag handles. Use `framer-motion` for smooth layout transitions.
- **States:** Todo, In Progress, Review, Done.

### C. Glass Card Component
- Background-blur: `backdrop-blur-xl`.
- Subtle outer glow on hover.

## 3. Tech Requirements
- **Drag and Drop:** `dnd-kit` with touch-sensor configured for 25px threshold (scroll vs drag).
- **Icons:** `lucide-react` for that sharp, technical look.
- **Animation:** `framer-motion` for page transitions and card status updates.

## 4. Implementation Path
1. `App.js` - Global shell + Navigation.
2. `KanbanBoard.js` - The horizontal scrolling container.
3. `KanbanCard.js` - Individual glassmorphism cards.
4. `FirebaseHook.js` - Real-time sync to the Winslow DB.
