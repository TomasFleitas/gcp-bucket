# GCP Bucket Library

The GCP Bucket Library facilitates seamless interactions with Google Cloud Storage buckets. It allows the uploading of files from various data types like strings, blobs, or buffers. Additionally, if the file to be uploaded is an image, the library provides the capability to resize the image into multiple dimensions as specified.

## Getting Started

First, you need to initialize an instance of the `GCPBucket` class.

```javascript
// Initialize your GCPBucket instance
const gcpBucket = new GCPBucket({
  bucketName: 'your-bucket-name',
  firebaseApp: <your firebase-admin instance>,
  chunkSize: 1024, // Optional chuck size to upload
  encryptKey: "key" // Optional An AES-256 encryption key.
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
  fileData: file.buffer,
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
      fileName: "MediumImgFile"
      fit: 'inside',
    },
    { height: 200, width: 200, fileResizePrefix: 'small-', fit: 'inside' },
  ],
};

// Upsert the file to GCP
const result = await gcpBucket.upsertFiles(fileContent, callbackProcessPercentage);

```

callbackProcessPercentage is a callback function that gets invoked with the file path and the percentage of the resize process.

### Method: `deleteFile`
Deleting a File

#### Parameters:
- `filePath` (`string`) : The file path in the bucket.

```javascript
await gcpBucket.deleteFile(filePath);
```


### Method: `download`
Downloading a File

#### Parameters:
- `filePath` (`string`) : The file path in the bucket.

```javascript
await gcpBucket.download(filePath);
```

### Method: `isImage`
Checking if a File is an Image

#### Parameters:
- `fileData` (`TFileContent['fileData']`) : The image data which can be a Base64 string, Blob, or Buffer.

```javascript
await gcpBucket.isImage(fileData);
```

### Method: `getImageSizeByFactor`

This method resizes an image by a specified scale factor and returns the new dimensions along with a buffer of the resized image.

#### Parameters:
- `data` (`TFileContent['fileData']`): The image data which can be a Base64 string, Blob, or Buffer.
- `scaleFactor` (`number`): The scaling factor to resize the image. For example, a scaleFactor of 0.5 will reduce the image dimensions by 50%.
- `imgFit` (`keyof sharp.FitEnum` | optional): The fit strategy for sharp to follow when resizing the image. Default is undefined.

#### Returns:
An object containing:
- `width` (`number`): The new width of the resized image.
- `height` (`number`): The new height of the resized image.
- `buffer` (`Buffer`): A buffer of the resized image.

#### Usage:

```javascript
const result = await gcpBucket.getImageSizeByFactor(fileData, 0.5, 'inside');
```

### Method: `getImageMetadata`

This method retrieves and returns metadata of the specified image.

#### Parameters:
- `data` (`TFileContent['fileData']`): The image data which can be a Base64 string, Blob, or Buffer.

#### Returns:
A Promise resolving to a `sharp.Metadata` object containing metadata information of the image.

#### Usage:

```javascript
const metadata = await gcpBucket.getImageMetadata(fileData);
```