# AvailabilityDates2 Component - Usage Guide

## Overview
`AvailabilityDates2` is a fully reusable, type-safe component for selecting availability date ranges with time blocks. It supports both **controlled** and **uncontrolled** modes, making it 100% flexible for any use case.

## ✅ Improvements from Previous Version

### Type Safety
- **Discriminated unions** for controlled/uncontrolled props (compile-time safety)
- **Exported types** for external use: `SelectedDatesValue`, `SelectedDaysState`
- No more type assertions or `any` types

### Performance
- All callbacks wrapped with `useCallback`
- All derived values wrapped with `useMemo`
- Prevents unnecessary re-renders

### Accessibility
- Full ARIA labels on all interactive elements
- Tooltips for icon buttons
- Screen reader support with `aria-live` regions
- Proper semantic HTML structure

### Reusability
- **Controlled mode**: Parent manages state
- **Uncontrolled mode**: Component manages own state
- **Read-only mode**: Display-only view
- No React Hook Form coupling

### UX Enhancements
- Visual feedback for all actions
- Empty state messages
- Validation error display
- Summary tags with counts
- Quick action buttons (select all, clear)
- Color mode adaptive styling

---

## Installation

```tsx
import AvailabilityDates2, { 
  SelectedDatesValue, 
  SelectedDaysState 
} from "@/Components/CustomTemplates/AvailabilityDates2";
```

---

## Usage Examples

### 1. **Uncontrolled Mode** (Component manages its own state)

```tsx
function SimpleForm() {
  const handleChange = (value: SelectedDatesValue) => {
    console.log("Selected:", value);
    // value = { startDate, endDate, days: [...] }
  };

  return (
    <AvailabilityDates2
      defaultValue={{}}
      onChange={handleChange}
      initialDuration={14}
    />
  );
}
```

### 2. **Controlled Mode** (Parent manages state)

```tsx
function ControlledForm() {
  const [selectedDays, setSelectedDays] = useState<SelectedDaysState>({
    Monday: [],
    Wednesday: [],
  });

  const handleChange = (value: SelectedDatesValue) => {
    // Extract days from value and update state
    const newSelectedDays: SelectedDaysState = {};
    value.days.forEach(day => {
      newSelectedDays[day.weekDay] = timeBlocks; // populate with actual blocks
    });
    setSelectedDays(newSelectedDays);
  };

  return (
    <AvailabilityDates2
      value={selectedDays}
      onChange={handleChange}
      initialDuration={7}
    />
  );
}
```

### 3. **Read-Only Mode** (Display only)

```tsx
function DisplayAvailability({ availability }: { availability: SelectedDaysState }) {
  return (
    <AvailabilityDates2
      value={availability}
      onChange={() => {}} // Required for controlled mode
      readOnly={true}
      showSummary={true}
    />
  );
}
```

### 4. **With Validation**

```tsx
function ValidatedForm() {
  const [selectedDays, setSelectedDays] = useState<SelectedDaysState>({});

  const validate = (value: SelectedDatesValue) => {
    if (value.days.length === 0) {
      return "Debes seleccionar al menos un día";
    }
    
    const totalBlocks = value.days.reduce(
      (acc, day) => acc + day.timeBlocks.length, 
      0
    );
    
    if (totalBlocks < 3) {
      return "Debes seleccionar al menos 3 bloques de tiempo";
    }
    
    return null; // No error
  };

  return (
    <AvailabilityDates2
      value={selectedDays}
      onChange={(value) => {
        const newState: SelectedDaysState = {};
        // Convert value to state...
        setSelectedDays(newState);
      }}
      validate={validate}
      helpText="Selecciona al menos 3 bloques de tiempo"
    />
  );
}
```

### 5. **With External Error**

```tsx
function FormWithServerValidation() {
  const [error, setError] = useState<string | null>(null);

  return (
    <AvailabilityDates2
      defaultValue={{}}
      onChange={async (value) => {
        const result = await saveToServer(value);
        if (!result.success) {
          setError(result.error);
        }
      }}
      error={error}
    />
  );
}
```

---

## Props API

### Base Props (Common to both modes)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `readOnly` | `boolean` | `false` | Makes component read-only (display mode) |
| `baseStartDate` | `Date` | `new Date()` | Starting date for the range |
| `initialDuration` | `7 \| 14 \| 30` | `7` | Initial duration in days |
| `showSummary` | `boolean` | `true` | Show summary tags with counts |
| `allowDurationChange` | `boolean` | `true` | Allow changing duration |
| `validate` | `(value) => string \| null` | `undefined` | Validation function |
| `error` | `string` | `undefined` | External error message |
| `onChange` | `(value) => void` | `undefined` | Called when value changes |
| `onDurationChange` | `(days) => void` | `undefined` | Called when duration changes |
| `helpText` | `string` | `undefined` | Help text below component |

### Controlled Mode Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `SelectedDaysState` | ✅ Yes | Current selected days (controlled by parent) |
| `onChange` | `(value) => void` | ✅ Yes | Callback when value changes |

### Uncontrolled Mode Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `defaultValue` | `SelectedDaysState` | No | Initial selected days |
| `onChange` | `(value) => void` | No | Optional callback when value changes |

---

## Type Definitions

```typescript
// Main value type returned by onChange
export type SelectedDatesValue = {
  startDate: Date;
  endDate: Date;
  days: { 
    weekDay: WeekDay; 
    timeBlocks: { _id: string }[] 
  }[];
};

// State type for controlled/uncontrolled modes
export type SelectedDaysState = Partial<Record<WeekDay, TimeBlock[]>>;

// WeekDay type
type WeekDay = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

// TimeBlock interface
interface TimeBlock {
  _id?: string;
  org_id: string;
  blockNumber: number;
  label: TimeSlot;
  short: string;
  from: string; // "HH:mm" format
  to: string;   // "HH:mm" format
}
```

---

## Key Features

✅ **Type-Safe**: Full TypeScript support with discriminated unions  
✅ **Flexible**: Controlled and uncontrolled modes  
✅ **Performant**: Optimized with useCallback and useMemo  
✅ **Accessible**: Full ARIA support and keyboard navigation  
✅ **Responsive**: Mobile-friendly grid layout  
✅ **Dark Mode**: Automatic color mode adaptation  
✅ **Validation**: Built-in and external validation support  
✅ **Read-Only**: Can be used for display purposes  
✅ **Zero Dependencies**: No React Hook Form required  

---

## Migration from Old Version

### Before (React Hook Form coupled)
```tsx
<AvailabilityDates2
  setValue={setValue}
  trigger={trigger}
  modeInput={true}
  showSummary={true}
  hasSubmitted={hasSubmitted}
  setSelectedDaysResp={setSelectedDaysResp}
  onSelectedDatesChange={onSelectedDatesChange}
/>
```

### After (Controlled mode)
```tsx
<AvailabilityDates2
  value={selectedDays}
  onChange={handleChange}
  showSummary={true}
  validate={validateAvailability}
/>
```

### After (Uncontrolled mode)
```tsx
<AvailabilityDates2
  defaultValue={{}}
  onChange={handleChange}
  showSummary={true}
/>
```

---

## Notes

- Component automatically loads time blocks from the `TimeBlock` collection
- Duration can be 7, 14, or 30 days
- Each day can have multiple time blocks selected
- Empty state shows helpful message when no blocks are selected
- Validation errors are displayed inline with clear messages
- All callbacks are properly memoized for optimal performance
