# Design Guidelines: DocuChat - Document Q&A Application

## Design Approach
**Reference-Based Approach:** Drawing inspiration from ChatGPT and Claude's conversational interfaces, focusing on clean chat layouts, streaming response animations, and conversational UX patterns.

## Core Design Principles
1. **Conversational Clarity:** Prioritize readability and clear visual distinction between user and AI messages
2. **Progressive Disclosure:** Show document processing status and streaming responses in real-time
3. **Contextual Awareness:** Maintain visible conversation history and document context
4. **Efficient Workflow:** Streamlined document upload with persistent sidebar management

---

## Color Palette

### Light Mode (Primary)
- **Primary:** 213 79% 62% (blue #2563EB) - CTAs, links, active states
- **Secondary:** 215 20% 55% (slate #64748B) - secondary text, borders
- **Background:** 210 40% 98% (light grey #F8FAFC) - main canvas
- **Surface:** 0 0% 100% (white #FFFFFF) - user message bubbles, cards
- **Surface Secondary:** 214 32% 95% (light blue-grey #F1F5F9) - AI message bubbles
- **Text Primary:** 215 28% 17% (dark slate #1E293B) - body text
- **Accent:** 160 84% 39% (emerald #10B981) - success states, document upload indicators

---

## Typography
- **Font Families:** 
  - Primary: Inter (via Google Fonts CDN)
  - Fallback: -apple-system, BlinkMacSystemFont, "SF Pro", system-ui
- **Scale:**
  - Headings: text-2xl font-semibold (sidebar headers, document titles)
  - Body: text-base (chat messages, descriptions)
  - Small: text-sm (timestamps, metadata, status indicators)
  - Tiny: text-xs (file sizes, progress percentages)

---

## Layout System

### Spacing Units
Primary spacing scale: **2, 3, 4, 6, 8, 12, 16, 24** (Tailwind units)
- Component padding: p-4, p-6
- Section spacing: space-y-4, gap-6
- Message bubbles: p-4, mb-4
- Sidebar items: p-3

### Grid Structure
- **Main Layout:** Two-column split
  - Sidebar: 280px fixed width (w-70 or custom)
  - Chat Area: flex-1 (remaining space)
- **Mobile:** Single column, collapsible sidebar

---

## Component Library

### Navigation & Sidebar
- **Document Sidebar:**
  - Fixed left panel with document list
  - Each document card: rounded-lg, border, p-3, with file icon, name, size, upload date
  - Active document: highlighted with primary color border
  - Upload button: prominent at top with accent color
  - Collapse toggle for mobile

### Chat Interface
- **Message Bubbles:**
  - User messages: bg-surface (#FFFFFF), rounded-2xl, p-4, max-w-3xl, ml-auto (right-aligned)
  - AI messages: bg-surface-secondary (#F1F5F9), rounded-2xl, p-4, max-w-3xl (left-aligned)
  - Avatar icons: 8x8 circle for user/AI distinction
  - Timestamps: text-xs, text-secondary, mt-1

- **Streaming Animation:**
  - Typing indicator: three animated dots in AI message bubble
  - Cursor blink effect on actively streaming text
  - Smooth text reveal as tokens arrive

- **Input Area:**
  - Fixed bottom position with backdrop blur
  - Rounded textarea with border, p-3
  - Send button: primary color, rounded-full, p-2
  - Disabled state during streaming (opacity-50)

### Document Upload
- **Upload Zone:**
  - Dashed border, rounded-xl, p-8
  - Drag-and-drop area with hover state (border-primary on dragover)
  - File type icons: PDF, TXT, DOCX with appropriate icons from Heroicons
  - Progress bar: h-2, rounded-full, bg-accent during upload
  - Success checkmark: emerald color upon completion

### Forms & Inputs
- **Text Input:**
  - Border: border-secondary, focus:border-primary
  - Padding: p-3, rounded-lg
  - Background: bg-surface on focus

### Data Display
- **Document Cards:**
  - Compact card layout with file metadata
  - Status badges: rounded-full, px-2, py-1, text-xs
  - Processing: bg-blue-100, text-blue-800
  - Ready: bg-emerald-100, text-emerald-800

### Overlays
- **Loading States:**
  - Skeleton screens for document processing
  - Spinner with primary color for initial loads
  - Inline spinners (text-sm) for in-progress operations

---

## Animations
- **Streaming Text:** Character-by-character reveal with 20ms delay
- **Message Entrance:** Fade-in + slide-up (duration-200, ease-out)
- **Upload Progress:** Smooth bar fill animation
- **Typing Indicator:** Bounce animation on three dots (staggered)
- **Hover States:** Subtle scale-105 on document cards (duration-150)

---

## Responsive Breakpoints
- **Mobile (< 768px):** 
  - Collapsible sidebar (drawer overlay)
  - Full-width message bubbles
  - Stacked upload interface
- **Tablet (768px - 1024px):**
  - Sidebar: 240px width
  - Chat area adjusts proportionally
- **Desktop (> 1024px):**
  - Full two-column layout
  - Max content width: 1400px centered

---

## Accessibility
- Focus states: ring-2 ring-primary ring-offset-2
- Keyboard navigation: arrow keys for message history
- Screen reader labels: aria-label on all interactive elements
- Color contrast: WCAG AA compliant (4.5:1 minimum)
- Skip to chat input link for keyboard users

---

## Images
**No hero images required.** This is a utility-focused application where the chat interface is the primary focus. All visual elements should be functional UI components and icons from Heroicons (document icons, user avatars, upload indicators, etc.).