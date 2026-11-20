# System Architecture Task Audit & Test Case Specification

> **Status**: Active / Source of Truth  
> **Last Verification**: 2026-11-20  
> **Audit Test Suite Result**: **22 / 22 Tests PASSED** (`test/test_architecture_audit.ts`)  

This document provides a line-by-line audit of the entire architecture specification detailed in the [`ARCHITECTURE/`](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/README.md) directory. Each architectural task contains a **Desired Result** (formal acceptance criteria) and a corresponding automated **Test Case** that validates compliance.

---

## Audit Matrix Overview

```
                                 ARCHITECTURE TASK AUDIT MATRIX
                                (22 Certified Verifications)
                                              │
         ┌─────────────────────────┬──────────┴──────────┬─────────────────────────┐
         ▼                         ▼                     ▼                         ▼
┌──────────────────┐     ┌──────────────────┐  ┌──────────────────┐      ┌──────────────────┐
│ MODULE 1: CANVAS │     │ MODULE 2: BRIDGE │  │ MODULE 3: PRIVACY│      │ MODULE 4: DATA   │
│ & GENERATIONS    │     │ & VIEW LINEAGE   │  │ & FAMILY CODES   │      │ & PARTITIONING   │
├──────────────────┤     ├──────────────────┤  ├──────────────────┤      ├──────────────────┤
│ 6 Audit Tasks    │     │ 6 Audit Tasks    │  │ 6 Audit Tasks    │      │ 4 Audit Tasks    │
│ (TEST-ARCH-01-*) │     │ (TEST-ARCH-02-*) │  │ (TEST-ARCH-03-*) │      │ (TEST-ARCH-04-*) │
│ Status: 6/6 PASS │     │ Status: 6/6 PASS │  │ Status: 6/6 PASS │      │ Status: 4/4 PASS │
└──────────────────┘     └──────────────────┘  └──────────────────┘      └──────────────────┘
```

---

## Module 1: Infinite Canvas & Generational Cohort Rows

Reference Specification: [`ARCHITECTURE/01-INFINITE-CANVAS-AND-GENERATIONS.md`](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/01-INFINITE-CANVAS-AND-GENERATIONS.md)

### Task 1.1: 2D Generational Plane Structure & 440px Pitch Rhythm
- **Architecture Statement**: The canvas vertical axis ($Y$) is divided into standardized horizontal generation strips, descending from earliest ancestors down to modern descendants, governed by an exact $440\text{px}$ generational grid rhythm ($Y_{n+1} - Y_n = 440\text{px}$).
- **Desired Result**:
  1. The layout engine produces exactly 11 generational cohort lanes (from Gilded Generation at $Y = 0\text{px}$ to Generation Beta at $Y = 4400\text{px}$).
  2. Every consecutive generation lane has an identical vertical pitch of exactly $440\text{px}$.
  3. Nodes within a lane are positioned at the standardized $+140\text{px}$ baseline offset.
- **Test Case**: `TEST-ARCH-01-01`
- **Verification Result**: **PASS**

---

### Task 1.2: Generation Epoch Year Boundaries
- **Architecture Statement**: Birth years must map deterministically to their historical epoch (Gilded: 1843–1859, Missionary: 1860–1882, Lost: 1883–1900, Greatest: 1901–1927, Silent: 1928–1945, Baby Boomers: 1946–1964, Gen X: 1965–1980, Millennials: 1981–1996, Gen Z: 1997–2012, Gen Alpha: 2013–2024, Gen Beta: 2025–2039).
- **Desired Result**:
  1. Ramayya Chetty Paradarami (born 1947) is placed in `baby_boomers` ($1946 – 1964$).
  2. Jagannadham Konukuru (born 1972) is placed in `gen_x` ($1965 – 1980$).
  3. Navaneeth Galeti (born 2006) is placed in `gen_z` ($1997 – 2012$).
- **Test Case**: `TEST-ARCH-01-02`
- **Verification Result**: **PASS**

---

### Task 1.3: Kinship Generational Inference (No Artificial "Unknown" Strip)
- **Architecture Statement**: Members lacking recorded birth years must NOT be lumped into an artificial "Unknown" row. Their generational placement must be inferred through spousal and parental kinship.
- **Desired Result**:
  1. Murthy Chetty & Sarojamma Konukuru (`birth_date = null`) are inferred into `silent` ($Y = 1900\text{px}$) because their children are in Generation X.
  2. The artificial lane `unknown_birth_year` is completely purged and excluded from active tree layouts.
