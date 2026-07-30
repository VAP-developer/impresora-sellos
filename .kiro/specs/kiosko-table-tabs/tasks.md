# Implementation Plan: Kiosko Table Tabs

## Overview

This implementation plan transforms the unified tariff table into a tabbed interface with two separate tables (strips and individual tariffs). The work is organized into 6 phases following the architecture outlined in the design document. Each phase builds incrementally, with checkpoints to validate functionality before moving forward.

The implementation uses TypeScript with React, Tailwind CSS for styling, and integrates with the existing Zustand store for state management.

## Tasks

- [ ] 1. Phase 1: Component Extraction
  - [x] 1.1 Create TariffTableContent component
    - Create `src/renderer/src/components/kiosko/TariffTableContent.tsx`
    - Extract table rendering logic from TariffTableSplit (header row + data rows)
    - Accept props: `rows`, `quantities`, `setQuantity`, `limits`, `showSecondary`, `toggleSecondary`, `currencySymbol`
    - Render grid layout with 8 columns: [Subtotal | Límite | Cantidad | Modalidad | Precio | Cantidad | Límite | Subtotal]
    - Include price toggle button in header
    - Make component fully stateless (pure presentation)
    - _Requirements: 1.7, 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 1.2 Write unit tests for TariffTableContent
    - Test component renders with empty rows array
    - Test component renders with static rows (strips + individual)
    - Test quantity input onChange handlers call setQuantity correctly
    - Test subtotal calculations display correctly
    - Test price toggle button calls toggleSecondary
    - _Requirements: 1.7, 5.1, 5.2_

- [x] 2. Phase 2: Tabbed Container Structure
  - [x] 2.1 Create TariffTable wrapper component
    - Create `src/renderer/src/components/kiosko/TariffTable.tsx`
    - Accept props: `title`, `rows`, `isActive`, `isStrip`, `isAnimating`, `onTabClick`, plus TariffTableContent props
    - Render tab header with title and click handler
    - Apply conditional styling based on `isStrip` (dark blue vs white background)
    - Add ARIA attributes: `role="tab"`, `aria-selected`, `tabIndex={0}`
    - Render TariffTableContent inside table body
    - Apply z-index and positioning styles based on `isActive` prop
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.4, 6.3, 6.4, 6.5_
  
  - [x] 2.2 Create TabbedTariffContainer orchestrator component
    - Create `src/renderer/src/components/kiosko/TabbedTariffContainer.tsx`
    - Accept props: `stripRows`, `individualRows`, and all TariffTableContent props
    - Initialize local state: `activeTab: 'strips' | 'individual'` (default: 'strips')
    - Initialize local state: `isAnimating: boolean` (default: false)
    - Render both TariffTable components (strips and individual) in stacking container
    - Implement `handleTabClick` to update activeTab state
    - Prevent tab switching when already active or currently animating
    - Add ARIA attributes: `role="tablist"` on container
    - _Requirements: 2.1, 2.2, 2.7, 3.1, 3.2, 3.3, 6.1, 6.5_
  
  - [ ]* 2.3 Write unit tests for tab switching logic
    - Test default active tab is 'strips'
    - Test clicking inactive tab updates activeTab state
    - Test clicking active tab does not trigger state change
    - Test clicking tab during animation does not trigger state change
    - Test both tables receive correct isActive prop values
    - _Requirements: 2.7, 3.1, 3.2, 3.3_

- [x] 3. Checkpoint - Verify tabbed structure without animation
  - Ensure both tables render correctly
  - Ensure tab clicking switches between tables (instant, no animation yet)
  - Ensure strip table has dark blue background, individual table has white background
  - Ask the user if questions arise.

