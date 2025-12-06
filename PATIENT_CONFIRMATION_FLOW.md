# Patient Confirmation Flow - Reschedule with SMS

## Overview
This document describes the complete flow for rescheduling appointments via drag-and-drop in the calendar with SMS confirmation and automatic reversion when the patient declines.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User drags appointment to new date/time in calendar         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Reschedule modal opens with two options:                    │
│    - Manual confirmation (no SMS)                               │
│    - SMS confirmation (sends message to patient)                │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. If SMS confirmation selected:                                │
│    a) updateDateAsync() updates slot to new date (Pending)      │
│    b) proposeDate() saves proposed date and origin data         │
│    c) sendSMS() sends confirmation message to patient           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Backend saves critical data:                                 │
│    - slot.origin.startDate (original date before change)        │
│    - slot.origin.endDate (original end date)                    │
│    - slot.origin.capturedAt (timestamp)                         │
│    - slot.proposed.startDate (new proposed date)                │
│    - slot.proposed.endDate (new proposed end date)              │
│    - slot.status = "Pending"                                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Patient receives SMS and responds                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌─────────────┐   ┌─────────────┐
│ "Yes" / "Si"│   │ "No" / "Nop"│
│   Response  │   │   Response  │
└──────┬──────┘   └──────┬──────┘
       │                 │
       ▼                 ▼
┌─────────────────┐   ┌──────────────────────────────────────────┐
│ 6a. CONFIRMED   │   │ 6b. DECLINED                             │
│                 │   │                                          │
│ Backend:        │   │ Backend:                                 │
│ - Sets slot     │   │ - Reverts slot to origin dates:          │
│   status to     │   │   slot.startDate = slot.origin.startDate │
│   "Confirmed"   │   │   slot.endDate = slot.origin.endDate     │
│ - Keeps new     │   │ - Sets slot.status = "Rejected"          │
│   dates         │   │                                          │
│ - Emits socket  │   │ - Emits socket "confirmationResolved"    │
│   event         │   │                                          │
└────────┬────────┘   └──────────┬───────────────────────────────┘
         │                       │
         │                       ▼
         │            ┌──────────────────────────────────────────┐
         │            │ Frontend Socket Listener:                │
         │            │ - Receives confirmationResolved event    │
         │            │ - Calls updateDateAsync() to revert      │
         │            │ - Shows toast: "Appointment Declined"    │
         │            │ - Refetches calendar queries             │
         │            └──────────┬───────────────────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌──────────────────────┐
         │ 7. Calendar Updates  │
         │ - Confirmed: stays   │
         │   in new position    │
         │ - Declined: reverts  │
         │   to original time   │
         └──────────────────────┘
