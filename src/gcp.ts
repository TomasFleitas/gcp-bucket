import * as Admin from 'firebase-admin';
import { Bucket } from '@google-cloud/storage';
import blobToBuffer from 'blob-to-buffer';
import sharp, { ResizeOptions } from 'sharp';

type FormatGenericType<F, O> = { extension: F; options?: O };

type FormatType =
  | FormatGenericType<'webp', sharp.WebpOptions>
  | FormatGenericType<'png', sharp.PngOptions>
  | FormatGenericType<'avif', sharp.AvifOptions>
  | FormatGenericType<'heif', sharp.HeifOptions>
  | FormatGenericType<'jxl', sharp.JxlOptions>
  | FormatGenericType<'jp2', sharp.Jp2Options>
  | FormatGenericType<'raw', sharp.OutputOptions>
  | FormatGenericType<'tif', sharp.TiffOptions>
  | FormatGenericType<'tiff', sharp.TiffOptions>
  | FormatGenericType<'svg', sharp.OutputOptions>
  | FormatGenericType<'gif', sharp.GifOptions>
  | FormatGenericType<'jpg', sharp.JpegOptions>
  | FormatGenericType<'jpeg', sharp.JpegOptions>;

export type TResizeOptions = Pick<ResizeOptions, 'height' | 'width' | 'fit'> & {
  format?: FormatType;
};

export type TConstructor = {
  bucketName: string;
  firebaseApp: Admin.app.App;
  encryptKey?: string;
  chunkSize?: number;
};

export type TResizeOpts = TResizeOptions & {
  fileResizePrefix: string;
  fileName?: string;
};

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

export type TProgressCallback = (filePath: string, percentage: number) => void;

export class GCPBucket {
  private STORAGE: any;
  private BUCKET!: Bucket;
  private ENCRYPT_KEY?: string;
  private CHUNK_SIZE = 1024;

  constructor({
    bucketName,
    firebaseApp,
    encryptKey,
    chunkSize,
  }: TConstructor) {
    if (!bucketName) {
      throw new Error('bucketName is required');
    }
    if (!firebaseApp) {
      throw new Error('firebaseApp is required');
    }
    this.STORAGE = firebaseApp.storage();
    this.ENCRYPT_KEY = encryptKey;
    this.CHUNK_SIZE = chunkSize ?? this.CHUNK_SIZE;
    this._initFileStorage(bucketName);
  }

  public async getImage(
    data: TFileContent['fileData'],
    newSize: TResizeOptions
  ) {
    const buffer = await this.getBufferFromData(data);

    if (!(await this.isImage(buffer))) {
      throw new Error('The file is not a image.');
    }

    return await this._resizeImage(buffer, newSize);
  }

  public async getImageSizeByFactor(
    data: TFileContent['fileData'],
    scaleFactor: number,
    imgFit?: keyof sharp.FitEnum
  ) {
    if (!scaleFactor) {
      throw new Error('The scaleFactor is not provided.');
    }

    const buffer = await this.getBufferFromData(data);

    if (!(await this.isImage(buffer))) {
      throw new Error('The file is not a image.');
    }

    const { width, height } = await sharp(buffer).metadata();

    const newWidth = Math.floor(width * scaleFactor);
    const newHeight = Math.floor(height * scaleFactor);

    return {
      width: newWidth,
      height: newHeight,
      buffer: await this._resizeImage(buffer, {
        height: newHeight,
        width: newWidth,
        fit: imgFit,
      }),
    };
  }

  public async isImage(data: TFileContent['fileData']) {
    const type = await (
      await import('file-type')
    ).fileTypeFromBuffer(await this.getBufferFromData(data));
    return type && type.mime.startsWith('image/');
  }

