# Frontend Integration Guide: New Navigation Endpoint

## ✅ Update Summary

The backend has been refactored to consolidate 5 redundant navigation endpoints into **1 unified, flexible endpoint**.

---

## 📋 What Changed

### Before (5 separate endpoints)
```typescript
POST /api/sessions/{id}/force-complete/
POST /api/sessions/{id}/reset/
POST /api/sessions/{id}/back-to-credentials/
POST /api/sessions/{id}/back-to-otp/
POST /api/sessions/{id}/restart-kyc/
```

### After (1 unified endpoint)
```typescript
POST /api/sessions/{id}/navigate/
```

---

## 🎯 New Endpoint: `/api/sessions/{uuid}/navigate/`

### Request Body
```json
{
  "target_stage": "case_id|credentials|secret_key|kyc|completed",
  "clear_data": "submission|all|none",  // optional, default: "submission"
  "reason": "optional reason for audit trail"
}
```

### Response (Success)
```json
{
  "status": "session_navigated",
  "message": "Session navigated from credentials to kyc",
  "from_stage": "credentials",
  "to_stage": "kyc",
  "session_status": "active",
  "clear_data_mode": "submission"
}
```

### Response (Error)
```json
{
  "error": "Cannot navigate from 'secret_key' to 'kyc'",
  "current_stage": "secret_key",
  "valid_targets": ["kyc", "credentials", "case_id"]
}
```

---

## 🔄 Stage Transition Rules

The backend enforces these valid stage transitions:

```
┌──────────┐
│ case_id  │
└────┬─────┘
     │
     ├─→ credentials ──┐
                       ├─→ secret_key ──┐
                       │                ├─→ kyc ──┐
     └─────────────────┘                │         ├─→ completed
                                        │         │
     ┌───────────────────────────────────┴─────────┴─→ (reset to case_id)
```

### Detailed Rules

| From | To | Can Navigate? | Notes |
|------|---|---|---|
| case_id | credentials | ✅ Yes | Forward only |
| credentials | secret_key | ✅ Yes | Forward |
| credentials | case_id | ✅ Yes | Reset |
| secret_key | kyc | ✅ Yes | Forward |
| secret_key | credentials | ✅ Yes | Navigate back |
| secret_key | case_id | ✅ Yes | Reset |
| kyc | completed | ✅ Yes | Force complete |
| kyc | secret_key | ✅ Yes | Navigate back |
| kyc | case_id | ✅ Yes | Reset |
| completed | * | ❌ No | Terminal state - cannot modify |
| Any | Any (invalid) | ❌ No | Backend returns valid targets |

---

## 🔧 Frontend Implementation Examples

### 1. Update Action Map in Next.js Route Handler

**File:** `app/api/sessions/[id]/action/route.ts`

```typescript
// OLD (delete these)
const actionMap: Record<string, string> = {
  "force-complete": "force-complete",
  "reset": "reset",
  "back-to-credentials": "back-to-credentials",
  "back-to-otp": "back-to-otp",
  "restart-kyc": "restart-kyc",
  // ... other actions
}

// NEW (replace with single navigate action)
const actionMap: Record<string, string> = {
  // ... other actions ...
  "navigate": "navigate"
}

// Handle navigation action
if (action === "navigate") {
  const { target_stage, clear_data = "submission", reason } = body;

  const res = await fetch(`http://localhost:8000/api/sessions/${id}/navigate/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_stage,
      clear_data,
      reason
    }),
  })
}
```

### 2. Frontend Component - Dropdown Navigation

```tsx
import { useState } from 'react'

interface NavigateProps {
  sessionId: string
  currentStage: string
}

