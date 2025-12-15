# End-User Frontend Integration Guide: WebSocket Security Update

**Priority:** CRITICAL / BLOCKING
**Context:** We have deployed a major security patch to prevent data isolation leaks. The "Anonymous" WebSocket endpoints are now locked down and verify a "Guest Token".

---

## 1. Check Your Current Implementation (Audit)

Before making changes, verify where your current logic resides:

### A. API Response Handling
Locate the function where you call the backend endpoint:
`POST /api/verify-case/`
*   **Check:** Currently, you are likely only extracting `status`, `uuid`, and `next_step` from the JSON response.

### B. WebSocket Connection
Locate where you initialize the WebSocket connection.
*   **Check:** Your connection URL likely looks like this:
    `ws://<API_URL>/ws/session/<uuid>/`
    *(Without any query parameters or headers)*

---

## 2. What We Updated (Backend)

To secure user data, we moved from an "Open Access" model to a "Token-Based" model.

1.  **Guest Token Generation**: When a user successfully submits a valid Case ID to `/api/verify-case/`, the backend now explicitly generates a secure, short-lived **Guest JWT** (JSON Web Token).
2.  **Strict Enforcement**: The WebSocket endpoint `/ws/session/<uuid>/` now **Rejects** any connection that does not provide this token.
3.  **Isolation**: This token is cryptographically bound to the specific `uuid`. A user cannot use a token from Session A to spy on Session B.

---

## 3. Required Updates (Action Items)

Please implement the following changes immediately to restore connectivity.

### Step 1: Capture the Guest Token
Update your API handler for `POST /api/verify-case/`. The backend response schema has changed:

**Previous Response:**
```json
{
  "status": "verified",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "next_step": "credentials"
}
```

**New Response:**
```json
{
  "status": "verified",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "token": "eyJh...<LONG_JWT_STRING>...",  <-- NEW FIELD
  "next_step": "credentials"
}
```

**Action:**
-   Update your success handler to **extract and store** this `token` (e.g., in React State, Context, or SessionStorage).

### Step 2: Pass Token to WebSocket
Update your WebSocket connection URL to include the token as a query parameter.

**Old Code (Example):**
```javascript
const wsUrl = `${API_BASE}/ws/session/${uuid}/`;
const socket = new WebSocket(wsUrl);
```

**New Code (Example):**
```javascript
// Ensure token is present
if (!token) {
    console.error("Missing Guest Token");
    return;
}

// Append token to query string
const wsUrl = `${API_BASE}/ws/session/${uuid}/?token=${encodeURIComponent(token)}`;
const socket = new WebSocket(wsUrl);
```

### Step 3: Handle Disconnections
If the token expires or is invalid, the backend will close the connection with specific codes.

-   **Close Code `4003`**: Unauthorized / Invalid Token.
    -   *Recommended Action:* Redirect user back to the "Enter Case ID" screen to re-verify.

---

## 6. Troubleshooting & Validation

If you see the following errors in the Backend Logs, it means the **Frontend is not passing the token correctly**:

```log
[JWT Auth] No token found in cookies or query parameters
[SessionConsumer] ⛔ Unauthorized access attempt to <UUID>
WSREJECT /ws/session/<UUID>/
```

**Solution:**
1.  Check the Network Tab in Chrome DevTools.
2.  Find the WebSocket request (Filter by `WS`).
3.  Verify the URL ends with `?token=eyJh...`.

**Scenario 2: "It redirects to credentials, but WebSocket fails"**

*   **Symptoms**: You see the Credentials page, but the "Connecting..." spinner never stops, or you get `[Socket] ⚠️ No token provided` in the browser console.
*   **Cause**: **Race Condition**. The `WebSocketProvider` is initializing *before* your state manager (Redux/Zustand/Context) has finished saving the token.
*   **Fix**: Ensure your WebSocket component **waits** for the token.

```javascript
// BAD: Initializing immediately
useEffect(() => {
  connect(); // Token might be null!
}, []);

// GOOD: Wait for token
useEffect(() => {
  if (guestToken) {
    connect(guestToken);
  }
}, [guestToken]);
```

## 4. Environment Configuration

Ensure your frontend application is configured to point to the correct backend endpoints.

### Required Environment Variables

| Variable | Value (Example) | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com/api` | **Must end with `/api`**. Used for REST calls. |
| `NEXT_PUBLIC_WS_URL` | `wss://api.yourdomain.com` | **No path suffix**. Used for WebSocket connection. |

### Important Notes
-   **CORS**: The backend is configured to allow requests from your specific domain. If you change domains, please notify the backend team to update the `CORS_ALLOWED_ORIGINS` whitelist.
-   **SSL/TLS**: Produciton environments MUST use `https://` and `wss://`.
