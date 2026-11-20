# Family Tree — Multi-House Genealogical Canvas

A high-performance, infinite-canvas family heritage platform that organizes multi-house genealogies across historical generation epochs, elegantly isolates in-law lineages through dynamic on-canvas expansion, and enforces strict generational privacy via lineage-specific Family Access Codes.

## Architecture & Source of Truth
The full architectural blueprint, mathematical models, and privacy design specifications are documented in the **[ARCHITECTURE](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/README.md)** directory:
- **[01. Infinite Canvas & Generations](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/01-INFINITE-CANVAS-AND-GENERATIONS.md)**: 2D coordinate system, generational bands (440px grid), inverse-zoom scaling laws.
- **[02. Cross-Lineage Marriages & "View Lineage"](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/02-CROSS-LINEAGE-MARRIAGES-AND-VIEW-LINEAGE.md)**: Spousal bridge pattern, non-lineage spouse isolation, and dynamic auto-arrangement to row end.
- **[03. Privacy Model & Family Access Codes](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/03-PRIVACY-MODEL-AND-FAMILY-ACCESS-CODES.md)**: Protecting living sons/daughters, ancestral visibility rule, and lower-generation grey lock node.
- **[04. Data Model & Graph Partitioning](file:///home/shanmuga/Documents/Learning/personal/Family_tree/ARCHITECTURE/04-DATA-MODEL-AND-GRAPH-PARTITIONING.md)**: Unified canonical database, deterministic graph partitioning, layout calculation engine.

## Stack
- **Frontend**: React + TypeScript + Vite
- **Backend API**: Node.js + Express + TypeScript (Firebase Functions 2nd Gen ready)
- **Local Storage**: `data/persons.json` & `data/relationships.json`
- **Cloud Hosting & Deployment**: Firebase Hosting & Firebase Cloud Functions
- **Photo Storage**: Firebase Cloud Storage

## Project Structure
```
family-tree/
├── src/                  # React + TypeScript frontend
│   ├── components/       # UI components (PersonCard, PersonForm, etc.)
│   ├── pages/            # Page views (PeoplePage, ProfilePage, etc.)
│   ├── services/         # API client & communication layer
│   ├── types/            # TypeScript interfaces (Person, Relationship, API)
│   ├── App.tsx           # Main application view
│   └── main.tsx          # React DOM entry
│
├── functions/            # Node.js + Express + TypeScript backend
│   └── src/
│       ├── controllers/  # Request handlers
│       ├── services/     # Business logic & validations
│       ├── repositories/ # Storage repository abstraction
│       ├── routes/       # API routes
│       ├── types/        # Backend TypeScript types
│       ├── app.ts        # Express app configuration
│       ├── local.ts      # Local development server (port 5001)
│       └── index.ts      # Firebase Cloud Function export
│
├── data/                 # Development data store
│   ├── persons.json      # Persons registry
│   └── relationships.json# Relationship registry
│
├── firebase.json         # Firebase hosting & functions configuration
├── .firebaserc           # Firebase project target
└── package.json          # Root scripts & frontend dependencies
```

## Running Locally

### 1. Install Dependencies
```bash
# Frontend dependencies
npm install

# Backend dependencies
cd functions && npm install && cd ..
```

### 2. Start Development Servers
```bash
# Starts both frontend (port 5173) and backend (port 5001) concurrently:
npm run dev

# Or run them separately:
npm run dev:server   # Starts Express backend on http://localhost:5001
npm run dev:client   # Starts Vite React frontend on http://localhost:5173
```
Vite proxies `/api/**` calls directly to the Express server at `http://localhost:5001`.