- **Test Case**: `TEST-ARCH-01-03`
- **Verification Result**: **PASS**

---

### Task 1.4: Multi-House Coexistence on Global Generational Continuum
- **Architecture Statement**: Independent house lineages (House of Konukuru, House of Paradarami, and future houses) share the exact same global generational timeline.
- **Desired Result**:
  1. Both `layout-konukuru.json` and `layout-paradarami.json` define the exact same 11 generational lanes with identical $Y$ positions.
  2. Members of either house occupy the same generational band if they share the same era.
- **Test Case**: `TEST-ARCH-01-04`
- **Verification Result**: **PASS**

---

### Task 1.5: Sticky Generation Labels Inverse-Zoom Scaling Law
- **Architecture Statement**: Generation titles on the left sidebar scale inversely with viewport zoom: $\text{Scale} = \min(1.85, \max(0.65, (1/\max(0.18, z))^{0.58}))$, enlarging on zoom out and shrinking on zoom in.
- **Desired Result**:
  1. At macro zoom out ($z = 0.2$), generation titles enlarge to $\ge 1.8\times$ (approx $80\text{px}$) for total readability.
  2. At neutral zoom ($z = 1.0$), scale is exactly $1.0\times$ ($32\text{px}$).
  3. At micro zoom in ($z = 2.0$), scale shrinks to $\le 0.7\times$ ($21\text{px}$) to avoid obstructing person portraits.
  4. Positioning is hardware-accelerated at $V_y + (Y_{\text{lane}} + 24) \times z$ with zero lag.
- **Test Case**: `TEST-ARCH-01-05`
- **Verification Result**: **PASS**

---

### Task 1.6: Person Node Proportional Zoom & Typographic Rules
- **Architecture Statement**: Circular portrait cards scale adaptively ($\text{Scale} = \min(2.5, \max(0.6, (1/\max(0.1, z))^{2/3}))$). The Given Name is centered on Line 1, Surname is centered on Line 2, followed by `† Deceased` for deceased relatives.
- **Desired Result**:
  1. At zoom $z = 0.25$, node scale expands to $> 2.0\times$.
  2. Full names split cleanly: Given Name on Line 1, Surname on Line 2 (e.g., "Murthy Chetty" on line 1, "Konukuru" on line 2).
  3. Status `† Deceased` is rendered only for non-living members.
- **Test Case**: `TEST-ARCH-01-06`
- **Verification Result**: **PASS**

---

## Module 2: Cross-Lineage Marriages & "View Lineage"

Reference Specification: [`ARCHITECTURE/02-CROSS-LINEAGE-MARRIAGES-AND-VIEW-LINEAGE.md`](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/02-CROSS-LINEAGE-MARRIAGES-AND-VIEW-LINEAGE.md)

### Task 2.1: Graph Explosion Prevention & Non-Lineage Spouse Isolation
- **Architecture Statement**: In-law spouses from external houses are rendered as single clean nodes within the primary tree; their parents and collateral relatives are excluded from the default resting layout.
- **Desired Result**:
  1. In the default Konukuru layout, Suguna Konukuru is present as spouse to Jagannadham.
  2. Suguna's parents (*Ramayya Chetty* and *Achamma*) and sister (*Rada Galeti*) are strictly excluded from the resting nodes list.
- **Test Case**: `TEST-ARCH-02-01`
- **Verification Result**: **PASS**

---

### Task 2.2: Bilateral "View Lineage" Availability
- **Architecture Statement**: The "View Lineage" trigger button appears on non-lineage spouses in marriage relationships, functioning symmetrically in both directions.
- **Desired Result**:
  1. In House of Konukuru, Suguna (incoming spouse) displays the "View Lineage" button.
  2. In House of Paradarami, Jagannadham (incoming spouse) displays the "View Lineage" button.
  3. Primary house blood relatives (e.g. Murthy Chetty, Chandra Babu) have the button disabled.
- **Test Case**: `TEST-ARCH-02-02`
- **Verification Result**: **PASS**

---

### Task 2.3: Dynamic Auto-Arrangement to Generation Row End
- **Architecture Statement**: Clicking "View Lineage" on an in-law spouse automatically relocates the married couple to the far right end of the generational row ($\text{maxSameGenX} + 320\text{px}$ and $+ 640\text{px}$, past Chandrakala), opening clear space for ancestral lines.
- **Desired Result**:
  1. In Generation X, Chandrakala sits at $X = 3365\text{px}$.
  2. When Suguna's lineage is expanded, Jagannadham relocates to $X = 3685\text{px}$.
  3. Suguna relocates to $X = 4005\text{px}$ (at the far right end).