- [x] 4. Phase 3: Slide Transition Animation
  - [x] 4.1 Implement CSS transition classes and styles
    - Add transition styles to TariffTable component
    - Active table: `z-index: 20`, `transform: scale(1) translateY(0)`, `opacity: 1`
    - Inactive table: `z-index: 10`, `transform: scale(0.98) translateY(4px)`, `opacity: 0.95`, `pointer-events: none`
    - Apply `transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1)` to both states
    - Use inline styles for precise transform values (Tailwind doesn't have scale-98)
    - Add rounded borders and shadow to active table
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7_
  
  - [x] 4.2 Add animation state management
    - In TabbedTariffContainer, set `isAnimating = true` when tab is clicked
    - Pass `isAnimating` prop to both TariffTable components
    - Implement `onTransitionEnd` handler on TariffTable to clear animation flag
    - Ensure `onTransitionEnd` only fires for the active table (not both)
    - Add timeout fallback: clear `isAnimating` after 500ms if transitionEnd doesn't fire
    - Clean up timeout on component unmount
    - _Requirements: 4.5, 4.6_
  
  - [ ]* 4.3 Write unit tests for animation state
    - Test `isAnimating` is set to true on tab click
    - Test `isAnimating` is cleared after transitionEnd event
    - Test timeout fallback clears `isAnimating` after 500ms
    - Test rapid clicking is prevented during animation
    - _Requirements: 4.5, 4.6_

- [x] 5. Phase 4: Integration with Existing Components
  - [x] 5.1 Refactor TariffTableSplit to use TabbedTariffContainer
    - Keep all existing row definitions, quantities, limits logic in TariffTableSplit
    - Split rows array into `stripRows` (filter by `isStrip === true`) and `individualRows` (filter by `isStrip === false`)
    - Pass both row arrays to TabbedTariffContainer
    - Pass quantities, setQuantity, limits, showSecondary, toggleSecondary as props
    - Remove old unified table rendering code
    - Maintain all existing prop interfaces and store integrations
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [x] 5.2 Refactor DynamicTariffTable to use TabbedTariffContainer
    - Keep all existing row construction logic (from activeTariffGroup + activeEvento)
    - Add `_isStrip` flag to row objects during construction
    - Split rows array into `stripRows` and `individualRows` based on `_isStrip` flag
    - Pass both row arrays to TabbedTariffContainer
    - Pass dynamic quantities, setQuantity, limits, toggleSecondary as props
    - Set `isDynamic={true}` prop if styling differences are needed
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  
  - [ ]* 5.3 Write integration tests for KioskoView
    - Test static mode (no activeTariffGroup) renders TabbedTariffContainer via TariffTableSplit
    - Test dynamic mode (with activeTariffGroup) renders TabbedTariffContainer via DynamicTariffTable
    - Test switching tabs preserves quantity values in both tables
    - Test price toggle affects both tables
    - Test subtotal and limit calculations remain accurate across tab switches
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 6. Checkpoint - Verify complete integration
  - Ensure TariffTableSplit uses tabbed interface correctly
  - Ensure DynamicTariffTable uses tabbed interface correctly
  - Ensure all quantity inputs update Zustand store correctly
  - Ensure switching tabs preserves all quantity values
  - Ensure price toggle works in both tables
  - Ensure all tests pass
  - Ask the user if questions arise.

- [x] 7. Phase 5: Visual Polish and Styling
  - [x] 7.1 Implement visual overlapping effect
    - Position inactive table with `position: absolute` and `inset-x-0 top-0`
    - Position active table with `position: relative`
    - Ensure inactive table header peeks from behind active table
    - Apply rounded top corners to tab headers (strip and individual)
    - Add `border-radius` to table containers
    - Test with varying row counts (empty, few rows, many rows)
    - _Requirements: 1.5, 1.6, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 7.2 Style tab headers for strips vs individual
    - Strip table tab: dark blue background (`bg-blue-900` or similar), white text, rounded top corners
    - Individual table tab: white background, dark text, rounded top corners
    - Add hover states to both tab headers (opacity change or subtle color shift)
    - Ensure active tab appears connected to table body (no visible border between header and body)
    - Ensure inactive tab header has reduced opacity to indicate background state
    - Add accessible click target sizing (minimum 44px height)
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.3, 2.4, 2.5, 3.4, 3.5_
  
  - [x] 7.3 Add shadows and depth perception
    - Apply `shadow-lg` to active table for depth
    - Reduce or remove shadow on inactive table
    - Test visual appearance in different lighting conditions (if applicable)
    - _Requirements: 2.3, 2.4_

- [x] 8. Phase 6: Accessibility Implementation
  - [x] 8.1 Implement keyboard navigation
    - Ensure tab headers are keyboard-focusable (already have `tabIndex={0}`)
    - Add `onKeyDown` handler to tab headers
    - Pressing Enter or Space on focused tab header should activate that tab
    - Ensure Tab key navigates between the two tab headers
    - Test focus indicators are visible on keyboard focus
    - _Requirements: 6.1, 6.2_
  
  - [x] 8.2 Add ARIA live region for screen reader announcements
    - Add ARIA live region to TabbedTariffContainer
    - Update live region message when activeTab changes
    - Announce "Tabla de tiras activa" when strips tab is selected
    - Announce "Tabla de tarifas individuales activa" when individual tab is selected
    - Use `aria-live="polite"` to avoid interrupting user
    - _Requirements: 6.6_
  
  - [x] 8.3 Verify ARIA semantics and roles
    - Ensure container has `role="tablist"`
    - Ensure each tab header has `role="tab"`
    - Ensure each table body has `role="tabpanel"`
    - Ensure active tab has `aria-selected="true"`
    - Ensure inactive tab has `aria-selected="false"`
    - Ensure each tabpanel has `aria-labelledby` pointing to its tab header
    - _Requirements: 6.3, 6.4, 6.5_
  
  - [ ]* 8.4 Manual accessibility testing checklist
    - Test keyboard navigation with Tab, Enter, and Space keys
    - Test with NVDA screen reader (if available) to verify announcements
    - Test with JAWS screen reader (if available) to verify announcements
    - Verify focus indicators are visible and clear
    - Verify tab switching works without mouse
    - Verify quantity inputs remain accessible via keyboard in both tables
    - _Requirements: 6.1, 6.2, 6.6, 6.7_

- [x] 9. Final checkpoint and verification
  - Run all unit and integration tests
  - Verify animation is smooth (no jank or layout shift)
  - Verify visual overlapping effect looks correct
  - Verify accessibility features work as expected
  - Test with empty row arrays (edge case)
  - Test rapid tab switching behavior
  - Ensure all tests pass
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements from the requirements document for traceability
- Checkpoints ensure incremental validation and reduce risk of integration issues
- Property-based testing is not applicable for this feature (UI interactions, visual styling, DOM manipulation)
- Manual accessibility testing (task 8.4) is critical for WCAG compliance but cannot be fully automated
- The implementation follows the 6-phase architecture outlined in the design document
- All existing functionality (quantities, limits, price toggle) is preserved throughout the refactoring
