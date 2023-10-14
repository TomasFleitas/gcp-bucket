import express from 'express';
import multer from 'multer';
import GCPBucket, { TFileContent } from '.';

// Initialize Express app
const app = express();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Initialize your GCPBucket instance
const gcpBucket = new GCPBucket({
  bucketName: 'your-bucket-name',
  firebaseApp: {
    /* your firebase app config */
  } as any,
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
    };

    // Upsert the file to GCP
    const result = await gcpBucket.upsertFiles(fileContent);
    res.status(200).send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

export default app;
