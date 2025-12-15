# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16 backoffice dashboard frontend for managing sessions and user verification workflows. It communicates with a Django backend via secure HTTP-only cookies and includes real-time updates via WebSocket.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Type checking
npx tsc --noEmit
```

## Architecture Overview

### Authentication Flow

The application uses a **secure backend-driven authentication pattern**:

1. **Login Route** (`/api/auth/login`) - Client sends credentials to Next.js route (not directly to Django)
2. **Token Exchange** - Next.js receives JWT tokens from Django backend
3. **Cookie Storage** - Tokens stored as **HttpOnly, Secure, SameSite cookies** (inaccessible to JavaScript)
4. **Token Refresh** (`/api/auth/refresh`) - Automatic refresh when access token expires
5. **Protected Routes** - Middleware redirects unauthenticated users to `/login`

**Key Files:**
- [middleware.ts](middleware.ts) - Lightweight edge middleware for route protection (checks for auth cookies only, delegates validation to routes)
- [src/app/api/auth/](src/app/api/auth/) - Authentication API routes (login, refresh)
- [src/lib/api.ts](src/lib/api.ts) - Client fetch wrapper that handles 401 responses and automatic token refresh

### Proxy Architecture

All API calls to Django are routed through Next.js proxy endpoints:

```
Client → /api/proxy/* → Django Backend
```

**Benefits:**
- Tokens stay server-side (never exposed to client)
- CORS handled transparently
- Can modify requests/responses server-side

**Proxy Routes:** [src/app/api/proxy/](src/app/api/proxy/) - Each endpoint mirrors Django routes (sessions, generate-case-id, health, etc.)

### Real-Time Updates (WebSocket)

The app maintains a WebSocket connection for real-time session updates.

**Key Files:**
- [src/lib/ws/socket.ts](src/lib/ws/) - WebSocket client that handles reconnection and message dispatch
- [src/lib/ws/events.ts](src/lib/ws/) - Event type definitions (session_created, session_updated, session_deleted, etc.)
- [src/lib/stores/sessionStore.ts](src/lib/stores/sessionStore.ts) - Zustand store that subscribes to WebSocket and manages session state

**Message Types Handled:**
- `broadcast`: session_created, session_updated, session_deleted
- `user_status`: credentials_submitted, secret_key_submitted, kyc_submitted
- `verified_data`: agent approval events

### State Management

Uses **Zustand** for client state:

- **sessionStore** - Session list and detailed session data with automatic WebSocket subscription
- Single source of truth, minimal external API calls due to WebSocket updates

## Environment Configuration

All environment variables are required and documented in [README.md](README.md):

- `NEXT_PUBLIC_BASE_URL` - Frontend URL (required for server components)
- `DJANGO_API_BASE` - Backend Django API URL

Create `.env.local` from `.env.example` before development.

## Styling & UI

This project uses **shadcn/ui** for all UI components. shadcn/ui provides pre-styled, accessible components built on top of Radix UI primitives with Tailwind CSS styling.

**Configuration** ([components.json](components.json)):
- Style variant: "new-york" (modern, refined aesthetic)
- React Server Components (RSC) enabled
- Icon library: Lucide React
- Theme system: `next-themes` for dark/light mode switching
- Color palette: Zinc (neutral) with CSS custom properties for theming

**Installed Components** (27 total in [src/components/ui/](src/components/ui/)):
Button, Input, Textarea, Select, Checkbox, Radio Group, Dialog, Alert Dialog, Dropdown Menu, Sheet, Tabs, Card, Badge, Avatar, Breadcrumb, Collapsible, Scroll Area, Separator, Skeleton, Table, Tooltip, Sonner (toasts), and more.

**Adding New Components**:
```bash
npx shadcn@latest add [component-name]
```

This CLI command automatically:
- Downloads the component to `src/components/ui/`
- Installs required Radix UI dependencies
- Applies the correct configuration and styling

**Component Organization**:
- `src/components/ui/` - shadcn/ui managed components (auto-installed)
- `src/components/` - Custom project components (features, layouts, etc.)

**Styling Utilities**:
- `cn()` helper in `src/lib/utils.ts` - Merges Tailwind classes intelligently
- CVA (class-variance-authority) - Used for component variants
- Tailwind CSS v4 with PostCSS

## Key Routes & Pages

- `/login` - Authentication page
- `/dashboard` - Main session list dashboard
- `/dashboard/sessions/[id]` - Session details page
- `/api/auth/*` - Auth endpoints (login, refresh)
- `/api/proxy/*` - Django API proxy routes

## Code Patterns

### shadcn/ui Component Usage

```tsx
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// Standard usage with variants
<Button variant="destructive" size="lg">Delete</Button>
<Button variant="outline" size="sm">Cancel</Button>

// Conditional styling with cn() utility
<div className={cn("base-classes", isActive && "active-state")}>Content</div>

// Dialog component
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
    </DialogHeader>
  </DialogContent>
</Dialog>

// Toast notifications via Sonner
import { toast } from "sonner"
toast.success("Operation successful")
toast.error("Something went wrong")
```

### API Calls with Auto-Refresh

```typescript
// Use apiFetch instead of raw fetch to handle token refresh
const response = await apiFetch("/api/proxy/sessions");
if (response?.ok) {
  const data = await response.json();
}
```

### WebSocket Subscription

The session store automatically subscribes to WebSocket events. Components subscribe to store updates:

```typescript
const sessions = sessionStore(state => state.sessions);
```

## Important Notes

- **No direct Django calls from client** - All API calls go through Next.js proxy routes
- **Token refresh is automatic** - Handled by `apiFetch` wrapper and `/api/auth/refresh` route
- **Middleware is lightweight** - Only checks for cookie presence, delegates token validation to routes
- **WebSocket handles real-time sync** - Preferred over polling for session updates
- **Type safety** - Full TypeScript with strict mode enabled
- **React 19** with React Compiler enabled in Next.js config
