# Slash Dashboard Redesign Brief for Google Stitch

This document is a production-level design blueprint for generating a clean redesign of the Slash internal dashboard.
It is based on the live app structure and current implementation.

Use this exactly as a source brief for Google Stitch.

## 1) Product Context

### 1.1 Product Name
Slash Invoices (internal operations dashboard)

### 1.2 Primary Jobs To Be Done
1. Manage billing contacts quickly.
2. Create and track invoices with reliable Slash links.
3. Create eSignatures contracts from a shared template.
4. Configure Slash account-level settings safely.

### 1.3 User Type
Internal team operations users (not public consumers).

### 1.4 App Navigation
1. Contacts
2. Invoices
3. Contracts
4. Settings

### 1.5 Critical UX Constraints
1. Keep dense operational information visible.
2. Keep forms fast and readable.
3. Preserve current data model and labels.
4. Preserve clear status visibility across invoices/contracts.
5. Keep dark-mode-first fintech feel.

---

## 2) Artboards and Breakpoints

Design all screens in these exact frame sets.

### 2.1 Desktop
1. Primary frame: 1440 x 1024
2. Secondary frame: 1280 x 900

### 2.2 Tablet
1. Frame: 1024 x 768

### 2.3 Mobile
1. Frame: 390 x 844 (iPhone style)

### 2.4 Breakpoints (Tailwind defaults)
1. `sm`: 640
2. `md`: 768
3. `lg`: 1024
4. `xl`: 1280
5. `2xl`: 1536

---

## 3) Layout System (Pixel Spec)

### 3.1 Global Shell
1. App uses full viewport height: `100vh`.
2. Left sidebar width expanded: `224px` (`w-56`).
3. Left sidebar width collapsed: `64px` (`w-16`).
4. Sidebar header height: `56px` (`h-14`).
5. Main content is scrollable; sidebar is fixed in-column.
6. Main content wrapper max width: `1152px` (`max-w-6xl`).
7. Main wrapper padding: `24px` all sides (`p-6`).

### 3.2 Surface Geometry
1. Card radius: `8px` (`rounded-lg` when radius token is 8px).
2. Input radius: `6px` (`rounded-md`).
3. Button radius: `6px` (`rounded-md`).
4. Border thickness: `1px`.

### 3.3 Spacing Scale (used in app)
1. `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`.
2. Primary section gap on pages: `24px`.
3. Internal card padding: mostly `20px` (`p-5`) or `24px` (`p-6`).

---

## 4) Typography System

### 4.1 Font Family
General Sans, fallback Inter/system sans.

### 4.2 Type Ramp
1. Page title: `20px`, semibold.
2. Card title: `16px`, semibold.
3. Body/default: `14px`.
4. Small/supporting: `12px`.
5. Table headers: `12px`, uppercase, medium.

### 4.3 Numeric Formatting
1. Money values in monospaced style treatment (visual intent).
2. Date format examples: `05 Apr 2026` and `05 Apr 2026, 8:23 pm` style.

---

## 5) Color and Theme Tokens (Dark First)

Use these HSL tokens as the base palette.

1. Background: `hsl(222 27% 8%)`
2. Foreground: `hsl(220 14% 84%)`
3. Card: `hsl(222 22% 11%)`
4. Muted background: `hsl(222 18% 16%)`
5. Border/Input: `hsl(222 14% 18%)`
6. Primary blue: `hsl(217 91% 60%)`
7. Muted text: `hsl(220 10% 50%)`
8. Success tint: emerald variants
9. Warning tint: amber variants
10. Danger tint: red variants

Status badge semantics:
1. Paid/Signed = success.
2. Unpaid/Sent = warning.
3. Overdue/Withdrawn = danger.
4. Draft/Void = muted.

---

## 6) Core Component Specs (Exact)

### 6.1 Buttons
1. Default height: `40px`.
2. Small height: `36px`.
3. Icon button: `40x40`.
4. States: default, hover, focus ring, disabled.
5. Variants: default, outline, ghost, destructive, secondary, link.

### 6.2 Inputs
1. Height: `40px`.
2. Horizontal padding: `12px`.
3. Placeholder text muted.
4. Focus ring visible (`2px`) in primary color.

### 6.3 Badges
1. Pill shape.
2. Size: small (`text-xs`), compact vertical padding.
3. Semantic color variants as above.

### 6.4 Tables
1. Header row background muted.
2. Header cell padding: `16px horizontal`, `12px vertical`.
3. Body cell padding: `16px horizontal`, `12px vertical`.
4. Row hover highlight.

### 6.5 Modals
1. Full-screen overlay with dark scrim (`~60% black`).
2. Centered card.
3. Typical widths:
   - Contact modal: max `448px` (`max-w-md`)
   - Invoice modal: max `512px` (`max-w-lg`)
