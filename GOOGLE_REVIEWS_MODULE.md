# Google Reviews Module - Implementation Guide

## Overview
Complete SMS-based Google Review request system with configurable templates, automatic/manual sending, and request tracking.

---

## Backend Implementation

### 1. Models (`apps/backend/src/models/GoogleReviewSettings.js`)

#### GoogleReviewSettings Schema
- `org_id` - Organization reference
- `enabled` - Feature toggle (default: false)
- `googlePlaceId` - Google Maps Place ID
- `reviewUrl` - Direct review link
- `messageTemplate` - SMS template with variables
- `autoSendAfterConfirmed` - Auto-send toggle (default: false)
- `delayHours` - Delay after confirmation (default: 24)

#### GoogleReviewRequest Schema
- `org_id` - Organization reference
- `appointment_id` - Linked appointment
- `patient_id` - Patient reference
- `sentAt` - Send timestamp
- `messageContent` - Actual SMS sent
- `status` - success/failed/pending
- `error` - Error message if failed

**Indexes:** org_id (both models) for query performance

---

### 2. API Routes (`apps/backend/src/routes/google-reviews.js`)

#### GET `/api/google-reviews/settings`
- Retrieves organization's Google Review configuration
- Returns defaults if no settings exist

#### PATCH `/api/google-reviews/settings`
- Updates configuration (partial updates supported)
- Validates required fields when enabled

#### POST `/api/google-reviews/send`
- **Body:** `{ appointmentId: string }`
- Validates appointment exists and has patient phone
- Replaces template variables: `{firstName}`, `{lastName}`, `{clinicName}`, `{reviewLink}`
- Sends SMS via Twilio
- Creates GoogleReviewRequest record
- Returns: `{ success: true, request: {...} }`

#### GET `/api/google-reviews/history`
- **Query params:** `limit` (default: 50), `skip` (default: 0)
- Returns: `{ requests: [...], total: number }`

**Route Registration:** Added to `apps/backend/src/index.js` line 96

---

## Frontend Implementation

### 3. TypeScript Types (`apps/frontend/src/types/googleReviews.ts`)

```typescript
interface GoogleReviewSettings {
  _id?: string;
  org_id: string;
  enabled: boolean;
  googlePlaceId?: string;
  reviewUrl?: string;
  messageTemplate: string;
  autoSendAfterConfirmed: boolean;
  delayHours: number;
}

interface GoogleReviewRequest {
  _id: string;
  org_id: string;
  appointment_id: string;
  patient_id: string;
  sentAt: Date;
  messageContent: string;
  status: 'success' | 'failed' | 'pending';
  error?: string;
}

interface GoogleReviewHistory {
  requests: GoogleReviewRequest[];
  total: number;
}
```

---

### 4. React Query Hooks (`apps/frontend/src/Hooks/Query/useGoogleReviews.ts`)

#### `useGoogleReviewSettings()`
- Fetches current organization settings
- Stale time: 5 minutes
- Returns: `UseQueryResult<GoogleReviewSettings>`

#### `useUpdateGoogleReviewSettings()`
- Updates settings with partial data
- Auto-invalidates settings cache
- Shows success/error toasts
- Returns: `UseMutationResult`

#### `useSendGoogleReview()`
- Sends review request for appointment
- Shows success/error toasts with detailed messages
- Returns: `UseMutationResult<void, Error, string>`

#### `useGoogleReviewHistory(limit?, skip?)`
- Fetches sent request history with pagination
- Stale time: 2 minutes
- Returns: `UseQueryResult<GoogleReviewHistory>`

---

### 5. Button Component (`apps/frontend/src/Components/GoogleReview/GoogleReviewButton.tsx`)

#### Props
```typescript
{
  appointmentId: string;       // Required appointment ID
  variant?: 'icon' | 'button' | 'menu-item';  // Default: 'button'
  size?: 'xs' | 'sm' | 'md' | 'lg';           // Default: 'sm'
  disabled?: boolean;                          // Default: false
  onClose?: () => void;                        // For closing parent menus
}
```

#### Variants
1. **icon** - IconButton with star icon (for DraggableCards)
2. **button** - Full button with "Request Review" text (for modals)
3. **menu-item** - MenuItem for context menus

#### Features
- Confirmation modal before sending
- Loading states during SMS send
- Disabled state when inactive
- Auto-closes parent menus (menu-item variant)

---

### 6. Settings Manager (`apps/frontend/src/Components/admin/GoogleReviewsManager.tsx`)

#### Features
- Enable/disable toggle
- Google Place ID input with finder link
- Review URL input
- Message template textarea with variable guide
- Auto-send toggle and delay hours
- Real-time change detection
- Save button (disabled when no changes)
- Info alert with usage instructions

#### Template Variables
- `{firstName}` - Patient first name
- `{lastName}` - Patient last name
- `{clinicName}` - Organization name
- `{reviewLink}` - Configured review URL

