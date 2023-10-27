import * as admin from 'firebase-admin';

export default (() => {
  const medicalProject = 'fleeting-dev';
  const { databaseURL, cert, storageBucket, projectId } = {
    cert: './service-account.json',
    databaseURL: `${medicalProject}.firebaseapp.com`,
    projectId: `${medicalProject}`,
    storageBucket: `${medicalProject}.appspot.com`,
  };

  const credentials = admin.credential.cert(cert);

  const appConfig = {
    databaseURL,
    storageBucket,
    projectId,
    credential: credentials ?? admin.credential.applicationDefault(),
  };
  return admin.initializeApp(appConfig);
})();
