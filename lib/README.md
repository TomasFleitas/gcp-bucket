# GCP Bucket Library

The GCP Bucket Library facilitates seamless interactions with Google Cloud Storage buckets. It allows the uploading of files from various data types like strings, blobs, or buffers. Additionally, if the file to be uploaded is an image, the library provides the capability to resize the image into multiple dimensions as specified.

## Getting Started

First, you need to initialize an instance of the `GCPBucket` class.
```javascript
// Initialize your GCPBucket instance
const gcpBucket = new GCPBucket({
  bucketName: 'your-bucket-name',
  firebaseApp: <your firebase-admin instance>,
});
```

# Examples
## Example 1: Uploading a Simple File (Any Type)


```javascript
// Define the folder and file name for the upload
const folderName = 'uploads';
const fileName = file.originalname;

// Prepare file content
const fileContent = {
  folderName,
  fileName,
  fileData: file.buffer
};

// Upsert the file to GCP
const result = await gcpBucket.upsertFiles(fileContent);

// The result will be
// [
//     {
//         "fileUrl": "file-url",
//         "filePath": "file-path",
//         "fileName": "file-name",
//         "fileType": "file-type",
//         "fileContentType": "file-content-type"
//     }
// ]
```

## Example 2: Uploading and Resizing Images

```javascript
// Define the folder and file name for the upload
const folderName = 'uploads';
const fileName = file.originalname;

// Prepare file content
const fileContent = {
  folderName,
  fileName,
  fileData: file.buffer,
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
const result = await gcpBucket.upsertFiles(fileContent, callbackProcessPercentage);

```
 callbackProcessPercentage is a callback function that gets invoked with the file path and the percentage of the resize process.
## Example 3: Deleting a File
```javascript
await gcpBucket.deleteFile(filePath);
```
## Example 4: Downloading a File
```javascript
await gcpBucket.download(filePath);
```
## Example 5: Checking if a File is an Image
```javascript
await gcpBucket.isImage(buffer);
```