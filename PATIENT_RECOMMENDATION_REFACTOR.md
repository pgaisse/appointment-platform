# Patient Recommendation System Refactor

## 🎯 Objective
Refactor the patient recommendation system (`/api/sorting` endpoint and `findMatchingAppointments` helper) to use **slot-level** priority/treatment data instead of deprecated **root-level** fields.

## 🔴 Previous Issues

### 1. **Searching Deprecated Fields**
- ❌ Queried `appointment.priority` (root-level, deprecated)
- ❌ Queried `appointment.treatment` (root-level, deprecated)
- ❌ Ignored slot-level `selectedAppDates[].priority`
- ❌ Ignored slot-level `selectedAppDates[].treatment`

### 2. **No Slot Filtering**
- ❌ Didn't validate slot status (included cancelled/rejected)
- ❌ Didn't ensure slots were rebookable
- ❌ Mixed all slots from one appointment together

### 3. **Missing Slot Information**
- ❌ Didn't return `slotId` for rebooking
- ❌ Didn't return slot-specific start/end dates
- ❌ Didn't return slot providers/duration info

### 4. **Incorrect Match Calculation**
- ❌ Used root-level priority for grouping
- ❌ Didn't validate slot requirements against proposed calendar slot

---

## ✅ New Architecture

### Data Source
```javascript
// ❌ OLD (Deprecated)
appointment.priority    // Root-level
appointment.treatment   // Root-level

// ✅ NEW (Current)
selectedAppDates[0].priority   // Slot-level
selectedAppDates[0].treatment  // Slot-level
selectedAppDates[0].providers  // Slot-level
selectedAppDates[0].duration   // Slot-level
```

### Aggregation Strategy

#### Phase 1: Filter Appointments with Slots
```javascript
{
  $match: {
    "selectedDates.startDate": { $lte: endDate },
    "selectedDates.endDate": { $gte: startDate },
    selectedAppDates: { $exists: true, $ne: [] },
  }
}
```

#### Phase 2: Unwind Slots
```javascript
{ $unwind: { path: "$selectedAppDates", preserveNullAndEmptyArrays: false } }
```

#### Phase 3: Filter Rebookable Slots
```javascript
{
  $match: {
    "selectedAppDates.status": { 
      $nin: ["cancelled", "rejected", "completed", "expired"] 
    },
    "selectedAppDates.priority": { $exists: true, $ne: null },
  }
}
```

#### Phase 4-6: Populate Slot References
```javascript
// POPULATE selectedAppDates.priority
{ $lookup: { from: "PriorityList", localField: "selectedAppDates.priority", ... } }

// POPULATE selectedAppDates.treatment  
{ $lookup: { from: "treatments", localField: "selectedAppDates.treatment", ... } }

// POPULATE selectedAppDates.providers
{ $lookup: { from: "providers", localField: "selectedAppDates.providers", ... } }
```

#### Phase 7: Populate Patient Availability
```javascript
// POPULATE selectedDates.days.timeBlocks (patient availability)
{ $unwind: { path: "$selectedDates.days", preserveNullAndEmptyArrays: true } }
{ $lookup: { from: "timeblocks", localField: "selectedDates.days.timeBlocks", ... } }
```

#### Phase 8-10: Rebuild Structure
```javascript
{
  $group: {
    _id: { appointmentId: "$_id", slotId: "$selectedAppDates._id" },
    // ... all appointment fields ...
    slot: { $first: "$selectedAppDates" },
  }
}

{
  $addFields: {
    _id: "$_id.appointmentId",
    slotId: "$_id.slotId",
    selectedAppDates: ["$slot"], // Array of 1 slot
    priority: "$slot.priority",   // For compatibility
    treatment: "$slot.treatment", // For compatibility
  }
}
```

### Match Level Calculation

```javascript
// Calculate overlap between patient availability and proposed calendar slot
const matchPercentage = (totalOverlapMinutes / requestDuration) * 100;

const matchLevel =
  matchPercentage >= 95 ? "Perfect Match" :  // 95%+ overlap
  matchPercentage >= 70 ? "High Match"    :  // 70-94% overlap
  matchPercentage >= 40 ? "Medium Match"  :  // 40-69% overlap
                          "Low Match";        // <40% overlap
```

### Response Structure

```javascript
{
  dateRange: {
    startDate: "2025-01-20T10:00:00Z",
    endDate: "2025-01-20T11:00:00Z"
  },
  priorities: [
    {
      priority: {
        _id: "...",
        name: "Priority 1",
        color: "#FF5733",
        durationHours: 2
      },
      appointments: [
        {
          _id: "...",
          nameInput: "John Doe",
          phoneInput: "+61412345678",
          matchLevel: "Perfect Match",
          totalOverlapMinutes: 60,
          matchedBlocks: [
            { from: "10:00", to: "11:00", short: "Morning" }
          ],
          // ✨ NEW: slotInfo for rebooking
          slotInfo: {
            slotId: "slot_123",
            startDate: "2025-01-15T14:00:00Z",
            endDate: "2025-01-15T15:00:00Z",
            status: "pending",
            priority: { _id: "...", name: "Priority 1", ... },
            treatment: { _id: "...", name: "Consultation", ... },
            providers: [{ _id: "...", firstName: "Dr.", lastName: "Smith" }],
            duration: 60,
            position: 0
          },
          // ... other appointment fields ...
        }
      ]
    }
  ]
}
```

