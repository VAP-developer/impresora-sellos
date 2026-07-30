# Requirements Document

## Introduction

This feature enhances the Kiosko view by splitting the unified tariff table into two separate, visually distinct tables: one for strips (tiras) and one for individual tariffs (tarifas). The tables will be presented in a tabbed interface with overlapping visual design, where only one table is visible at a time. Users can switch between tables by clicking on the table name/tab, triggering a smooth slide transition animation.

## Glossary

- **Kiosko_View**: The main sales interface view that displays tariff tables, stamp models, and cart controls
- **Tariff_Table**: A component displaying pricing information and quantity inputs for ticket sales
- **Strip_Table**: A table component displaying only strip tariff rows (Tira A×4, Tira 4 Tar.)
- **Individual_Tariff_Table**: A table component displaying only individual tariff rows (Tarifa A, A2, B, C)
- **Tab_Component**: A clickable interface element that switches between Strip_Table and Individual_Tariff_Table
- **Active_Table**: The currently visible table in the tabbed interface
- **Hidden_Table**: The table that is not currently visible but shows a peeking border
- **Slide_Transition**: An animation where the current table slides backward and the new table slides forward
- **Rounded_Border**: CSS border-radius styling applied to table containers
- **Dark_Blue_Background**: A dark blue (approximately #1e3a8a or similar) background color with white text for the Strip_Table header
- **Sello_A**: Stamp model 1 (left side) quantity inputs and calculations
- **Sello_B**: Stamp model 2 (right side) quantity inputs and calculations

## Requirements

### Requirement 1: Split Tables by Tariff Type

**User Story:** As a kiosko operator, I want to see strips and individual tariffs in separate tables, so that I can focus on one category at a time without visual clutter.

#### Acceptance Criteria

1. THE Strip_Table SHALL display only strip tariff rows (Tira A×4, Tira 4 Tar.)
2. THE Individual_Tariff_Table SHALL display only individual tariff rows (Tarifa A, Tarifa A2, Tarifa B, Tarifa C)
3. THE Strip_Table SHALL have a dark blue background with white text
4. THE Individual_Tariff_Table SHALL maintain the current white background styling
5. THE Strip_Table SHALL have rounded borders
6. THE Individual_Tariff_Table SHALL have rounded borders
7. FOR ALL tables, the grid column structure SHALL remain: [Subtotal | Límite | Cantidad | Modalidad | Precio | Cantidad | Límite | Subtotal]

### Requirement 2: Tabbed Interface with Visual Overlapping

**User Story:** As a kiosko operator, I want to see tables displayed in a tab-like interface with visual overlap, so that I have a clear indication of available tables and the active selection.

#### Acceptance Criteria

1. THE Kiosko_View SHALL display exactly one Active_Table at any given time
2. THE Hidden_Table SHALL display its top border peeking from behind the Active_Table
3. THE Active_Table SHALL be positioned in front of the Hidden_Table (higher z-index)
4. THE Tab_Component SHALL be visually integrated with the table header
5. THE Active_Table's Tab_Component SHALL appear connected to its table body
6. THE Hidden_Table's Tab_Component SHALL appear behind the Active_Table
7. WHEN no user interaction has occurred, THE Strip_Table SHALL be the default Active_Table

### Requirement 3: Tab Switching Interaction

**User Story:** As a kiosko operator, I want to click on a table name to switch between strip and individual tariff tables, so that I can quickly access the category I need.

#### Acceptance Criteria

1. WHEN the user clicks the Strip_Table Tab_Component, THE Strip_Table SHALL become the Active_Table
2. WHEN the user clicks the Individual_Tariff_Table Tab_Component, THE Individual_Tariff_Table SHALL become the Active_Table
3. WHEN the user clicks the currently Active_Table's Tab_Component, THE system SHALL not trigger a transition
4. THE Tab_Component SHALL have hover states to indicate clickability
5. THE Tab_Component SHALL have an accessible click target of at least 44px in height

### Requirement 4: Slide Transition Animation

**User Story:** As a kiosko operator, I want smooth visual feedback when switching between tables, so that the interface feels responsive and I can track the transition.

#### Acceptance Criteria

1. WHEN the user switches tables, THE current Active_Table SHALL slide backward (away from viewer)
2. WHEN the user switches tables, THE new Active_Table SHALL slide forward (toward viewer)
3. THE Slide_Transition SHALL complete within 300ms to 500ms
4. THE Slide_Transition SHALL use easing functions for smooth motion (e.g., ease-in-out)
5. DURING the Slide_Transition, user input on Tab_Components SHALL be disabled
6. WHEN the Slide_Transition completes, user input SHALL be re-enabled
7. THE Slide_Transition SHALL maintain table position within the layout (no layout shift)

### Requirement 5: Preserve Existing Functionality

**User Story:** As a kiosko operator, I want all current table features to work identically in the new tabbed interface, so that my workflow is not disrupted.

#### Acceptance Criteria

1. THE Strip_Table SHALL maintain all quantity input functionality for Sello_A and Sello_B
2. THE Individual_Tariff_Table SHALL maintain all quantity input functionality for Sello_A and Sello_B
3. THE price toggle (local/secondary) SHALL remain functional and apply to both tables
4. THE subtotal calculations SHALL remain accurate for both tables
5. THE limit displays SHALL remain accurate for both tables
6. WHEN the user switches tables, THE quantity values SHALL persist in both tables
7. THE Zustand store state (useKioskoStore) SHALL continue to manage all quantities, limits, and price toggles

### Requirement 6: Accessibility and Responsiveness

**User Story:** As a kiosko operator using assistive technologies, I want the tabbed interface to be keyboard-navigable and screen-reader friendly, so that I can operate the system effectively.

#### Acceptance Criteria

1. THE Tab_Components SHALL be keyboard-focusable using Tab key
2. WHEN a Tab_Component has keyboard focus, pressing Enter or Space SHALL activate the tab
3. THE Active_Table SHALL have ARIA attributes indicating its selected state (aria-selected="true")
4. THE Hidden_Table SHALL have ARIA attributes indicating its unselected state (aria-selected="false")
5. THE tabbed interface SHALL use semantic ARIA roles (role="tablist", role="tab", role="tabpanel")
6. THE screen reader SHALL announce tab changes when the Active_Table changes
7. THE tables SHALL remain responsive and functional at the current viewport size used by Kiosko_View

### Requirement 7: Technology Stack Compliance

**User Story:** As a developer, I want the tabbed interface implemented using the existing technology stack, so that the codebase remains consistent and maintainable.

#### Acceptance Criteria

1. THE tabbed interface SHALL be implemented using React functional components
2. THE tabbed interface SHALL be implemented using TypeScript with strict type checking
3. THE styling SHALL use Tailwind CSS utility classes
4. THE animation SHALL use CSS transitions or Tailwind's transition utilities
5. THE state management SHALL use the existing Zustand store (useKioskoStore)
6. THE component structure SHALL integrate with the existing KioskoView layout
7. THE implementation SHALL not introduce new external dependencies beyond the current stack

