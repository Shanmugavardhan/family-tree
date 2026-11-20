# Architecture Specification: Infinite Canvas & Generation Rows

> **Document ID**: `ARCH-001`  
> **Status**: Active / Source of Truth  
> **Last Updated**: 2026-11-20  

---

## 1. System Philosophy: The Infinite 2D Generational Plane

The Family Tree application is architectured as an **infinite 2D zoomable and pannable canvas** (powered by React Flow / `@xyflow/react`). Unlike traditional static tree graphs or page-based hierarchical diagrams, this architecture treats genealogical history as a continuous spatio-temporal matrix:

- **Vertical Dimension ($Y$-axis)**: **Chronological Generational Time**. Divided into standardized horizontal generation strips ("Cohort Lanes"), descending from earliest documented ancestors down to the newest generations.
- **Horizontal Dimension ($X$-axis)**: **Lineage Branches & Family Units**. Expands indefinitely to the left and right, accommodating primary house members, sibling clusters, spouse pairings, and expanded external lineages.

```
Y-Axis (Generations)
 ▲
 │   [ Gilded Generation        (1843 – 1859) ]  ◄── Lane 0  (y = 0px)
 │   [ Missionary Generation    (1860 – 1882) ]  ◄── Lane 1  (y = 440px)
 │   [ Lost Generation          (1883 – 1900) ]  ◄── Lane 2  (y = 880px)
 │   [ Greatest Generation      (1901 – 1927) ]  ◄── Lane 3  (y = 1320px)
 │   [ Silent Generation        (1928 – 1945) ]  ◄── Lane 4  (y = 1760px)  [Sarojamma & Murthy]
 │   [ Baby Boomers             (1946 – 1964) ]  ◄── Lane 5  (y = 2200px)  [Ramayya & Achamma]
 │   [ Generation X             (1965 – 1980) ]  ◄── Lane 6  (y = 2640px)  [Chandra, Dana, Rajini, Giri, Chandrakala, Jagannadham, Suguna]
 │   [ Millennials (Gen Y)      (1981 – 1996) ]  ◄── Lane 7  (y = 3080px)  [Lock Node / Collateral Gated]
 │   [ Generation Z             (1997 – 2012) ]  ◄── Lane 8  (y = 3520px)  [Revati, Pranavi, Meghana, Shanmuga, Hemanth, Navaneeth]
 │   [ Generation Alpha         (2013 – 2024) ]  ◄── Lane 9  (y = 3960px)
 ▼   [ Generation Beta          (2025 – 2039) ]  ◄── Lane 10 (y = 4400px)
 └────────────────────────────────────────────────────────────────────────► X-Axis (House Branches)
```

---

## 2. Standardized Generational Cohort Bands

To maintain mathematical consistency and prevent node overlap across generations, the canvas enforces a strict **$440\text{px}$ Generational Grid Rhythm**:

### 2.1 Band Definition Table

| Generation ID | Formal Generation Name | Historical Epoch | Canvas $Y$-Start | Node Baseline $Y$ |
| :--- | :--- | :--- | :--- | :--- |
| `ancestral_gilded` | **Gilded Generation** | $1843 – 1859$ | $0\text{px}$ | $140\text{px}$ |
| `missionary` | **Missionary Generation** | $1860 – 1882$ | $440\text{px}$ | $580\text{px}$ |
| `lost` | **Lost Generation** | $1883 – 1900$ | $880\text{px}$ | $1020\text{px}$ |
| `greatest` | **Greatest Generation** | $1901 – 1927$ | $1320\text{px}$ | $1460\text{px}$ |
| `silent` | **Silent Generation** | $1928 – 1945$ | $1760\text{px}$ | $1900\text{px}$ |
| `baby_boomers` | **Baby Boomers** | $1946 – 1964$ | $2200\text{px}$ | $2340\text{px}$ |
| `gen_x` | **Generation X** | $1965 – 1980$ | $2640\text{px}$ | $2780\text{px}$ |
| `millennials` | **Millennials (Gen Y)** | $1981 – 1996$ | $3080\text{px}$ | $3220\text{px}$ |
| `gen_z` | **Generation Z** | $1997 – 2012$ | $3520\text{px}$ | $3660\text{px}$ |
| `gen_alpha` | **Generation Alpha** | $2013 – 2024$ | $3960\text{px}$ | $4100\text{px}$ |
| `gen_beta` | **Generation Beta** | $2025 – 2039$ | $4400\text{px}$ | $4540\text{px}$ |