4. Border + shadow + rounded corners.

---

## 7) Information Architecture

### 7.1 Route Map
1. `/login`
2. `/contacts`
3. `/invoices`
4. `/invoices/[id]`
5. `/contracts`
6. `/contracts/[id]`
7. `/settings`

### 7.2 Auth Gating
1. `/` redirects to `/contacts` when authenticated.
2. `/` redirects to `/login` when not authenticated.
3. All dashboard routes require session.

---

## 8) Exact Screen Specifications

## Screen A: Login / Register

### Frame
Desktop center stack, single column, max width `384px` (`max-w-sm`).

### Structure
1. Top logo mark in rounded square (`48x48` visual block).
2. Product title.
3. Subtitle changes by mode (Sign in vs Create account).
4. Form:
   - Name (register only)
   - Email
   - Password
5. Error alert inline.
6. Primary submit button full width.
7. Bottom mode switch link.

### Interactions
1. Toggle between register/login without route change.
2. Register auto-signs-in.
3. On success route to `/contacts`.

### Empty/Error/Loading
1. Loading state text in button: `Please wait...`.
2. Error banner in red tinted block.

---

## Screen B: Contacts List

### Header
1. Left: icon + `Contacts` title.
2. Right: `New Contact` button.

### Controls
1. Search bar with leading search icon.
2. Search clear icon button appears when query exists.
3. Optional result count text when searching.

### Table
Columns:
1. Name
2. Legal Name
3. Email

### States
1. Loading spinner center.
2. Empty state (no contacts yet) with CTA.
3. Empty search state (`No contacts found`) with clear search CTA.

### Modal: New Contact
Fields:
1. Display Name (required)
2. Legal Name
3. Email (required)
Actions:
1. Cancel
2. Create Contact

---

## Screen C: Invoices List (Primary Operational Screen)

### Header
1. Left: icon + `Invoices`.
2. Right: `Export CSV` (conditional when rows exist) + `New Invoice`.

### Success Banner (post-create)
1. Confirmation text.
2. `Copy Slash Link`.
3. `Open Slash Invoice` when link available.
4. Disabled `Link Pending` when link unavailable.

### Filters + Search Row
1. Status segmented tabs:
   - All
   - Unpaid
   - Paid
   - Overdue
   - Void
2. Right aligned search input:
   - Placeholder: invoice #, customer, email, status

### Invoice Table
Columns:
1. Invoice #
2. Customer
3. Issued
4. Due
5. Amount
6. Status
7. Link

### Row Behavior
1. Entire row is clickable to expand/collapse.
2. Chevron indicator flips on expansion.
3. Expanded panel shows:
   - Customer email
   - Document ID
   - Internal invoice ID
   - Memo
   - `Open Slash Invoice` button
4. `Copy Slash Link` button is always available in row action column.

### States
1. Loading spinner.
2. No invoices found state with `Create Invoice`.
3. No matching invoices state with `Clear Search`.

---

## Screen D: Invoice Creation Modal

### Modal Width
Max `512px` (`max-w-lg`), scrollable content when tall.

### Field Groups
1. Bill To (contact select, required)
2. Issue Date (required, type date)
3. Due Date (required, type date)
4. Invoice Number (optional)
5. Line Items (repeatable rows)
6. Discount %
7. Tax %
8. Totals preview block
9. Memo (optional textarea)

### Line Item Row Spec
1. Description input
2. Quantity input (min 1)
3. Price input (step 0.01)
4. Remove icon button (`32px` column)
5. Add line item button below row set

### Actions
1. Cancel
2. Create Invoice

---

## Screen E: Invoice Detail

### Header Block
1. `Back to Invoices` ghost button.
2. Invoice number title.
3. Subtitle.
4. Actions:
   - `Copy Slash Link`
   - `Open in New Tab` (Slash link)

### Content Grid
Desktop split: left 2fr, right 1fr.

Left column cards:
1. Status + Document ID + core metadata (issue date, due date, customer, email)
2. Line items list

Right column cards:
1. Totals
2. Memo

### States
1. Loading spinner.
2. Error banner.
3. Fallback text when Slash omits line items.

---

## Screen F: Contracts Workspace

This is a two-column operational command center.

### Main Layout
Desktop grid: `1.4fr / 0.9fr`.

### Left Column Card: Create Contract
Sections:
1. Header with `Edit Template` action.
2. Template + Prefill Contact selects.
3. Contract title + metadata inputs.
4. Signer details block:
   - Name
   - Email
   - Mobile
   - Company
