import * as admin from 'firebase-admin';
import { FIREBASE_PROJECT } from './constants';

export default (() => {
  const { databaseURL, cert, storageBucket, projectId } = {
    cert: require('./service-account.json'),
    databaseURL: `${FIREBASE_PROJECT}.firebaseapp.com`,
    projectId: `${FIREBASE_PROJECT}`,
    storageBucket: `${FIREBASE_PROJECT}.appspot.com`,
  };

  const credentials = admin.credential.cert(cert);

  const appConfig = {
    databaseURL,
    storageBucket,
    projectId,
    credential: credentials ?? admin.credential.applicationDefault(),
  };
  return admin.initializeApp(appConfig, FIREBASE_PROJECT);
})();
