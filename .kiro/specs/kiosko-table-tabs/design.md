# Design Document: Kiosko Table Tabs

## Overview

This feature transforms the unified tariff table in KioskoView into a tabbed interface with two separate tables: one for strips (tiras) and one for individual tariffs. The design implements a visual overlapping pattern where the active table appears in front while the inactive table's header peeks from behind, creating a classic tab-like appearance. Users switch between tables via clickable tab headers, triggering a smooth CSS-based slide transition animation.

### Core Design Principles

1. **Component Reusability**: Extract shared table rendering logic from TariffTableSplit into reusable components that work for both static and dynamic modes
2. **State Minimalism**: Use local component state for UI concerns (active tab, animation state) and Zustand store for business logic (quantities, prices)
3. **Animation Performance**: Leverage CSS transforms and transitions for GPU-accelerated animations
4. **Backward Compatibility**: Maintain all existing functionality while adding the new tabbed interface
5. **Accessibility First**: Implement proper ARIA semantics and keyboard navigation from the start

### Design Goals

- Split tariff display into two focused tables (strips vs individual tariffs)
- Create a visually intuitive tab interface with overlapping design
- Implement smooth, performant slide transitions between tables
- Preserve all existing functionality (quantity inputs, price toggle, limit calculations)
- Support both static (TariffTableSplit) and dynamic (DynamicTariffTable) rendering modes

## Architecture

### Component Hierarchy

```
KioskoView
├── StampModelSingle (A)
├── CartControls
├── StampModelSingle (B)
├── TabbedTariffContainer (NEW)
│   ├── TabHeader (Strip Table)
│   ├── TabHeader (Individual Table)
│   ├── TariffTable (Strip - active/hidden)
│   │   └── TariffTableContent (renders rows)
│   └── TariffTable (Individual - active/hidden)
│       └── TariffTableContent (renders rows)
└── RollCounters
```

### Component Responsibilities

#### TabbedTariffContainer
- **Purpose**: Orchestrate the tabbed interface, manage active tab state, coordinate animations
- **State**: `activeTab: 'strips' | 'individual'`, `isAnimating: boolean`
- **Behavior**: 
  - Renders two TariffTable components with appropriate visibility/z-index
  - Handles tab click events and triggers slide animations
  - Disables tab interactions during animations
  - Determines which rows belong to each table (filter by `isStrip` flag)

#### TariffTable
- **Purpose**: Render a single table with header and data rows, handle visual positioning for tab effect
- **Props**: `rows: TariffRowDef[]`, `isActive: boolean`, `title: string`, `onTabClick: () => void`, `isStrip: boolean` (for styling), `isAnimating: boolean`
- **Behavior**:
  - Applies z-index, transform, and transition styles based on `isActive` state
  - Renders tab header with click handler
  - Delegates row rendering to TariffTableContent

#### TariffTableContent
- **Purpose**: Render the table structure (header row + data rows) with quantity inputs
- **Props**: `rows: TariffRowDef[]`, `quantities: Record`, `setQuantity: Function`, `limits: Record`, `showSecondary: boolean`, `currencySymbol: string`
- **Behavior**:
  - Stateless presentation component
  - Renders the grid layout with header and data rows
  - Handles input change events (delegates to parent via `setQuantity`)

### Data Flow

```
User clicks tab header
  ↓
TabbedTariffContainer.handleTabClick()
  ↓
Set isAnimating = true
  ↓
Update activeTab state
  ↓
CSS transitions trigger on both tables
  ↓
transitionend event fires
  ↓
Set isAnimating = false
```

### Integration Points

#### With TariffTableSplit (Static Mode)
- TariffTableSplit will be refactored to use TabbedTariffContainer
- Row definitions remain in TariffTableSplit
- Filtering logic splits rows into strips vs individual arrays
- All quantity/limit logic unchanged

#### With DynamicTariffTable (Dynamic Mode)
- DynamicTariffTable will similarly adopt TabbedTariffContainer
- Rows built from activeTariffGroup + activeEvento
- Filtering based on `_isStrip` flag added during row construction
- Dynamic quantity keys and limit calculations unchanged

