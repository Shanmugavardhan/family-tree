# Family Tree System Architecture: Source of Truth

> **System Vision**: An interactive, infinite-canvas family heritage platform that organizes multi-house genealogies across historical generation epochs, elegantly isolates in-law lineages through dynamic on-canvas expansion, and enforces strict generational privacy via lineage-specific Family Access Codes.

---

## Architecture Navigation & Index

This documentation suite establishes the formal specification and foundational design principles of the Family Tree application. All future features, algorithms, data contracts, and UI components must conform to these principles.

| Document | Focus Area | Description |
| :--- | :--- | :--- |
| **[01. Infinite Canvas & Generation Rows](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/01-INFINITE-CANVAS-AND-GENERATIONS.md)** | **Coordinate System & Layout** | Generational epoch bands (Y-axis rows), infinite 2D canvas navigation, adaptive inverse-zoom label scaling, and multi-house presence. |
| **[02. Cross-Lineage Marriages & "View Lineage"](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/02-CROSS-LINEAGE-MARRIAGES-AND-VIEW-LINEAGE.md)** | **Spousal Bridge Architecture** | Managing inter-house marriages, avoiding graph explosion, bilateral "View Lineage" triggers, and dynamic canvas re-arrangement to the end of the tree. |
| **[03. Privacy Model & Family Access Codes](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/03-PRIVACY-MODEL-AND-FAMILY-ACCESS-CODES.md)** | **Privacy & Security** | Core intent of Family Access Codes, protecting sons and daughters from unauthorized exposure, the Ancestral Visibility Rule, and the lower-generation lock node. |
| **[04. Data Model & Graph Partitioning](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/04-DATA-MODEL-AND-GRAPH-PARTITIONING.md)** | **Backend & Engine** | Entity definitions (`persons.json`, `relationships.json`), deterministic generation inference, graph partitioning per house, and edge routing logic. |

---

## Executive Summary: The 3 Core Tenets

```
                   ┌────────────────────────────────────────┐
                   │       MULTI-HOUSE INFINITE CANVAS      │
                   └───────────────────┬────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌──────────────────┐         ┌───────────────────┐         ┌───────────────────┐
│ 1. GENERATIONAL  │         │ 2. SPOUSAL BRIDGE │         │ 3. PRIVACY & CODE │
│    EPOCH ROWS    │         │    & VIEW LINEAGE │         │    SECURITY MODEL │
├──────────────────┤         ├───────────────────┤         ├───────────────────┤
│ • Y-axis bands   │         │ • Inter-house     │         │ • Strict privacy  │
│   (Silent, GenX, │         │   marriages       │           for living family │
│   GenZ, etc.)    │         │ • Isolated        │         │ • Previous gen    │
│ • Multi-house    │         │   lineage view    │           ancestors visible │
│   coexistence    │         │ • Auto-arranges   │         │ • Same & next gen │
│ • Inverse-zoom   │         │   to row end      │           locked until code │
│   sticky labels  │         │ • Zero clutter    │         │ • Lower-gen lock  │
└──────────────────┘         └───────────────────┘         └───────────────────┘
```

### Tenet 1: Infinite Canvas Partitioned by Generation Rows
The application is modeled as an infinite 2D plane where the **vertical axis ($Y$) represents time/generations** divided into historical cohort bands (e.g., *Silent Generation*, *Baby Boomers*, *Generation X*, *Millennials*, *Generation Z*), while the **horizontal axis ($X$) represents branching lineages and family members within cohorts**. Generation names remain pinned to the left and adaptively enlarge as users zoom out to maintain orientation at any scale.

### Tenet 2: Cross-Lineage Marriage & The "View Lineage" Pattern
When individuals from different houses marry (e.g., *Suguna Paradarami* marrying *Jagannadham Konukuru*), rendering both complete ancestral trees simultaneously on one canvas creates graph combinatorial explosion and visual overlap. To keep the tree pristine:
- The primary canvas displays the active house lineage.
- The non-lineage spouse features a dedicated **"View Lineage"** button.
- Clicking "View Lineage" dynamically shifts the married couple to the **far right end of the generational row**, providing unobstructed space for the spouse's direct ancestry to branch upwards.

### Tenet 3: Generational Privacy & Family Code Security
Family lineage data involves real living individuals, children, and personal relationships. Lineage Codes (e.g., `KONU1290`, `PARA1290`) exist to safeguard family privacy:
- In an inter-house marriage, viewers are permitted to see **only the direct previous generations (parents, grandparents, great-grandparents)** of the marrying spouse to understand their lineage roots.
- The spouse's **own generation (siblings, cousins)** and **subsequent/next generations (nephews, nieces, other descendants)** are **strictly locked** and hidden to protect sons and daughters of external families from unauthorized viewing.
- The lineage **Lock Node** is positioned in the **lower generation** (later generations), indicating where the gated descendants and collateral branches reside. It is unlocked only when the family grants their secret Family Access Code.

