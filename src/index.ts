import * as Admin from 'firebase-admin';
import { Storage } from 'firebase-admin/lib/storage/storage';
import { Bucket } from '@google-cloud/storage';
import * as FileType from 'file-type';
import blobToBuffer from 'blob-to-buffer';
import sharp from 'sharp';
import app from './example';

export type TResizeOptions = {
  width: number;
  height: number;
  fit?: keyof sharp.FitEnum;
};

export type TConstructor = {
  bucketName: string;
  firebaseApp: typeof Admin;
  encryptKey?: string;
};

export type TResizeOpts = TResizeOptions & { fileResizePrefix: string };

export type TFileContent = {
  folderName: string;
  fileName: string;
  fileData: Buffer | string | Blob;
  fileMetadata?: Object;
  resizeOptions?: TResizeOpts[];
};

export type TFile = TFileContent[] | TFileContent;

export type TUpserFile = {
  fileUrl: string;
  filePath: string;
  fileName: string;
  fileType?: string;
  fileContentType?: string;
};

export type TProgressCallback = (fildePath: string, percentage: number) => void;

export default class GCPBucket {
  private STORAGE: Storage;
  private BUCKET!: Bucket;
  private ENCRYPT_KEY?: string;

  constructor({ bucketName, firebaseApp, encryptKey }: TConstructor) {
    if (!bucketName) {
      throw new Error('bucketName is required');
    }
    if (!firebaseApp) {
      throw new Error('firebaseApp is required');
    }
    this.STORAGE = firebaseApp.storage();
    this.ENCRYPT_KEY = encryptKey;
    this._initFileStorage(bucketName);
  }

  /**
   *  Initialize the bucket
   * @returns
   */
  private async _initFileStorage(bucketName: string) {
    this.BUCKET = this.STORAGE.bucket(bucketName);
    if (!(await this.BUCKET.exists())) {
      throw new Error('Storage bucket does not exist');
    }
  }

  private async _resizeImage(
    data: Buffer,
    options: TResizeOptions,
  ): Promise<Buffer> {
    return await sharp(data).resize(options).toBuffer();
  }

  private async getBufferFromData(
    data: Blob | string | Buffer,
  ): Promise<Buffer> {
    if (data instanceof Buffer) return data;

    if (data instanceof Blob) {
      return await new Promise((resolve, reject) => {
        blobToBuffer(data as Blob, (err, buffer) => {
          if (err) return reject('Failed to convert blob to buffer: ' + err);
          resolve(buffer);
        });
      });
    }

    return Buffer.from(data, 'base64');
  }

  /**
   * Update or create a new file
   *
   * @param {string} folderPath - The path to the folder where the file should be stored.
   * @param {string} fileName - The name of the file.
   * @param {Buffer | string | Blob} data - The data to be stored in the file, as a Buffer, string, or Blob.
   * @param {object} metadata - Any metadata to be associated with the file.
   * @param {(filePath:string,percentage: number) => void} [progressCallback] - An optional callback function for tracking upload progress.
   * @returns {Promise<{
   *   fileUrl: string;
   *   filePath: string;
   *   fileName: string;
   *   fileType?: string;
   *   fileContentType?: string;
   * }>} - A Promise resolving to an object with details of the uploaded file.
   */
  private async _upsertFile(
    folderPath: string,
    fileName: string,
    fileData: Buffer,
    metadata: any,
    progressCallback?: (filePath: string, percentage: number) => void,
  ): Promise<TUpserFile> {
    return await new Promise(async (resolve, reject) => {
      const totalBytes = fileData.length;
      const filePath = folderPath + '/' + fileName;
      folderPath = folderPath.replace(/ /g, '-');
      fileName = fileName.replace(/ /g, '-');

      if (!folderPath.match(/[A-Z]|[a-z]|[0-9]|\-/g)) {
        return reject(
          `Failed to upsert file, folderPath=[${folderPath}] contains invalid characters`,
        );
      }

      if (!fileName.match(/[A-Z]|[a-z]|[0-9]|\-/g)) {
        return reject(
          `Failed to upsert file, fileName=[${fileName}] contains invalid characters`,
        );
      }

      const file = this.BUCKET.file(filePath);

      if (this.ENCRYPT_KEY)
        file.setEncryptionKey(Buffer.from(this.ENCRYPT_KEY));

      const writeStream = file.createWriteStream({
        resumable: false,
        timeout: 5000,
        metadata: {
          ...metadata,
        },
      });

      let uploadedBytes = 0;

      writeStream.on('data', (chunk) => {
        uploadedBytes += chunk.length;
        const progress = (uploadedBytes / totalBytes) * 100;
        progressCallback?.(filePath, progress);
      });

      writeStream.on('finish', async () => {
        const type = await FileType.fileTypeFromBuffer(fileData);

        resolve({
          fileUrl: file.publicUrl(),
          filePath: filePath,
          fileName: fileName,
          fileType: type?.ext,
          fileContentType: type?.mime,
        });
      });

      writeStream.on('error', (err) => {
        reject('File upload failed: ' + err);
      });

      writeStream.end(fileData);
    });
  }