---

### 7. Settings Integration (`apps/frontend/src/Routes/Settings/index.tsx`)

**New Tab Added:** "Google Reviews" (5th tab)
- Displays GoogleReviewsManager component
- Consistent styling with other tabs

---

## Usage Examples

### In DraggableCards (Icon Variant)
```tsx
import { GoogleReviewButton } from '@/Components/GoogleReview/GoogleReviewButton';

<GoogleReviewButton 
  appointmentId={appointment._id} 
  variant="icon" 
  size="xs" 
/>
```

### In AppointmentModal (Button Variant)
```tsx
<GoogleReviewButton 
  appointmentId={appointmentId} 
  variant="button" 
  size="md" 
/>
```

### In Context Menu (Menu-Item Variant)
```tsx
<Menu>
  <MenuList>
    <GoogleReviewButton 
      appointmentId={appointment._id} 
      variant="menu-item"
      onClose={onMenuClose}
    />
  </MenuList>
</Menu>
```

---

## Configuration Steps

### 1. Get Google Place ID
- Visit: https://developers.google.com/maps/documentation/places/web-service/place-id
- Search for your business
- Copy Place ID (starts with `ChIJ...`)

### 2. Get Review URL
- Go to your Google Business Profile
- Click "Get more reviews"
- Copy short URL (e.g., `https://g.page/r/...`)

### 3. Configure in Settings
- Navigate to Settings → Google Reviews tab
- Enable feature
- Paste Place ID and Review URL
- Customize message template
- Optionally enable auto-send with delay

### 4. Test
- Use button in any supported location
- Verify SMS received with personalized content
- Check History tab for sent requests

---

## API Flow

### Manual Send Flow
1. User clicks GoogleReviewButton
2. Confirmation modal opens
3. User confirms → `useSendGoogleReview()` mutation triggered
4. POST `/api/google-reviews/send` with appointmentId
5. Backend fetches appointment and patient
6. Template variables replaced
7. SMS sent via Twilio
8. Request logged in GoogleReviewRequest collection
9. Success toast shown

### Auto-Send Flow (Future Enhancement)
1. Appointment status changes to "confirmed"
2. Check if autoSendAfterConfirmed is enabled
3. Schedule job for delayHours later
4. Job runs → same flow as manual send

---

## Error Handling

### Frontend
- Settings load failure: Alert message
- Save failure: Error toast with message
- Send failure: Detailed error toast

### Backend
- Missing settings: 400 error with message
- Invalid appointment: 404 error
- Missing patient phone: 400 error with specific message
- Twilio error: Logs error, saves request with status "failed"
- All errors include descriptive messages

---

## Database Collections

### `google_review_settings`
- One document per organization
- Stores configuration

### `google_review_requests`
- Multiple documents per organization
- Tracks all sent requests
- Enables analytics and history

---

## Environment Variables

### Backend
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Sending phone number

### Frontend
- `VITE_BASE_URL` - API base URL (optional, defaults to `/api`)
- `VITE_AUTH0_AUDIENCE` - Auth0 API audience

---

## Future Enhancements

1. **Auto-Send Implementation**
   - Add scheduler (node-cron or agenda)
   - Hook into appointment confirmation event
   - Respect delayHours setting

2. **Analytics Dashboard**
   - View sent request statistics
   - Track response rates
   - Display history with filters

3. **Templates Manager**
   - Multiple template presets
   - A/B testing support
   - Language variants

4. **Rate Limiting**
   - Prevent duplicate sends within timeframe
   - Per-patient cooldown period

5. **Response Tracking**
   - Webhook integration
   - Track which patients left reviews
   - Follow-up reminders

---

## Testing Checklist

- [ ] Settings load correctly
- [ ] Settings save successfully
- [ ] Enable/disable toggle works
- [ ] Template variables preview
- [ ] Icon variant renders in cards
- [ ] Button variant renders in modals
- [ ] Menu-item variant renders in menus
- [ ] Confirmation modal appears
- [ ] SMS sends with correct content
- [ ] Success toast shows
- [ ] Error handling works (missing phone, etc.)
- [ ] History displays sent requests
- [ ] Pagination works in history

---

## File Locations Reference

**Backend:**
- `/apps/backend/src/models/GoogleReviewSettings.js`
- `/apps/backend/src/routes/google-reviews.js`
- `/apps/backend/src/index.js` (line 96)

**Frontend:**
- `/apps/frontend/src/types/googleReviews.ts`
- `/apps/frontend/src/Hooks/Query/useGoogleReviews.ts`
- `/apps/frontend/src/Components/GoogleReview/GoogleReviewButton.tsx`
- `/apps/frontend/src/Components/admin/GoogleReviewsManager.tsx`
- `/apps/frontend/src/Routes/Settings/index.tsx`

---

## Status: ✅ COMPLETE

All components implemented and ready for integration testing.