#### With Zustand Store
- No new store state required for tab selection (local UI concern)
- Existing `quantities`, `useSecondaryPrice`, limits logic remain unchanged
- `setQuantity` API unchanged

## Components and Interfaces

### TabbedTariffContainer

```typescript
interface TabbedTariffContainerProps {
  stripRows: TariffRowDef[]
  individualRows: TariffRowDef[]
  quantities: Record<string, number>
  setQuantity: (field: any, value: any) => void
  limits: Record<string, number>
  showSecondary: boolean
  toggleSecondary: () => void
  currencySymbol: string
  isDynamic?: boolean // optional flag for styling differences
}

interface TabbedTariffContainerState {
  activeTab: 'strips' | 'individual'
  isAnimating: boolean
}
```

**Key Methods**:
- `handleTabClick(tab: 'strips' | 'individual'): void` - Initiates tab switch with animation
- `handleTransitionEnd(): void` - Clears animation flag after CSS transition completes

### TariffTable

```typescript
interface TariffTableProps {
  title: string
  rows: TariffRowDef[]
  isActive: boolean
  isStrip: boolean // true for strips table (dark blue bg), false for individual (white bg)
  isAnimating: boolean
  onTabClick: () => void
  quantities: Record<string, number>
  setQuantity: (field: any, value: any) => void
  limits: Record<string, number>
  showSecondary: boolean
  toggleSecondary: () => void
  currencySymbol: string
}
```

**Styling Logic**:
- `z-index`: Active = 20, Inactive = 10
- `transform`: Active = `scale(1)`, Inactive = `scale(0.98) translateY(4px)`
- `opacity`: Active = 1, Inactive = header only visible (0.95 opacity)
- `transition`: `all 400ms ease-in-out`
- `border-radius`: Rounded corners on all tables
- Background: Strips = dark blue (`bg-blue-900`), Individual = white

### TariffTableContent

```typescript
interface TariffTableContentProps {
  rows: TariffRowDef[]
  quantities: Record<string, number>
  setQuantity: (field: any, value: any) => void
  limits: Record<string, number>
  showSecondary: boolean
  toggleSecondary: () => void
  currencySymbol: string
}
```

**Structure**:
- Renders header row with price toggle button
- Renders data rows using provided row definitions
- Each row contains: Subtotal (A) | Límite (A) | Cantidad (A) | Modalidad | Precio | Cantidad (B) | Límite (B) | Subtotal (B)

### TariffRowDef Interface

```typescript
interface TariffRowDef {
  label: string
  localPrice: number
  secondaryPrice: number
  qtyFieldS1: string // quantity key for Sello A
  qtyFieldS2: string // quantity key for Sello B
  limitFieldS1: string // limit key for Sello A
  limitFieldS2: string // limit key for Sello B
  isStrip: boolean
  tariffId?: number // for dynamic mode
}
```

## Data Models

### Row Filtering Logic

For **static mode** (TariffTableSplit):
```typescript
const allRows: TariffRowDef[] = [
  { label: 'Tira A×4', isStrip: true, ... },
  { label: 'Tira 4 Tar.', isStrip: true, ... },
  { label: 'Tarifa A', isStrip: false, ... },
  { label: 'Tarifa A2', isStrip: false, ... },
  { label: 'Tarifa B', isStrip: false, ... },
  { label: 'Tarifa C', isStrip: false, ... },
]

const stripRows = allRows.filter(r => r.isStrip)
const individualRows = allRows.filter(r => !r.isStrip)
```

For **dynamic mode** (DynamicTariffTable):
```typescript
// Already adds _isStrip flag during row construction
const allRows = useMemo(() => {
  const result = []
  for (const s of strips) {
    result.push({ ...s, _isStrip: true })
  }
  for (const t of tariffs) {
    result.push({ ...t, _isStrip: false })
  }
  return result
}, [strips, tariffs])

const stripRows = allRows.filter(r => r._isStrip)
const individualRows = allRows.filter(r => !r._isStrip)
```

### State Management

#### Local Component State (TabbedTariffContainer)
```typescript
const [activeTab, setActiveTab] = useState<'strips' | 'individual'>('strips')
const [isAnimating, setIsAnimating] = useState(false)
```