  /**
   * Delete a file from the bucket
   *
   * @param {string} filePath
   * @returns
   */
  public async deleteFile(filePath: string) {
    const file = this.BUCKET.file(filePath);
    return await file.delete();
  }

  /**
   * Download a file from the bucket
   *
   * @param {string} fielPath
   * @param {object} metadata
   * @returns
   */
  public async download(fielPath: string, metadata = {}) {
    const file = this.BUCKET.file(fielPath);
    if (this.ENCRYPT_KEY) file.setEncryptionKey(Buffer.from(this.ENCRYPT_KEY));
    if (!!Object.keys(metadata).length) {
      const [{ metadata: oldMetada }] = await file.getMetadata();
      await file.setMetadata({
        metadata: {
          ...oldMetada,
          ...metadata,
        },
      });
    }

    return await file.download();
  }

  /**
   * @typedef {Object} TUpserFile
   * @property {string} fileUrl - The URL of the upserted file.
   * @property {string} filePath - The path of the upserted file.
   * @property {string} fileName - The name of the upserted file.
   * @property {string} [fileType] - The type of the upserted file.
   * @property {string} [fileContentType] - The content type of the upserted file.
   */

  /**
   * Upserts files to a specified location. If an array of files is provided, it will upsert them concurrently.
   *
   * @param {TFile} files - The file or array of files to be upserted.
   * @param {Object} [metadata={}] - Optional metadata to be associated with the files.
   * @returns {Promise<TUpserFile | TUpserFile[]>} - A promise that resolves to the upserted file(s) information.
   */
  public async upsertFiles(
    files: TFile,
    progressCallback?: TProgressCallback,
  ): Promise<TUpserFile | TUpserFile[]> {
    if (files && Array.isArray(files)) {
      const auxFiles = (
        await Promise.all(
          files.map(async (file) => await this.getFilesToUpdate(file)),
        )
      ).flat();
      return await Promise.all(
        auxFiles?.map((file) =>
          this._upsertFile(
            file.folderName,
            file.fileName,
            file.fileData,
            file.metadata,
            progressCallback,
          ),
        ),
      );
    }

    return await Promise.all(
      (
        await this.getFilesToUpdate(files)
      )?.map((file) =>
        this._upsertFile(
          file.folderName,
          file.fileName,
          file.fileData,
          file.metadata,
          progressCallback,
        ),
      ),
    );
  }

  private async getFilesToUpdate(file: TFileContent) {
    const filesToUpsert = [];
    const buffer = await this.getBufferFromData(file.fileData);

    if (file.resizeOptions) {
      for (const resizeOption of file.resizeOptions) {
        filesToUpsert.push({
          ...file,
          fileData: buffer,
        });
        filesToUpsert.push({
          folderName: file.folderName,
          fileName: file.fileName + resizeOption.fileResizePrefix,
          metadata: file.fileMetadata || {},
          fileData: await this._resizeImage(buffer, resizeOption),
        });
      }
    } else {
      filesToUpsert.push({
        folderName: file.folderName,
        fileName: file.fileName,
        metadata: file.fileMetadata || {},
        fileData: buffer,
      });
    }

    return filesToUpsert;
  }
}

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
