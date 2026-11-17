import { onRequest } from 'firebase-functions/v2/https';
import { app } from './app';

// Export Cloud Function for Firebase deployment
export const api = onRequest({ cors: true }, app);

