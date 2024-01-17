import express from 'express';
import multer from 'multer';
import { TFileContent, GCPBucket } from '../gcp';
import firebaseApp from './firebase';
import { FIREBASE_PROJECT } from './constants';

// Initialize Express app
const app = express();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const bucketName = `${FIREBASE_PROJECT}.appspot.com`;

// Initialize your GCPBucket instance
const gcpBucket = new GCPBucket({
  bucketName,
  firebaseApp,
});

/*  Para utilizar este servicio desde Postman, enviar un POST a `http://localhost:3000/upload` con body en `form-data`. 
Agregar un campo con key=file de tipo File y en el value cargar una imagen desde la PC. */
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
    const fileContent: TFileContent[] = [
      {
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
          {
            height: 200,
            width: 200,
            fileResizePrefix: 'small-',
            fit: 'inside',
          },
          {
            fileResizePrefix: 'webp-',
            format: {
              extension: 'webp',
              options: {
                lossless: true,
                quality: 60,
                alphaQuality: 80,
                force: false,
              },
            },
          },
        ],
      },
      /*       {
        fileData: file.buffer,
        folderName: 'profiles',
        fileName: 'profile-1705455143710.jpeg',
        resizeOptions: [
          {
            height: 200,
            width: 200,
            fileResizePrefix: 'thumb-',
            fit: 'inside',
          },
          {
            format: {
              extension: 'webp',
            },
            fileResizePrefix: 'webp-',
            fit: 'inside',
          },
        ],
        fileMetadata: { random: 'hola' },
      }, */
    ];

    // Upsert the file to GCP
    const result = await gcpBucket.upsertFiles(fileContent, console.log);
    res.status(200).send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
