---

# 📄 **Environment Variables Setup (Next.js + Django Auth Architecture)**

This project uses **secure HTTP-only cookies**, **Next.js proxy routes**, and **Django JWT authentication**.
Environment variables are required for the frontend to correctly communicate with the backend.

All developers must create a personal `.env.local` file (not committed to Git).

Below is the complete documentation for every environment variable used in development and production.

---

# ⚙️ **1. Create Your Local Env File**

In the project root:

```
cp .env.example .env.local
```

Or manually create:

```
backoffice-frontend/.env.local
```

---

# 🧩 **2. Required Variables**

### **NEXT_PUBLIC_BASE_URL**

```
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**What this does:**
Defines the absolute URL of the Next.js frontend.

This is required because:

* Server Components cannot automatically know the origin.
* Dashboard data fetching uses absolute URLs.

Example usage:

```ts
await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/proxy/sessions`)
```

**Production example:**

```
NEXT_PUBLIC_BASE_URL=https://dashboard.mycompany.com
```

---

### **DJANGO_API_BASE**

```
DJANGO_API_BASE=http://localhost:8000
```

**What this does:**
Defines where backend API calls should be forwarded.

Proxy routes use this to talk to Django securely.

Example:

```ts
await fetch(`${process.env.DJANGO_API_BASE}/api/sessions/`, ...)
```

**Production example:**

```
DJANGO_API_BASE=https://api.mycompany.com
```

---

# 🍪 **3. Token Cookies (Set Server-Side Only)**

These are *not* manually set in `.env.local`.
Instead, they are managed automatically by the login logic.

Server writes:

* `access_token` – short-lived JWT (HttpOnly cookie)
* `refresh_token` – long-lived JWT (HttpOnly cookie)

Stored securely using:

```ts
cookies().set("access_token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
});
```

**Important:**
🛑 They never appear in `.env.local`
🛑 They are never accessible from JavaScript
🟢 They are auto-managed by the Next.js login & refresh routes

---

# 🛡 **4. Why We Use This Architecture**

This environment variable setup supports the authentication flow:

1. Client submits login to **Next.js route**, *not Django*
2. Next.js receives tokens from Django
3. Next.js stores tokens in **secure HTTP-only cookies**
4. Frontend calls protected data via **server-side proxy endpoints**
5. Tokens never appear in browser JavaScript (prevents XSS)
6. Refresh happens automatically when needed

This matches industry standards used by:

* Vercel
* Stripe Dashboard
* Notion
* GitHub
* Many internal enterprise dashboards

---

# 📚 **5. Example `.env.example` (you commit this file)**

```env
# ========================================
# Frontend Environment Example File
# ========================================

# Base URL where this Next.js app runs (required)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Django API base URL (used by proxy routes)
DJANGO_API_BASE=http://localhost:8000

# Add additional variables below as needed...
```

---