```

## Key Files Modified

### Frontend
- **`AssignedAppointments.tsx`**
  - Added socket listener for `confirmationResolved` events
  - Handles patient responses:
    - "confirmed": Shows success toast, event stays in new position
    - "declined": Reverts event to original time using `slot.origin` data
  - Automatically refetches calendar data after patient response

### Backend
- **`sms.js` (webhook handler)**
  - Detects patient response using `decideFromBody()` helper
  - Updates slot status to "Confirmed" or "Rejected"
  - For "declined": Preserves `slot.origin` data for reversion
  - Emits socket event `confirmationResolved` with:
    - `appointmentId`, `slotId`, `decision`
    - `selectedAppDates` array with full slot data including `origin`

- **`calendar.js` (`/calendar/update-date` endpoint)**
  - **CRITICAL FIX**: Now saves `origin` data when updating slot dates
  - Before changing slot dates, captures original dates if `origin` doesn't exist:
    ```javascript
    if (!slot.origin || !slot.origin.startDate) {
      slot.origin = {
        startDate: slot.startDate,
        endDate: slot.endDate,
        capturedAt: new Date(),
      };
    }
    ```

## Data Structure

### Slot Origin Schema
```javascript
{
  selectedAppDates: [
    {
      _id: ObjectId,
      startDate: Date,        // Current/proposed date
      endDate: Date,          // Current/proposed end date
      status: String,         // "Pending" | "Confirmed" | "Rejected"
      origin: {
        startDate: Date,      // Original date before change
        endDate: Date,        // Original end date before change
        capturedAt: Date      // When origin was captured
      },
      proposed: {
        startDate: Date,      // Proposed new date
        endDate: Date,        // Proposed new end date
        proposedBy: String,   // "clinic"
        reason: String,       // "Rescheduled by drag & drop"
        createdAt: Date
      }
    }
  ]
}
```

## Socket Event Payload

### confirmationResolved
```javascript
{
  conversationId: String,
  appointmentId: String,
  slotId: String,
  decision: "confirmed" | "declined",
  slot: Object,              // Full slot object
  selectedAppDates: Array,   // Complete array with all slots
  notification: true,
  from: String,              // Patient phone number
  name: String,              // Patient name
  body: String,              // Patient response text
  date: String,              // ISO timestamp
  receivedAt: Date
}
```

## Frontend Socket Listener Logic

```typescript
socket.on('confirmationResolved', async (payload) => {
  const { appointmentId, slotId, decision, selectedAppDates } = payload;

  if (decision === "confirmed") {
    // Event stays in new position - no action needed
    toast({ title: "Appointment Confirmed", status: "success" });
  } 
  else if (decision === "declined") {
    // Find origin data from the payload
    const targetSlot = selectedAppDates?.find(s => 
      String(s._id) === String(slotId)
    );
    const originStart = targetSlot?.origin?.startDate;
    const originEnd = targetSlot?.origin?.endDate;

    // Revert to original time
    await updateDateAsync({
      appointmentId,
      slotId,
      newStartDate: new Date(originStart).toISOString(),
      newEndDate: new Date(originEnd).toISOString(),
      status: "Rejected",
    });

    toast({ 
      title: "Appointment Declined",
      description: "Reverted to original time",
      status: "info" 
    });
  }

  // Refresh calendar data
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const head = String(query.queryKey[0]);
      return head === "calendar-appointments" || 
             head === "appointments-month-days";
    },
  });
});
```

## Testing Checklist

- [ ] Drag appointment to new date/time
- [ ] Select "Confirm with SMS" option
- [ ] Verify SMS is sent to patient
- [ ] Simulate patient response "Yes" / "Si"
  - [ ] Event stays in new position
  - [ ] Status changes to "Confirmed"
  - [ ] Toast notification appears
- [ ] Simulate patient response "No" / "Nop"
  - [ ] Event reverts to original date/time
  - [ ] Status changes to "Rejected"
  - [ ] Toast notification appears
- [ ] Verify calendar updates correctly in both scenarios
- [ ] Check backend logs for proper origin data capture

## Important Notes

1. **Origin data is captured only on the FIRST change**: Once `slot.origin` is set, it won't be overwritten on subsequent changes. This preserves the true original appointment time.

2. **Manual confirmation (no SMS)**: When using manual confirmation, the appointment updates immediately without waiting for patient response. No origin reversion occurs in this flow.

3. **Race condition prevention**: The socket listener cancels in-flight queries before processing the response to avoid displaying stale data.

4. **Status enum validation**: The frontend must send capitalized status values ("Pending", "Rejected", "Confirmed") to match the backend ContactStatus enum.

## Troubleshooting

### Event doesn't revert when patient declines
- Check if `slot.origin` data exists in the database
- Verify socket connection is established (`connected === true`)
- Check browser console for socket event logs
- Verify backend is emitting `confirmationResolved` event

### Origin data not being saved
- Check that `/calendar/update-date` endpoint is being called (not a different endpoint)
- Verify the updated code in `calendar.js` is deployed
- Check database to confirm `slot.origin` field exists after drag-and-drop

### Socket events not received
- Verify `useSocket` hook is properly initialized
- Check network tab for WebSocket connection
- Verify Auth0 token is being sent with socket connection
- Check backend socket.io server logs