### 2.2 Kinship-Based Generational Inference
In real-world genealogical records, exact birth dates are frequently missing for historical or older ancestors. 

**Architectural Rule**: The system **MUST NOT** lump persons with unknown birthdates into a separate disconnected "Unknown" row. Instead, the backend layout service (`layout.service.ts`) executes a deterministic **Kinship Inference Algorithm**:
1. If a person has a birth year, their generation is fixed by year.
2. If a person lacks a birth year, their generation is inferred from:
   - **Spousal alignment**: A person must share the same generational lane as their spouse.
   - **Parental alignment**: A child must be placed in a generational lane that is at least one generation below their parents ($Y_{\text{child}} \ge Y_{\text{parent}} + 440\text{px}$).
   - **Filial alignment**: A parent must be placed at least one generation above their children ($Y_{\text{parent}} \le Y_{\text{child}} - 440\text{px}$).
3. This guarantees that all family members sit on their rightful historical horizon.

---

## 3. Multi-House Coexistence on a Single Continuum

Multiple house lineages exist simultaneously within the application data store:
- **House of Konukuru** (`konukuru`, Head: Murthy Chetty Konukuru)
- **House of Paradarami** (`paradarami`, Head: Ramayya Chetty Paradarami)
- **Future Houses** (e.g., House of Galeti, House of Etigadda)

Each house represents an independent lineage hierarchy that maps onto the **same generational timeline**. For example:
- *Murthy Chetty Konukuru* (Silent Generation) and *Ramayya Chetty Paradarami* (Baby Boomers) both occupy the global canvas according to their respective eras.
- While only one house is typically active as the primary canvas view at a time, the architecture supports parallel in-map expansion and seamless switching between houses.

---

## 4. Viewport Scaling & Sticky Generation Labels

When navigating an infinite canvas, traditional fixed labels quickly become illegible: zooming out renders text invisibly small, while zooming in causes labels to obstruct nodes.

To solve this, the architecture implements two synchronized **Inverse-Zoom Scaling Laws**:

### 4.1 Sticky Generation Labels Inverse-Scaling Law
In [StickyGenerationLabels.tsx](file:///home/shanmuga/Documents/Learning/personal/Family_tree/src/components/canvas/StickyGenerationLabels.tsx), generation titles ("SILENT GENERATION", "GENERATION X", etc.) are fixed to the left viewport edge ($X = 36\text{px}$) and dynamically scale inversely with the viewport zoom ($z$):

$$\text{Scale}_{\text{label}}(z) = \min\left(1.85, \, \max\left(0.65, \, \left(\frac{1}{\max(0.18, z)}\right)^{0.58}\right)\right)$$

- **Zoom Out ($z \to 0.2$)**: The generation labels **enlarge up to $1.85\times$** (effective font size ~ $60\text{px}$ – $80\text{px}$), allowing users to read generational eras clearly across macro overviews of the entire tree.
- **Zoom In ($z \to 2.0$)**: The generation labels **shrink down to $0.65\times$** (~ $21\text{px}$), preserving canvas clarity and preventing obstruction of individual person portraits.
- **Hardware-Accelerated Positioning**: Labels are updated at 60/120 FPS inside `@xyflow/react`'s `useOnViewportChange` using `translate3d(36px, ${top}px, 0)`:

$$\text{Top}_{\text{label}} = V_y + (Y_{\text{lane}} + 24) \times z$$

### 4.2 Person Node Proportional Zoom
In [PersonNode.tsx](file:///home/shanmuga/Documents/Learning/personal/Family_tree/src/components/canvas/PersonNode.tsx), person tiles use a proportional scaling factor:

$$\text{Scale}_{\text{node}}(z) = \min\left(2.5, \, \max\left(0.6, \, \left(\frac{1}{\max(0.1, z)}\right)^{2/3}\right)\right)$$

This maintains circular avatar visibility, gold rim borders, and centered surname typography across extreme zoom distances.

