# Why it worked Locally vs. Production

The Dockerfile is fine! Here is the real reason:

## 1. Local Development (No Traefik)
When you run locally (`localhost:3000`), your browser talks directly to **Next.js**.
*   Request: `/api/auth/login`
*   **Next.js** sees it, recognizes it has a handler (`route.ts`), and runs it.
*   **Success**.

## 2. Production (With Traefik)
Traefik sits in front of everything. It's the traffic cop.
*   Request: `/api/auth/login`
*   Traefik looks at its list of rules.
*   It sees the Backend has a rule: "Anything starting with `/api` goes to Backend".
*   It sends the request **Straight to Django**, skipping Next.js completely.

## The "405" Error
*   Your browser sends a **POST** to `/api/auth/login` (without a trailing slash).
*   Django (Backend) receives it. Django is strict: "I only know `/api/auth/login/` (with slash)".
*   Django redirects (301) to the slashed version.
*   **Browser Behavior**: When redirected, browsers often switch **POST** to **GET**.
*   Django receives **GET** `/api/auth/login/`.
*   Django Login View says: "I only accept POST. **405 Method Not Allowed**."

## The Fix: "Split Routing"
We need to tell Traefik:
*"If the path is `/api/auth` or `/api/proxy`, send it to **Frontend** (Next.js) FIRST."*

This restores the local behavior where Next.js handles the login logic.