export function SessionNavigate({ sessionId, currentStage }: NavigateProps) {
  const [targetStage, setTargetStage] = useState('')
  const [clearData, setClearData] = useState('submission')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  // Valid targets based on current stage
  const validTargets: Record<string, string[]> = {
    'credentials': ['secret_key', 'case_id'],
    'secret_key': ['kyc', 'credentials', 'case_id'],
    'kyc': ['completed', 'secret_key', 'case_id'],
    'case_id': ['credentials'],
  }

  const handleNavigate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'navigate',
          target_stage: targetStage,
          clear_data: clearData,
          reason: reason || undefined
        })
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('Navigation failed:', data.error)
        alert(`Error: ${data.error}`)
        return
      }

      console.log('Session navigated:', data)
      // Refresh session details
      window.location.reload()
    } finally {
      setLoading(false)
    }
  }

  const availableTargets = validTargets[currentStage] || []

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Navigate To Stage</label>
        <select
          value={targetStage}
          onChange={(e) => setTargetStage(e.target.value)}
          className="mt-1 block w-full rounded border"
          disabled={availableTargets.length === 0}
        >
          <option value="">-- Select Stage --</option>
          {availableTargets.map((stage) => (
            <option key={stage} value={stage}>
              {formatStageName(stage)}
            </option>
          ))}
        </select>
        {availableTargets.length === 0 && (
          <p className="mt-1 text-sm text-red-600">
            Cannot navigate from {currentStage} stage
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Clear Data Mode</label>
        <select
          value={clearData}
          onChange={(e) => setClearData(e.target.value)}
          className="mt-1 block w-full rounded border"
        >
          <option value="submission">Clear current submission only</option>
          <option value="all">Clear all verification data</option>
          <option value="none">Keep all data</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {clearData === 'submission' && 'User must resubmit current stage'}
          {clearData === 'all' && 'All previous verifications will be cleared'}
          {clearData === 'none' && 'All data preserved - user continues from new stage'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium">Reason (Optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 block w-full rounded border"
          rows={2}
          placeholder="e.g., User requested credential re-entry"
        />
      </div>

      <button
        onClick={handleNavigate}
        disabled={!targetStage || loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Navigating...' : 'Navigate Session'}
      </button>
    </div>
  )
}

function formatStageName(stage: string): string {
  const names: Record<string, string> = {
    'case_id': 'Case ID Entry',
    'credentials': 'Login Credentials',
    'secret_key': 'Secret Key',
    'kyc': 'KYC Verification',
    'completed': 'Completed'
  }
  return names[stage] || stage
}
```

### 3. Alternative: Smart Buttons Based on Current Stage

```tsx
export function SessionNavigateButtons({ sessionId, currentStage }: NavigateProps) {
  const handleNavigate = async (targetStage: string, clearMode: string = 'submission') => {
    const res = await fetch(`/api/sessions/${sessionId}/action`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'navigate',
        target_stage: targetStage,
        clear_data: clearMode
      })
    })

    if (res.ok) {
      window.location.reload()
    }
  }

  return (
    <div className="space-y-2">
      {/* Back Navigation */}
      {currentStage === 'secret_key' && (
        <button
          onClick={() => handleNavigate('credentials', 'submission')}
          className="px-4 py-2 bg-yellow-500 text-white rounded"
        >
          ← Back to Credentials
        </button>
      )}

      {currentStage === 'kyc' && (
        <>
          <button
            onClick={() => handleNavigate('secret_key', 'submission')}
            className="px-4 py-2 bg-yellow-500 text-white rounded block w-full"
          >
            ← Back to Secret Key
          </button>
          <button
            onClick={() => handleNavigate('kyc', 'submission')}
            className="px-4 py-2 bg-orange-500 text-white rounded block w-full"
          >
            ↻ Restart KYC
          </button>
        </>
      )}

      {/* Staff-Only Controls */}
      {isStaff && (
        <>
          <button
            onClick={() => handleNavigate('case_id', 'all')}
            className="px-4 py-2 bg-red-600 text-white rounded block w-full"
          >
            🔄 Reset to Start
          </button>
          <button
            onClick={() => handleNavigate('completed', 'none')}
            className="px-4 py-2 bg-green-600 text-white rounded block w-full"
          >
            ✓ Force Complete
          </button>
        </>
      )}
    </div>
  )
}
```

---

## 📊 Data Clearing Modes Explained

### `"submission"` (default)
- **Clears:** `user_data.current_submission` only
- **Keeps:** `user_data.verified_data` (previous approvals)
- **Use when:** User needs to re-submit current stage, but previous stages remain valid
- **Example:** Agent asks user to re-enter password after typo

### `"all"`
- **Clears:** All `user_data` (both `current_submission` and `verified_data`)
- **Keeps:** Session exists, but no verification history
- **Use when:** Complete verification restart needed
- **Example:** Agent uses `reset` to `case_id` stage

### `"none"`
- **Clears:** Nothing
- **Keeps:** All data intact
- **Use when:** Navigating forward without clearing
- **Example:** Agent force-completes session without losing data

---

## 🔐 Permissions & Authorization

### Agents (Non-Staff Users)
- ✅ Can navigate **only their own sessions**
- ❌ Cannot navigate sessions assigned to other agents
- Error: `403 Forbidden`

### Staff Users
- ✅ Can navigate **any session**
- ✅ Can perform any transition (respecting stage rules)

### Session Status Validation
- ✅ Can navigate `active` sessions
- ❌ Cannot navigate `completed` sessions
- ❌ Cannot navigate `terminated` sessions
- Error: `400 Bad Request`

---

## ⚙️ Request/Response Examples

### Example 1: Navigate from credentials to secret_key

**Request:**
```bash
POST /api/sessions/550e8400-e29b-41d4-a716-446655440000/navigate/