**Rationale**: Tab selection is purely a UI concern with no impact on business logic. Keeping this state local avoids polluting the Zustand store and follows React best practices.

#### Zustand Store (useKioskoStore)
No changes required. All existing state remains:
- `quantities: Record<string, number>`
- `useSecondaryPrice: boolean`
- `setQuantity`, `setUseSecondaryPrice` actions
- Limit calculations, total calculations, validation logic

## Animation Implementation

### CSS Transition Strategy

**Active Table (Foreground)**:
```css
.tariff-table-active {
  z-index: 20;
  transform: scale(1) translateY(0);
  opacity: 1;
  transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Inactive Table (Background)**:
```css
.tariff-table-inactive {
  z-index: 10;
  transform: scale(0.98) translateY(4px);
  opacity: 0.95; /* header visible, body faded */
  pointer-events: none; /* prevent interaction */
  transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Tailwind Implementation

Using Tailwind utility classes:
```tsx
<div
  className={cn(
    "rounded-lg shadow-lg border border-gray-200 overflow-hidden transition-all duration-400 ease-in-out",
    isActive ? "z-20 scale-100 translate-y-0 opacity-100" : "z-10 scale-98 translate-y-1 opacity-95 pointer-events-none"
  )}
  onTransitionEnd={handleTransitionEnd}
>
  {/* table content */}
</div>
```

**Note**: `scale-98` and `translate-y-1` are not standard Tailwind classes. We'll use inline styles or extend Tailwind config:

```typescript
// In component (inline style approach)
<div
  style={{
    transform: isActive ? 'scale(1) translateY(0)' : 'scale(0.98) translateY(4px)'
  }}
  className={cn(
    "rounded-lg shadow-lg border border-gray-200 overflow-hidden",
    "transition-all duration-[400ms] ease-in-out",
    isActive ? "z-20 opacity-100" : "z-10 opacity-95 pointer-events-none"
  )}
>
```

### Animation Flow

1. **User clicks inactive tab**
   - `handleTabClick('strips')` or `handleTabClick('individual')`
   - Check if already active → early return
   - Check if animating → early return
   - Set `isAnimating = true`
   - Set `activeTab = newTab`

2. **CSS transitions execute**
   - Active table: slides forward (scale 0.98 → 1, translateY 4px → 0)
   - Inactive table: slides backward (scale 1 → 0.98, translateY 0 → 4px)
   - Duration: 400ms with ease-in-out easing

3. **Transition complete**
   - `onTransitionEnd` fires on the active table
   - Set `isAnimating = false`
   - Re-enable tab click interactions

### Preventing Layout Shift

Both tables exist in the DOM simultaneously. To prevent layout shift:
- Container uses `position: relative`
- Inactive table uses `position: absolute` with `inset: 0` to overlay exactly over active table
- Active table remains in normal flow
- **Alternative approach** (simpler): Both tables in same container, only one visible but both rendered

**Revised approach** (cleaner):
- Use a stacking context with both tables in the same parent
- Active table: `position: relative, z-index: 20`
- Inactive table: `position: absolute, top: 0, left: 0, right: 0, z-index: 10`
- This maintains layout space for the active table while overlaying the inactive one

```tsx
<div className="relative">
  <TariffTable
    isActive={activeTab === 'strips'}
    className={activeTab === 'strips' ? 'relative z-20' : 'absolute inset-x-0 top-0 z-10'}
    {...stripProps}
  />
  <TariffTable
    isActive={activeTab === 'individual'}
    className={activeTab === 'individual' ? 'relative z-20' : 'absolute inset-x-0 top-0 z-10'}
    {...individualProps}
  />
</div>
```

## Visual Overlapping Strategy

### Z-Index Layering

```
┌─────────────────────────────────┐
│  Inactive Tab (z-10, peeking)  │ ← Slightly scaled down, translated back
├─────────────────────────────────┤
│                                 │
│   Active Tab (z-20, foreground)│ ← Full scale, normal position
│                                 │
│                                 │
└─────────────────────────────────┘
```

### Tab Header Design

Both tables have their tab header integrated into the table structure:
- Strip table: Dark blue background (`bg-blue-900`) with white text, rounded top corners
- Individual table: White background with dark text, rounded top corners
- Active table: Full opacity, appears connected to table body
- Inactive table: Slightly faded, appears behind active table

**Tab header structure**:
```tsx
<div className="flex items-center justify-between px-6 py-3 cursor-pointer hover:opacity-90 transition-opacity"
     onClick={onTabClick}
     role="tab"
     aria-selected={isActive}
     tabIndex={0}
>
  <h3 className="text-xl font-bold">{title}</h3>
  {isActive && <ChevronDown className="w-5 h-5" />}
</div>
```

### Border Radius & Overlapping

- Active table: Rounded corners on top (for tab appearance)
- Inactive table: Top edge visible, creating the "peeking" effect
- Use `overflow-hidden` to clip content to rounded borders
- Shadow on active table to enhance depth perception

## Error Handling

### Animation Edge Cases

1. **Rapid tab switching**
   - **Problem**: User clicks tab multiple times during animation
   - **Solution**: Check `isAnimating` flag in `handleTabClick`, early return if true

2. **TransitionEnd not firing**
   - **Problem**: CSS transition interrupted or browser doesn't fire event
   - **Solution**: Add timeout fallback after 500ms to clear `isAnimating` flag

3. **Table with no rows**
   - **Problem**: Empty strip or individual tariff list
   - **Solution**: Render placeholder message "No hay tarifas en esta categoría"

### Validation Errors

- All existing validation logic remains unchanged
- Tab switching does not trigger validation
- Quantity inputs in both tables share the same validation rules as current implementation

### Accessibility Edge Cases

1. **Keyboard navigation between tables**
   - Tab headers are focusable (`tabIndex={0}`)
   - Enter/Space keys trigger tab switch
   - Focus management: when tab switches, maintain focus on header

2. **Screen reader announcements**
   - ARIA live region announces "Tabla de tiras activa" / "Tabla de tarifas individuales activa"
   - Use `aria-selected` on tab headers

## Testing Strategy

This feature involves **UI interactions, visual styling, and DOM manipulation** — areas where property-based testing does not apply. The testing strategy will focus on:

### Unit Tests (Example-Based)

1. **Component Rendering**
   - Verify TabbedTariffContainer renders both tables
   - Verify default active tab is "strips"
   - Verify strip table has dark blue background
   - Verify individual table has white background

2. **Tab Switching Logic**
   - Click inactive tab → activeTab state updates
   - Click active tab → no state change
   - Click during animation → no state change

3. **Row Filtering**
   - Static mode: rows correctly split by `isStrip` flag
   - Dynamic mode: rows correctly split by `_isStrip` flag

4. **Animation State Management**
   - `isAnimating` set to true on tab click
   - `isAnimating` cleared after transition ends
   - Timeout fallback clears `isAnimating` after 500ms

### Integration Tests

1. **Full Kiosko View Integration**
   - TabbedTariffContainer integrates correctly in KioskoView
   - Static mode (no activeTariffGroup) uses tabbed interface
   - Dynamic mode (with activeTariffGroup) uses tabbed interface

2. **State Persistence Across Tab Switches**
   - Enter quantities in strip table → switch to individual → switch back → quantities preserved
   - Toggle price mode → switch tabs → price mode persists

3. **Quantity Input Functionality**
   - Quantity inputs in strip table update store correctly
   - Quantity inputs in individual table update store correctly
   - Limit calculations reflect quantities from both tables

### Manual Testing (Visual & Interaction)

1. **Animation Smoothness**
   - Slide transition completes in 400ms
   - No jank or layout shift during transition
   - Easing feels natural

2. **Visual Overlapping**
   - Inactive table header visible behind active table
   - Z-index layering correct
   - Rounded corners render correctly

3. **Accessibility**
   - Tab key navigates between tab headers
   - Enter/Space keys switch tabs
   - Screen reader announces tab changes
   - Focus indicators visible

4. **Responsive Behavior**
   - Tables remain usable at current Kiosk viewport size
   - No horizontal scrolling

### Test Coverage Goals

- Component rendering: 100% (all render paths covered)
- Tab switching logic: 100% (all state transitions covered)
- Animation state: 100% (normal flow + timeout fallback)
- Integration with existing Kiosko functionality: High (all quantity/price/limit features tested)

### Testing Tools

- **Unit/Integration**: Vitest + React Testing Library
- **Accessibility**: @testing-library/jest-dom matchers + manual NVDA/JAWS testing
- **Visual**: Manual testing (no snapshot tests needed for initial implementation)

## Implementation Plan

### Phase 1: Component Extraction
1. Create `TariffTableContent.tsx` - extract table rendering logic
2. Test TariffTableContent with static rows
3. Test TariffTableContent with dynamic rows

### Phase 2: Tabbed Container
1. Create `TabbedTariffContainer.tsx` - implement tab state and layout
2. Create `TariffTable.tsx` - implement single table with tab header
3. Implement row filtering logic (split by `isStrip`)
4. Wire up tab click handlers (no animation yet)

### Phase 3: Animation
1. Implement CSS transition classes
2. Add `isAnimating` state management
3. Wire up `onTransitionEnd` handler
4. Add timeout fallback for animation cleanup
5. Test rapid clicking and edge cases

### Phase 4: Integration
1. Refactor `TariffTableSplit.tsx` to use TabbedTariffContainer
2. Refactor `DynamicTariffTable.tsx` to use TabbedTariffContainer
3. Test integration with KioskoView
4. Verify all existing functionality preserved

### Phase 5: Styling & Polish
1. Implement visual overlapping with z-index and transforms
2. Add rounded borders and shadows
3. Style tab headers (dark blue for strips, white for individual)
4. Test visual appearance across different states

### Phase 6: Accessibility
1. Add ARIA attributes (role, aria-selected, aria-label)
2. Implement keyboard navigation (Tab, Enter, Space)
3. Add screen reader announcements (aria-live region)
4. Manual testing with screen readers

## Risks and Mitigations

### Risk 1: Animation Performance
**Concern**: CSS transitions may cause jank on lower-end hardware
**Mitigation**: 
- Use `transform` and `opacity` only (GPU-accelerated properties)
- Avoid `height`, `width`, `top`, `left` animations
- Test on target hardware
- Add `will-change: transform` hint if needed

### Risk 2: Layout Complexity
**Concern**: Overlapping tables with absolute positioning may cause layout issues
**Mitigation**:
- Use simplified approach: relative active table, absolute inactive table
- Ensure inactive table matches active table dimensions
- Test with varying row counts (empty, few rows, many rows)

### Risk 3: State Synchronization
**Concern**: Quantities in both tables must stay synchronized via Zustand store
**Mitigation**:
- Single source of truth: Zustand store
- No local quantity state in tab components
- Both tables read from same store keys
- Test switching tabs with quantities in both

### Risk 4: Accessibility Gaps
**Concern**: Tab pattern may not be properly accessible
**Mitigation**:
- Follow WAI-ARIA tab pattern guidelines
- Manual testing with NVDA/JAWS screen readers
- Ensure keyboard navigation works before launch
- Add focus management on tab switch

### Risk 5: Breaking Changes
**Concern**: Refactoring TariffTableSplit and DynamicTariffTable may introduce bugs
**Mitigation**:
- Extract reusable components first, test in isolation
- Gradual integration: one component at a time
- Comprehensive integration testing
- Fallback: feature flag to revert to old tables if needed

## Success Metrics

1. **Functional**: All existing tariff table functionality works identically in both tabs
2. **Visual**: Tab switching animation is smooth (60fps) with clear visual feedback
3. **Accessible**: Keyboard navigation and screen reader support fully functional
4. **Performance**: No measurable performance regression in KioskoView render time
5. **Maintainable**: New components are reusable and easy to understand

## Future Enhancements

- Add keyboard shortcuts (Ctrl+1, Ctrl+2) to switch tabs
- Add tab badge with count (e.g., "Tiras (2)")
- Allow customizing default active tab via config
- Add swipe gesture support for touchscreen kiosks
- Animate individual rows sliding in/out instead of whole table
