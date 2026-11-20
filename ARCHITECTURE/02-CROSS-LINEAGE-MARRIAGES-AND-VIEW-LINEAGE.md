# Architecture Specification: Cross-Lineage Marriages & "View Lineage"

> **Document ID**: `ARCH-002`  
> **Status**: Active / Source of Truth  
> **Last Updated**: 2026-11-20  

---

## 1. The Challenge: Graph Explosion in Inter-House Marriages

In genealogical networks, every marriage links two completely distinct family lineages. 

If a system attempts to render the entire ancestral tree of both spouses simultaneously on a single canvas, it inevitably suffers from **combinatorial graph breakdown**:

```
                       [Murthy & Sarojamma]                   [Ramayya & Achamma]
                         (House Konukuru)                       (House Paradarami)
                                │                                      │
        ┌───────────────┬───────┴───────┬──────────────┐               │
        ▼               ▼               ▼              ▼               ▼
   [Chandra Babu]  [Rajini]       [Jagannadham] ══════════════════ [Suguna]
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                    [Meghana]                     [Shanmuga]
```

### Problems of Naive Simultaneous Rendering:
1. **Combinatorial Graph Explosion**: If every spouse brings their full tree (parents, grandparents, siblings, aunts, uncles, cousins), a 14-person direct family explodes into hundreds of nodes.
2. **Line Crossing & Overlap Chaos**: Sibling connector buses, parental drop lines, and spouse horizontal lines cross each other, creating visual "spaghetti" where text and faces become obscured.
3. **Loss of Primary Narrative**: Each family tree has a primary house patriarch/matriarch. Cluttering the view with external collateral relatives dilutes the house narrative.

---

## 2. The Solution: Bilateral "View Lineage" Pattern

To resolve this, the architecture establishes the **Non-Lineage Spouse Isolation Rule**:

> **Core Architectural Rule**: Within any primary House Canvas, a spouse from an external family is rendered as a clean, single node. That person features a **"View Lineage"** button that dynamically expands their direct ancestry on demand directly on the infinite canvas.

### 2.1 Bilateral Reciprocity (Vice Versa Principle)
This pattern is strictly symmetric and works identically in both directions:

- **When viewing the House of Konukuru**:
  - *Jagannadham Konukuru* is a primary house son.
  - *Suguna Konukuru* (born Paradarami) is the incoming non-lineage spouse.
  - **Suguna displays the "View Lineage" button**.
  - Clicking it reveals her Paradarami parents (*Ramayya Chetty* & *Achamma*).

- **When viewing the House of Paradarami**:
  - *Suguna Paradarami* is a primary house daughter.
  - *Jagannadham Konukuru* is the incoming non-lineage spouse.
  - **Jagannadham displays the "View Lineage" button**.
  - Clicking it reveals his Konukuru parents (*Murthy Chetty* & *Sarojamma*).

---

## 3. Dynamic Canvas Re-arrangement: Auto-Arrange to Row End

One of the most critical UI/UX innovations of this architecture is **Dynamic Canvas Relocation**:

### 3.1 The Resting State Conflict
In the default resting state of Generation X in House of Konukuru, nodes are arranged horizontally by birth order:
```
[Chandra Babu] ── [Dana Lakshmi] ── [Suguna] ══ [Jagannadham] ── [Rajini] ── [Giri Babu] ── [Chandrakala]
   (x=1175)          (x=1495)        (x=1905)       (x=2225)       (x=2635)     (x=2955)        (x=3365)
```
Notice that *Suguna* ($X = 1905$) and *Jagannadham* ($X = 2225$) sit right in the middle between *Dana Lakshmi* and *Rajini*.

**The Problem**: If Suguna's parents (*Ramayya Chetty* & *Achamma*) were rendered directly above $X = 1905$ in Baby Boomers:
- They would sit directly under *Murthy Chetty* ($X = 1495$) and between sibling bus lines.
- The parent-child lines from Murthy Chetty down to Rajini, Giri Babu, and Chandrakala would cut right across Ramayya Chetty's portrait and name!

### 3.2 The Auto-Arrange Solution
When the user clicks **"View Lineage"** on Suguna:
1. The engine computes the maximum $X$ coordinate of all other nodes in that generation row:
   $$\text{MaxSameGenX} = \max(\{X_i \mid \text{Node}_i \in \text{GenX}, \, i \notin \{\text{Suguna}, \text{Jagannadham}\}\}) = 3365 \quad (\text{Chandrakala})$$
2. The engine dynamically repositions the married couple to the **far right end of the tree**:
   $$\begin{aligned}
   X_{\text{Jagannadham}} &= \text{MaxSameGenX} + 320\text{px} = 3685\text{px} \\
   X_{\text{Suguna}} &= X_{\text{Jagannadham}} + 320\text{px} = 4005\text{px}
   \end{aligned}$$
3. Their children (*Meghana* and *Shanmuga*) are automatically centered directly beneath them in Generation Z:
   $$\text{Center}_{\text{children}} = \frac{3685 + 4005}{2} = 3845\text{px} \implies X_{\text{Meghana}} = 3705\text{px}, \; X_{\text{Shanmuga}} = 3985\text{px}$$
4. Suguna's direct parents are rendered in the upper generation (Baby Boomers) directly above her:
   $$\begin{aligned}
   X_{\text{Ramayya}} &= X_{\text{Suguna}} - 140\text{px} = 3865\text{px} \\
   X_{\text{Achamma}} &= X_{\text{Suguna}} + 140\text{px} = 4145\text{px}
   \end{aligned}$$

```
Generation X:
[Chandra Babu] ── [Dana Lakshmi]   [Rajini] ── [Giri Babu] ── [Chandrakala]   [Jagannadham] ════ [Suguna]
   (x=1175)          (x=1495)       (x=2635)     (x=2955)        (x=3365)        (x=3685)          (x=4005)
                                                                                                      │
                                                                           [Ramayya] ════ [Achamma]  ▲
                                                                           (x=3865)       (x=4145)   │
                                                                           (Baby Boomers, y=2340)    │
                                                                                     │               │
                                                                                     └───────────────┘
                                                                                 (Clean isolated upward lineage)
```

### 3.3 Visual Result
- **Zero Line Collisions**: The entire space from $X = 3500\text{px}$ to $X = 4500\text{px}$ in Baby Boomers and Silent Generation is 100% open canvas. Not a single line crosses or interferes with the Konukuru tree.
- **Graceful Collapse ("Hide Lineage")**: Clicking "Hide Lineage" instantly returns Suguna, Jagannadham, and their children back to their standard resting coordinates ($X = 1905, 2225$), with no permanent alteration of the underlying layout file.