{
  "target_stage": "secret_key",
  "clear_data": "submission",
  "reason": "User ready for next stage"
}
```

**Response (200):**
```json
{
  "status": "session_navigated",
  "message": "Session navigated from credentials to secret_key",
  "from_stage": "credentials",
  "to_stage": "secret_key",
  "session_status": "active",
  "clear_data_mode": "submission"
}
```

---

### Example 2: Invalid navigation (error)

**Request:**
```bash
POST /api/sessions/.../navigate/

{
  "target_stage": "credentials",
  "clear_data": "submission"
}
```

**Response (400):**
```json
{
  "error": "Cannot navigate from 'secret_key' to 'credentials'",
  "current_stage": "secret_key",
  "valid_targets": ["kyc", "credentials", "case_id"]
}
```

---

### Example 3: Reset to beginning

**Request:**
```bash
POST /api/sessions/.../navigate/

{
  "target_stage": "case_id",
  "clear_data": "all",
  "reason": "User requested fresh start"
}
```

**Response (200):**
```json
{
  "status": "session_navigated",
  "message": "Session navigated from kyc to case_id",
  "from_stage": "kyc",
  "to_stage": "case_id",
  "session_status": "active",
  "clear_data_mode": "all"
}
```

---

## 📡 WebSocket Notifications

When a session is navigated, the user receives a WebSocket message:

```json
{
  "type": "user_command",
  "command": "navigate",
  "from_stage": "credentials",
  "stage": "secret_key",
  "message": "You have been moved to secret_key stage.",
  "reason": "User ready for next stage"
}
```

The agent/control room also receives:
```json
{
  "type": "control_message",
  "message": "Session ABC123456 navigated to secret_key"
}
```

---

## 🚀 Migration Checklist

- [ ] Update your action route handler to support `navigate` action
- [ ] Update action map to use new `navigate` endpoint
- [ ] Remove old navigation action mappings (force-complete, reset, etc.)
- [ ] Build UI with dropdown or smart buttons showing valid stages
- [ ] Test navigation between all valid stage transitions
- [ ] Test permission enforcement (agent vs staff)
- [ ] Test data clearing modes
- [ ] Test WebSocket notifications
- [ ] Handle error responses with helpful messages
- [ ] Test invalid stage transitions (should return helpful error)

---

## 🤔 FAQ

**Q: What happens if I try an invalid navigation?**
A: Backend returns `400 Bad Request` with `error` and `valid_targets` fields showing what's allowed.

**Q: Can agents navigate sessions they don't own?**
A: No. Non-staff agents get `403 Forbidden`. Staff can navigate any session.

**Q: What's the difference between `submission` and `all` clearing?**
A: `submission` clears only current input. `all` clears all verification history. Use `all` for full resets.

**Q: Can I navigate a completed session?**
A: No. Completed sessions are terminal. Backend returns `400 Bad Request`.

**Q: Do I need to send all three fields in the request?**
A: No. Only `target_stage` is required. `clear_data` defaults to `submission`, and `reason` is optional.

---

## 🆘 Support

For questions or issues, refer to:
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Full architecture details
- [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) - Development patterns