- **Test Case**: `TEST-ARCH-02-03`
- **Verification Result**: **PASS**

---

### Task 2.4: Downstream Children Centering Under Relocated Couple
- **Architecture Statement**: When parents are relocated to the end of the row, their children are automatically repositioned to remain centered directly beneath them.
- **Desired Result**:
  1. Midpoint of relocated Jagannadham ($3685\text{px}$) and Suguna ($4005\text{px}$) is $3845\text{px}$.
  2. Meghana relocates to $X = 3705\text{px}$ in Generation Z.
  3. Shanmuga relocates to $X = 3985\text{px}$ in Generation Z.
  4. Parent-child drop lines connect vertically without diagonal slanting.
- **Test Case**: `TEST-ARCH-02-04`
- **Verification Result**: **PASS**

---

### Task 2.5: Zero Line Crossing & Collision Elimination
- **Architecture Statement**: Relocating the couple to the end of the tree ensures external ancestors rise into open canvas with zero line crossing.
- **Desired Result**:
  1. Ramayya Chetty ($X = 3865\text{px}$) and Achamma ($X = 4145\text{px}$) in Baby Boomers have $\ge 500\text{px}$ horizontal clearance from Chandrakala ($X = 3365\text{px}$).
  2. Zero primary house bus lines intersect the Paradarami ancestral subtree.
- **Test Case**: `TEST-ARCH-02-05`
- **Verification Result**: **PASS**

---

### Task 2.6: Graceful Collapse ("Hide Lineage") Restoration
- **Architecture Statement**: Clicking "Hide Lineage" instantly restores resting positions without persistent mutation.
- **Desired Result**:
  1. When `expandedLineagePersonId` is set to `null`, Suguna and Jagannadham return to canonical resting positions ($X = 1905\text{px}, 2225\text{px}$).
  2. Canvas layout JSON remains uncorrupted.
- **Test Case**: `TEST-ARCH-02-06`
- **Verification Result**: **PASS**

---

## Module 3: Privacy Model & Family Access Codes

Reference Specification: [`ARCHITECTURE/03-PRIVACY-MODEL-AND-FAMILY-ACCESS-CODES.md`](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/03-PRIVACY-MODEL-AND-FAMILY-ACCESS-CODES.md)

### Task 3.1: Family Access Code Registry & Unique Secrets
- **Architecture Statement**: Each house possesses a unique, secret Family Access Code (e.g. `KONU1290`, `PARA1290`).
- **Desired Result**:
  1. House of Konukuru code is `KONU1290`.
  2. House of Paradarami code is `PARA1290`.
  3. Codes are distinct and strictly registered.
- **Test Case**: `TEST-ARCH-03-01`
- **Verification Result**: **PASS**

---

### Task 3.2: Ancestral Visibility Rule: Direct Ancestors Visible in Upper Gen
- **Architecture Statement**: Expanding an in-law spouse's lineage reveals ONLY direct previous generations (parents, grandparents, great-grandparents) in upper generation bands.
- **Desired Result**:
  1. Expanding Suguna displays Ramayya Chetty Paradarami (Father) and Achamma Paradarami (Mother) in Baby Boomers ($Y = 2340\text{px}$).
  2. Direct parental spouse and child connector edges link correctly.
- **Test Case**: `TEST-ARCH-03-02`
- **Verification Result**: **PASS**

---

