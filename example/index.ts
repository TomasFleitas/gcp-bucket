import express from 'express';
import multer from 'multer';
import { TFileContent, GCPBucket } from '../src/gcp';
import firebaseApp from './firebase';

// Initialize Express app
const app = express();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Initialize your GCPBucket instance
const gcpBucket = new GCPBucket({
  bucketName: 'fleeting-dev.appspot.com',
  firebaseApp,
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).send('No file uploaded');
    }

    // Define the folder and file name for the upload
    const folderName = 'uploads';
    const fileName = file.originalname;

    // Prepare file content
    const fileContent: TFileContent = {
      folderName,
      fileName,
      fileData: file.buffer,
      fileMetadata: { random: 'hola' },
      resizeOptions: [
        {
          height: 400,
          width: 400,
          fileResizePrefix: 'medium-',
          fit: 'inside',
        },
        { height: 200, width: 200, fileResizePrefix: 'small-', fit: 'inside' },
      ],
    };

    // Upsert the file to GCP
    const result = await gcpBucket.upsertFiles(fileContent);
    res.status(200).send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