  public async getImageMetadata(
    data: TFileContent['fileData']
  ): Promise<sharp.Metadata> {
    const buffer = await this.getBufferFromData(data);
    if (!(await this.isImage(buffer))) {
      throw new Error('The file is not a image.');
    }
    return await sharp(buffer).metadata();
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
    progressCallback?: TProgressCallback
  ): Promise<TUpserFile | TUpserFile[] | undefined> {
    if (files && Array.isArray(files)) {
      const auxFiles = (
        await Promise.all(
          files.map(async (file) => await this.getFilesToUpdate(file))
        )
      ).flat();
      return await Promise.all(
        auxFiles?.map((file) =>
          this._upsertFile(
            file.folderName,
            file.fileName,
            file.fileData as Buffer,
            file.fileMetadata,
            progressCallback
          )
        )
      );
    }
    if (files && !Array.isArray(files))
      return await Promise.all(
        (
          await this.getFilesToUpdate(files)
        )?.map((file) =>
          this._upsertFile(
            file.folderName,
            file.fileName,
            file.fileData as Buffer,
            file.fileMetadata,
            progressCallback
          )
        )
      );
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
  public async download(fielPath: string, metadata: object = {}) {
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

  /* ==================== PRIVATE METHODS  ==================== */

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
    metadata?: Object,
    progressCallback?: (filePath: string, percentage: number) => void
  ): Promise<TUpserFile> {
    return await new Promise(async (resolve, reject) => {
      const totalBytes = fileData.length;
      const filePath = folderPath + '/' + fileName;
      folderPath = folderPath.replace(/ /g, '-');
      fileName = fileName.replace(/ /g, '-');

      if (!folderPath.match(/[A-Z]|[a-z]|[0-9]|\-/g)) {
        return reject(
          `Failed to upsert file, folderPath=[${folderPath}] contains invalid characters`
        );
      }

      if (!fileName.match(/[A-Z]|[a-z]|[0-9]|\-/g)) {
        return reject(
          `Failed to upsert file, fileName=[${fileName}] contains invalid characters`
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
      let currentChunk = 0;
      const chunkSize = this.CHUNK_SIZE;
      const totalChunks = Math.ceil(totalBytes / chunkSize);

      const uploadChunk = () => {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, totalBytes);
        const chunk = fileData.subarray(start, end);

        writeStream.write(chunk, (err) => {
          if (err) {
            reject('File upload failed: ' + err);
            return;
          }
          uploadedBytes += chunk.length;
          const progress = (uploadedBytes / totalBytes) * 100;
          progressCallback?.(filePath, progress);
          currentChunk++;

          if (currentChunk < totalChunks) {
            uploadChunk();
          } else {
            writeStream.end();
          }
        });
      };

      writeStream.on('finish', async () => {
        const type = await (
          await import('file-type')
        ).fileTypeFromBuffer(fileData);

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

      uploadChunk();
    });
  }

  private _hasExtension(filename) {
    const regex = /\.[^\.]+$/;
    return regex.test(filename);
  }

  private _replaceExtension(filename, newExtension) {
    const regex = /\.[^\.]+$/;
    return filename.replace(regex, `.${newExtension}`);
  }

  private async getFilesToUpdate(file: TFileContent) {
    const filesToUpsert: (TFileContent & {})[] = [];
    const buffer = await this.getBufferFromData(file.fileData);

    if (!!file.resizeOptions?.length && !(await this.isImage(buffer))) {
      throw new Error('Is not possible to resize a non-image file.');
    }

    if (file.resizeOptions) {
      filesToUpsert.push({
        ...file,
        fileData: buffer,
      });
      for (const resizeOption of file.resizeOptions) {
        const format = resizeOption?.format?.extension;
        let fileName =
          resizeOption.fileResizePrefix +
          (resizeOption.fileName || file.fileName);

        if (format) {
          if (this._hasExtension(fileName)) {
            fileName = this._replaceExtension(
              fileName,
              resizeOption?.format?.extension
            );
          } else {
            fileName += format;
          }
        }

        filesToUpsert.push({
          folderName: file.folderName,
          fileName,
          fileMetadata: file.fileMetadata || {},
          fileData: await this._resizeImage(buffer, resizeOption),
        });
      }
    } else {
      filesToUpsert.push({
        folderName: file.folderName,
        fileName: file.fileName,
        fileMetadata: file.fileMetadata || {},
        fileData: buffer,
      });
    }

    return filesToUpsert;
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
    { fit = 'contain', format, ...rest }: TResizeOptions
  ): Promise<Buffer> {
    const sharpItem = sharp(data).resize({ fit, ...rest });
    if (format && format?.extension) {
      sharpItem.toFormat(format?.extension, format?.options);
    }
    return await sharpItem.toBuffer();
  }

  private async getBufferFromData(
    data: Blob | string | Buffer
  ): Promise<Buffer> {
    if (
      !(data instanceof Buffer) &&
      !(data instanceof Blob) &&
      !(typeof data === 'string')
    ) {
      throw new Error(
        'Invalid image format. Provide a Buffer, Base64, or Blob.'
      );
    }

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
}