---

## 🔄 Migration Path

### ✅ Completed
1. **DraggableCards endpoint** - Migrated to slot-level priority/treatment (lines 166-489 in `priority-list.js`)
2. **Priority list move endpoint** - Supports both root and slot-level updates (lines 1-165 in `priority-list.js`)
3. **Patient recommendation system** - Now uses slot-level data (`findMatchingAppointments.js`)

### 📋 Deprecated Fields (Still Present for Compatibility)
```javascript
// These fields are DEPRECATED but maintained for backward compatibility
appointment.priority   // Use selectedAppDates[].priority instead
appointment.treatment  // Use selectedAppDates[].treatment instead
appointment.providers  // Use selectedAppDates[].providers instead
```

### 🎯 Frontend Consumption
The frontend `usePriorityTreatments` hook calls `/api/sorting` which uses the refactored helper. The response includes:

- **Grouped by slot.priority** (not root.priority)
- **Each appointment represents ONE slot** (not all slots merged)
- **slotInfo for rebooking** (slotId, dates, status, priority, treatment, providers)
- **matchLevel for UI sorting** (Perfect/High/Medium/Low Match)

---

## 🧪 Testing

### Test Query
```bash
curl -X GET 'http://localhost:3000/api/sorting?startDate=2025-01-20T10:00:00Z&endDate=2025-01-20T11:00:00Z' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Behavior
1. ✅ Returns appointments with slots matching the calendar slot
2. ✅ Slots are grouped by their priority (not root priority)
3. ✅ Only rebookable slots (no cancelled/rejected)
4. ✅ Each appointment has `slotInfo` for rebooking
5. ✅ Appointments sorted by `matchLevel` (best matches first)

### Validation Checks
- [ ] No appointments with `priority: null` in results
- [ ] All results have `slotInfo.slotId`
- [ ] `matchLevel` is calculated based on availability overlap
- [ ] Slots with status `cancelled`/`rejected` are excluded
- [ ] Results are grouped by slot-level priority

---

## 📝 API Endpoint

### GET /api/sorting

**Query Parameters:**
- `startDate` (ISO 8601): Start of proposed calendar slot
- `endDate` (ISO 8601): End of proposed calendar slot
- `category` (optional): Filter by treatment category (not currently used)
- `reschedule` (optional): Include only reschedules (not currently used)

**Response:**
```typescript
Array<{
  dateRange: { startDate: Date; endDate: Date };
  priorities: Array<{
    priority: Priority;
    appointments: Array<Appointment & {
      matchLevel: "Perfect Match" | "High Match" | "Medium Match" | "Low Match";
      totalOverlapMinutes: number;
      matchedBlocks: Array<{ from: string; to: string; short: string }>;
      slotInfo: {
        slotId: string;
        startDate: Date;
        endDate: Date;
        status: string;
        priority: Priority;
        treatment: Treatment;
        providers: Provider[];
        duration: number;
        position: number;
      };
    }>;
  }>;
}>
```

---

## 🚀 Benefits

1. **Accurate Recommendations**: Matches based on actual slot requirements
2. **Rebooking Support**: Frontend can rebook specific slots using `slotInfo.slotId`
3. **Status Filtering**: Excludes non-rebookable slots automatically
4. **Match Quality**: Clear indication of availability overlap
5. **Slot Independence**: Each slot processed separately (multi-slot appointments handled correctly)
6. **Future-Proof**: Uses current data architecture (slot-level fields)

---

## 📚 Related Files

- `/home/appointment-platform/apps/backend/src/helpers/findMatchingAppointments.js` - Main refactored helper
- `/home/appointment-platform/apps/backend/src/routes/index.js` (line 885) - `/api/sorting` endpoint
- `/home/appointment-platform/apps/backend/src/routes/priority-list.js` - DraggableCards endpoint (already migrated)
- `/home/appointment-platform/apps/frontend/src/Hooks/Query/usePriorityTreatments.tsx` - Frontend hook
- `/home/appointment-platform/apps/frontend/src/Routes/Appointments/PatientFinder.tsx` - UI component

---

## ⚠️ Breaking Changes

### None Expected
The refactor maintains backward compatibility:
- Response structure unchanged (priorities array with appointments)
- Frontend hooks work without changes
- Fallback to root-level priority if slot priority doesn't exist (defensive)

### Future Cleanup
Once all appointments have been migrated to slot-level fields, consider:
1. Removing root-level `priority`/`treatment` fields from schema
2. Removing fallback logic in aggregations
3. Updating frontend to only use slot-level data

---

## 📊 Logging

The refactored helper includes comprehensive logging:

```javascript
console.log('📊 [findMatchingAppointments] Searching for slots matching:', { ... });
console.log('✅ [findMatchingAppointments] Found X slots with priority/treatment');
console.log('📋 [findMatchingAppointments] Total priorities in system: X');
console.log('📊 [findMatchingAppointments] Results:', { breakdown: [...] });
```

Monitor these logs to verify correct behavior in production.