5. Placeholder fields block:
   - Dynamically generated from selected template.
   - Date placeholders use `type="date"`.
6. Signer defaults block:
   - Dynamically generated signer field IDs.
7. Draft-first checkbox:
   - Label indicates safe review flow.
8. Submit button:
   - `Create Draft` or `Create and Send` depending on checkbox.

### Right Column Cards
1. Selected Template summary:
   - Title
   - Placeholder count
   - Signer defaults count
   - Actions: Edit, Refresh Fields
2. Safety Defaults explanatory list

### Bottom Card: Contract History Table
Columns:
1. Contract
2. Signer
3. Status
4. Created
5. Actions

Actions per row:
1. View
2. Copy Link
3. Open Sign Page (if available)
4. Refresh

### States
1. Full-page loading spinner.
2. Error alert.
3. Success alert.
4. Empty history state.

---

## Screen G: Contract Detail

### Header
1. Back button.
2. Title + subtitle.
3. Actions:
   - Copy Link
   - Open Sign Page (conditional)
   - Refresh Status

### Body Layout
Desktop grid: `1fr / 0.9fr`.

Left column:
1. Status and metadata card.
2. Signer info card.

Right column:
1. Placeholder Values card.
2. Signer Field Defaults card.
3. Signer Field Values card.
4. Open Signed PDF action if available.

### States
1. Loading spinner.
2. Error alert.
3. Empty/fallback text for each values section.

---

## Screen H: Settings

### Header
1. Icon + `Settings`.

### Card 1: Slash API Connection
1. Title + connection status pill (`Connected` / `Disconnected`).
2. Masked key display when connected.
3. API key input with show/hide icon toggle.
4. Connect button.

### Card 2: Account Preferences (conditional on API key)
1. Legal Entity select.
2. Default Account select.
3. Save Preferences action.
4. Inline loading indicator when entities/accounts are loading.

### Bottom Messaging
1. Error alert block.
2. Success alert block.

---

## 9) Behavioral Rules To Preserve

1. Sidebar is collapsible and remembers active route visually.
2. All dashboard pages require authentication.
3. Invoices list search is client-side over loaded rows.
4. Invoice status tabs trigger filtered fetch.
5. Invoice row is expandable.
6. Copy Slash Link uses actual Slash invoice URL logic, not dashboard URL.
7. Contract creation supports dynamic template placeholder fields and signer defaults.
8. Contract mode defaults to draft-first in current UX.

---

## 10) Motion and Interaction Guidance

1. Keep transitions subtle (150ms to 220ms).
2. Row hover and focus states must be visible.
3. Expand/collapse rows should animate height/opacity.
4. Button presses should have clear tactile visual feedback.
5. Preserve clear disabled states for pending link/loading actions.

---

## 11) Accessibility and Usability Requirements

1. Minimum touch target `40x40`.
2. Visible focus ring on all interactive controls.
3. Maintain sufficient contrast in dark mode for text and status pills.
4. Keyboard navigable modals with ESC close and focus trap.
5. Use semantic headings and table roles.
6. Keep form labels explicit and persistent.

---

## 12) Stitch Generation Prompt (Copy/Paste)

Use this prompt in Google Stitch:

"Design a premium dark-mode internal fintech dashboard called Slash Invoices. Keep the exact IA and workflows from this spec: Login/Register, Contacts list + create modal, Invoices list with status tabs/search/expandable rows + create modal + invoice detail, Contracts workspace with template-driven form + history table + contract detail, and Settings with API connection + account preferences. Use General Sans-like typography, 8px radius card system, 1px subtle borders, high-contrast readable dark palette, and compact but elegant spacing. Desktop first at 1440x1024 with responsive tablet/mobile variants. Include full state coverage: loading, empty, no results, error, success, disabled, copied, link pending. Preserve all table columns, all labels, and all action buttons listed in the brief. Keep components production-feasible and consistent across screens."

---

## 13) Deliverable Expectations for Design Output

Ask Stitch to output:

1. One full desktop flow file with all screens.
2. Mobile adaptations for all primary screens.
3. Component sheet:
   - Buttons
   - Inputs
   - Selects
   - Badges
   - Tables
   - Alerts
   - Modals
4. Interaction notes for expand rows, modal open/close, and copy states.
5. Tokens sheet (color, type, spacing, radius, shadow).

---

## 14) Optional Visual Upgrade Direction (If You Want A Bolder Redesign)

1. Increase surface contrast between page background and cards slightly.
2. Introduce one signature accent gradient only for CTA highlights.
3. Add lightweight data chips for quick filtering context.
4. Use sticky table headers on long lists.
5. Add compact KPI row on invoices/contracts list tops.

Do not remove existing fields or alter operational behavior while restyling.

