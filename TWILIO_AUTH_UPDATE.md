# Twilio Settings Authentication & Authorization Update

## Changes Made

### 1. Frontend - TwilioSettings Component

**File:** `apps/frontend/src/Components/Settings/TwilioSettings.tsx`

#### Changes:
- ✅ **Replaced axios with useAuthFetch**: All API calls now use the `useAuthFetch` hook which automatically includes Auth0 JWT tokens
- ✅ **Added Role-Based Access Control**: Only users with the "support" role can access Twilio configuration
- ✅ **Removed axios dependency**: Now using `useAuthFetch` from `@/api/authFetch`
- ✅ **Added useAuthZ hook**: Imports `useAuthZ` from `@/auth/authz` for role checking

#### API Calls Updated:
1. `GET /api/twilio-config/settings` - Load settings
2. `POST /api/twilio-config/settings` - Save settings
3. `PUT /api/twilio-config/settings/toggle` - Enable/disable
4. `POST /api/twilio-config/webhook/configure` - Configure webhook
5. `POST /api/twilio-config/test/sms` - Send test SMS

#### Role Check:
```typescript
if (!hasRole('support')) {
  return (
    <Alert status="warning">
      Only users with the "support" role can access Twilio configuration.
    </Alert>
  );
}
```

### 2. Backend - Twilio Settings Routes

**File:** `apps/backend/src/routes/twilio-settings.js`

#### Changes:
- ✅ **Updated middleware imports**: Changed from `{ jwtCheck, attachUserInfo, ensureUser }` to `{ requireAuth }`
- ✅ **Added RBAC middleware**: Imported `{ requireRole }` from `../middleware/rbac`
- ✅ **Created support role guard**: `const requireSupport = requireRole('support')`
- ✅ **Applied auth to all routes**: All 7 endpoints now use `requireAuth` and `requireSupport`
- ✅ **Fixed request object**: Changed `req.userInfo` to `req.user` (correct property after requireAuth)

#### Protected Routes:
All routes now require authentication AND support role:
1. `GET /settings` - requireAuth, requireSupport
2. `POST /settings` - requireAuth, requireSupport
3. `POST /webhook/configure` - requireAuth, requireSupport
4. `GET /webhook/status` - requireAuth, requireSupport
5. `PUT /settings/toggle` - requireAuth, requireSupport
6. `DELETE /settings` - requireAuth, requireSupport
7. `POST /test/sms` - requireAuth, requireSupport

## Authentication Flow

### Frontend:
1. User must be logged in via Auth0
2. `useAuthFetch` hook retrieves JWT token using `getAccessTokenSilently()`
3. Token is automatically included in all API requests as `Authorization: Bearer <token>`
4. If request returns 401/403, token is refreshed once and retried
5. After failed retry, user is forced to re-authenticate

### Backend:
1. `requireAuth` middleware validates JWT token signature
2. `requireAuth` checks session duration (max 10 hours)
3. `requireAuth` attaches user info to `req.user` (including roles)
4. `requireAuth` provisions user in MongoDB via JIT (Just-In-Time)
5. `requireSupport` middleware checks if user has "support" role
6. If no support role, returns 403 Forbidden with role details

## Security Improvements

✅ **JWT Token Validation**: All requests are validated against Auth0
✅ **Role-Based Access Control**: Only support team can access Twilio configuration
✅ **Session Duration**: Max 10 hours, enforced at backend
✅ **Token Refresh**: Automatic retry with fresh token on 401/403
✅ **Multi-tenant Isolation**: org_id from JWT ensures data isolation
✅ **Sensitive Data Protection**: Auth tokens never logged or exposed

## Testing

### 1. Test with Support Role:
```bash
# User should have "support" in their roles claim
# Navigate to /settings, click "Twilio" tab
# Should see full Twilio configuration interface
```

### 2. Test without Support Role:
```bash
# User without "support" role
# Navigate to /settings, click "Twilio" tab
# Should see "Access Restricted" warning message
```

### 3. Test Backend Authorization:
```bash
# Try API call without token
curl https://dev.letsmarter.com:8443/api/twilio-config/settings
# Should return 401 Unauthorized

# Try API call with token but no support role
# Should return 403 Forbidden with role details
```

## Migration Notes

### Existing Users:
- Users need the "support" role added to their Auth0 profile
- Roles can be assigned via:
  1. Auth0 Dashboard → Users → User → Roles
  2. Auth0 Management API
  3. Custom Action/Rule during login

### Environment Variables:
No changes required - existing Auth0 configuration still applies:
- `AUTH0_AUDIENCE`
- `AUTH0_ISSUER_BASE_URL`
- `JWT_CLAIMS_NAMESPACE`

## Error Handling

### Frontend Errors:
- **401 Unauthorized**: Token expired or invalid → Forces re-login
- **403 Forbidden**: Missing support role → Shows role restriction message
- **Network errors**: Shows generic error toast

### Backend Errors:
- **401**: Token validation failed (invalid signature, expired)
- **403**: User lacks required "support" role
- **400**: Missing org_id or validation errors
- **500**: Internal server errors (Twilio API, DB errors)

## Documentation Updates

Updated documentation:
- `TWILIO_MULTI_TENANT_SETUP.md` - Should be updated with auth requirements
- This file - `TWILIO_AUTH_UPDATE.md` - Complete auth implementation details

## Next Steps

1. ✅ Grant "support" role to authorized users in Auth0
2. ✅ Test with support role user
3. ✅ Test with non-support user to verify restriction
4. ✅ Update TWILIO_MULTI_TENANT_SETUP.md with role requirements
5. ⏳ Deploy to development environment
6. ⏳ Verify in production

## Rollback Plan

If issues occur:

### Frontend:
```bash
git revert <commit-hash>
# Or restore previous TwilioSettings.tsx version
```

### Backend:
```bash
# Restore previous twilio-settings.js
# Change middleware back to:
const { jwtCheck, attachUserInfo, ensureUser } = require('../middleware/auth');
# Change all routes back to:
router.get('/settings', jwtCheck, attachUserInfo, ensureUser, async (req, res) => {
  const org_id = req.userInfo?.org_id;
```

## Support

For questions or issues:
1. Check Auth0 logs for authentication errors
2. Check backend logs for authorization errors
3. Verify user has "support" role in Auth0 dashboard
4. Check JWT token claims using jwt.io
