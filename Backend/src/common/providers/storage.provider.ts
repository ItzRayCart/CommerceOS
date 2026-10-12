import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestError } from '@api/common/errors/app-error.js';
export interface ImageUpload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}
export interface StorageProvider {
  saveImages(files: ImageUpload[]): Promise<{ url: string }[]>;
}
export function imageExtension(file: ImageUpload): 'jpg' | 'png' | 'webp' {
  const b = file.buffer;
  let ext: 'jpg' | 'png' | 'webp' | undefined;
  if (b.length > 12 && b[0] === 255 && b[1] === 216 && b[2] === 255) ext = 'jpg';
  if (b.length > 24 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    ext = 'png';
  if (
    b.length > 16 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  )
    ext = 'webp';
  if (
    !ext ||
    file.mimetype !== `image/${ext === 'jpg' ? 'jpeg' : ext}` ||
    !new RegExp(`\\.${ext === 'jpg' ? 'jpe?g' : ext}$`, 'i').test(file.originalname)
  )
    throw new BadRequestError('Only genuine JPEG, PNG and WebP images are accepted.');
  return ext;
}
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly directory: string) {}
  async saveImages(files: ImageUpload[]) {
    if (!files.length || files.length > 10 || files.some((f) => f.buffer.length > 5 * 1024 * 1024))
      throw new BadRequestError('Upload 1–10 images, at most 5 MB each.');
    const extensions = files.map(imageExtension);
    await mkdir(this.directory, { recursive: true });
    const saved: string[] = [];
    try {
      for (const [i, file] of files.entries()) {
        const name = `${randomUUID()}.${extensions[i]}`;
        await writeFile(join(this.directory, name), file.buffer, { flag: 'wx' });
        saved.push(name);
      }
      return saved.map((name) => ({ url: `/uploads/${name}` }));
    } catch (error) {
      await Promise.all(saved.map((name) => unlink(join(this.directory, name))));
      throw error;
    }
  }
}
