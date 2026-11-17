# Family Tree — Person Management Module (Phase 2)

A reliable data-management system for family members, their personal attributes, and their relationships.

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

