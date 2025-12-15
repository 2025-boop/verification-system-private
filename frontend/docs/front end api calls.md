Now that the proxy + authentication + cookies are working, your frontend API calls will work like this:

const res = await apiFetch("/api/proxy/test");
const data = await res.json();
console.log("Result:", data);


And apiFetch() will automatically:

Retry on 401

Refresh token

Retry again

Only fail if refresh is invalid

Meaning your dashboard can now safely query any protected Django endpoint.




High-level architecture (why this)

We use the industry-recommended flow for SPAs talking to a JWT-auth backend:

Client (browser) submits credentials to Next.js API route (/api/auth/login) — not directly to Django.
Why? It lets the server set secure HTTP-only cookies, centralizes token handling, and prevents leaking secrets to the browser.

Next.js API route calls Django POST /api/auth/login/ and receives access + refresh.

Next.js sets HTTP-only cookies:

refresh cookie (httpOnly, secure, SameSite=lax) — long-lived

access cookie (httpOnly, secure, short-lived) — short-lived

Why cookies? HTTP-only cookies cannot be read by JS, protecting tokens from XSS. Short-lived access + refresh rotation reduces exposure.

For protected data, the browser calls Next.js API routes (e.g. /api/proxy/user) which run on server and forward request to Django with Authorization: Bearer <access> header assembled from cookies.
Why proxy? The browser never manually handles tokens; server inserts Authorization header.

When access expires, Next.js API /api/auth/refresh uses the refresh cookie to get a new access from Django and updates the access cookie.

We protect pages (e.g., /dashboard) by server-side checking in middleware or by using server components that call a Next.js /api/auth/me route that returns the current user.