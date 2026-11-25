import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = {
  projectId: 'family-tree-177f2',
  appId: '1:470872961144:web:3f95247e3b69a0b533bd8d',
  storageBucket: 'family-tree-177f2.firebasestorage.app',
  apiKey: 'AIzaSyDUVk_rSXlf9fZA4xC20kr8eyq3mWTD31w',
  authDomain: 'family-tree-177f2.firebaseapp.com',
  messagingSenderId: '470872961144',
  measurementId: 'G-ZCVV33QDDV',
};

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const personsRaw = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../data/persons.json'), 'utf-8')
  );
  const persons = Array.isArray(personsRaw) ? personsRaw : (personsRaw.persons || []);

  const relsRaw = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../data/relationships.json'), 'utf-8')
  );
  const relationships = Array.isArray(relsRaw) ? relsRaw : (relsRaw.relationships || []);

  const existingPersonsSnap = await getDocs(collection(db, 'persons'));
  const existingPersonIds = new Set(existingPersonsSnap.docs.map((d) => d.id));

  let seededPersons = 0;
  for (const p of persons) {
    if (!existingPersonIds.has(p.id)) {
      await setDoc(doc(db, 'persons', p.id), p);
      seededPersons++;
    }
  }

  const existingRelsSnap = await getDocs(collection(db, 'relationships'));
  const existingRelIds = new Set(existingRelsSnap.docs.map((d) => d.id));

  let seededRels = 0;
  for (const r of relationships) {
    if (!existingRelIds.has(r.id)) {
      await setDoc(doc(db, 'relationships', r.id), r);
      seededRels++;
    }
  }

  console.log(
    `✓ Firestore seeded: ${seededPersons} new persons (${persons.length} total), ${seededRels} new relationships (${relationships.length} total)`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to seed Firestore:', err);
  process.exit(1);
});