### Task 3.3: Collateral & Descendant Privacy: Strict Locking of Same/Next Gen
- **Architecture Statement**: The spouse's living siblings (sons and daughters of external house), in-laws, and downstream descendants MUST NOT be exposed without the family code.
- **Desired Result**:
  1. Rada Galeti (Suguna's sister), Munirathnam Galeti (brother-in-law), and Navaneeth Galeti (nephew) are strictly absent from the expanded Konukuru canvas.
  2. External family children are completely protected.
- **Test Case**: `TEST-ARCH-03-03`
- **Verification Result**: **PASS**

---

### Task 3.4: Strict Lower-Generation Placement of Lineage Lock Node
- **Architecture Statement**: The Lock Node MUST NEVER be placed in upper generations (above parents); it belongs strictly in the LOWER generation ($Y_{\text{target}} + 440\text{px}$), representing gated descendants and collateral branches.
- **Desired Result**:
  1. Direct parents sit in upper generation ($Y = 2340\text{px}$, Baby Boomers).
  2. Target spouse sits in Generation X ($Y = 2780\text{px}$).
  3. Lock Node sits in lower generation ($Y = 3220\text{px}$, Millennials / Gen Y).
  4. Connector edge flows downward from the maternal union to the lock node.
- **Test Case**: `TEST-ARCH-03-04`
- **Verification Result**: **PASS**

---

### Task 3.5: Refined Grey Styling for Privacy Seal (Anti-Alarmist)
- **Architecture Statement**: The Lock Node and connecting dashed lines must use neutral, dignified slate grey (`#94a3b8` / `#64748b`), with harsh red strictly forbidden.
- **Desired Result**:
  1. Medallion border is `2.5px solid #94a3b8`.
  2. Lock icon is `#94a3b8`.
  3. Connecting dashed edge has stroke `#94a3b8`.
  4. Red colors (`#ef4444`, `#f87171`) are completely eliminated from the locked presentation.
- **Test Case**: `TEST-ARCH-03-05`
- **Verification Result**: **PASS**

---

### Task 3.6: Case-Insensitive Code Verification & Full House Transition
- **Architecture Statement**: Entering the valid family code unlocks access, turns the lock medallion emerald (`#10b981`), and enables switching to the complete house canvas.
- **Desired Result**:
  1. Code input accepts `PARA1290`, `para1290`, and padded `  para1290  `.
  2. Invalid codes are rejected with error feedback.
  3. Successful submission transitions state to unlocked.
- **Test Case**: `TEST-ARCH-03-06`
- **Verification Result**: **PASS**

---

## Module 4: Data Model & Graph Partitioning

Reference Specification: [`ARCHITECTURE/04-DATA-MODEL-AND-GRAPH-PARTITIONING.md`](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/04-DATA-MODEL-AND-GRAPH-PARTITIONING.md)

### Task 4.1: Canonical Database Integrity & Schema Validation
- **Architecture Statement**: All entities reside in an atomic canonical JSON store adhering to strict UUID v4 primary keys and non-cyclic relationships.
- **Desired Result**:
  1. Canonical database contains exactly 19 validated persons.
  2. Canonical database contains exactly 29 validated relationships.
  3. No orphaned keys or data corruption.
- **Test Case**: `TEST-ARCH-04-01`
- **Verification Result**: **PASS**

---

### Task 4.2: Deterministic Graph Partitioning Without Data Duplication
- **Architecture Statement**: A single database is partitioned into house subgraphs based on the `lineage` parameter, including spouses while omitting external ancestors from default views.
- **Desired Result**:
  1. `buildFamilyGraph({ lineage: 'konukuru' })` returns exactly 14 nodes.
  2. `buildFamilyGraph({ lineage: 'paradarami' })` returns exactly 6 nodes.
- **Test Case**: `TEST-ARCH-04-02`
- **Verification Result**: **PASS**

---

### Task 4.3: Layout Geometry & Spacing Rules
- **Architecture Statement**: All cards adhere to standard $190\text{px} \times 160\text{px}$ dimensions, $320\text{px}$ spouse spacing, and $410\text{px}$ inter-cluster spacing.
- **Desired Result**:
  1. Every node in the generated layout has width $190\text{px}$ and height $160\text{px}$.
  2. Married couples (e.g. Sarojamma & Murthy Chetty) are spaced exactly $320\text{px}$ center-to-center.
- **Test Case**: `TEST-ARCH-04-03`
- **Verification Result**: **PASS**

---

### Task 4.4: Pre-Rendered Static Asset Pipeline
- **Architecture Statement**: Static JSON layouts are generated at build time in `public/data/` for instant CDN rendering.
- **Desired Result**:
  1. `public/data/layout-konukuru.json` exists and contains 14 nodes and 11 lanes.
  2. `public/data/layout-paradarami.json` exists and contains 6 nodes and 11 lanes.
- **Test Case**: `TEST-ARCH-04-04`
- **Verification Result**: **PASS**

---

## How to Execute the Architecture Audit Test Suite

To run all 22 automated architecture tests:

```bash
# Execute the complete architecture audit suite directly:
./functions/node_modules/.bin/tsx test/test_architecture_audit.ts

# Or run via npm script:
npm run test:audit

# Or run the full repository test suite (functions, canvas, interactions, lineage, audit):
npm test
```
