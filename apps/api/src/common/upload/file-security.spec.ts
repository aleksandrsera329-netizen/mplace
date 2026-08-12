import { BadRequestException } from '@nestjs/common';
import {
  detectMagicMime,
  normalizeFilename,
  randomStorageFileName,
  safeExtension,
  validateUploadedFile,
} from './file-security';

function fakeFile(
  buffer: Buffer,
  originalname: string,
  mimetype: string,
): Express.Multer.File {
  return {
    buffer,
    originalname,
    mimetype,
    size: buffer.length,
    fieldname: 'file',
    encoding: '7bit',
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
  };
}

describe('File security (Stage 24)', () => {
  it('normalizeFilename strips path traversal', () => {
    expect(normalizeFilename('../../etc/passwd')).toBe('passwd');
    expect(normalizeFilename('C:\\\\Windows\\\\evil.exe')).toBe('evil.exe');
    expect(normalizeFilename('..\\..\\x.php')).toBe('x.php');
  });

  it('safeExtension blocks dangerous extensions', () => {
    expect(() => safeExtension('shell.php')).toThrow(BadRequestException);
    expect(() => safeExtension('run.exe')).toThrow(BadRequestException);
    expect(() => safeExtension('page.html')).toThrow(BadRequestException);
    expect(safeExtension('photo.JPG')).toBe('.jpg');
  });

  it('randomStorageFileName never embeds original name', () => {
    const key = randomStorageFileName('.png');
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i,
    );
    expect(key.includes('photo')).toBe(false);
  });

  it('detectMagicMime recognizes PNG/JPEG/PDF', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    expect(detectMagicMime(png)).toBe('image/png');

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    expect(detectMagicMime(jpeg)).toBe('image/jpeg');

    const pdf = Buffer.from('%PDF-1.4 hello world');
    expect(detectMagicMime(pdf)).toBe('application/pdf');

    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    expect(detectMagicMime(exe)).toBe('application/x-msdownload');
  });

  it('rejects .exe / mismatched magic for images', async () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    await expect(
      validateUploadedFile(fakeFile(exe, 'virus.exe', 'image/png'), 'image'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects HTML disguised as image by extension', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    await expect(
      validateUploadedFile(
        fakeFile(html, 'xss.html', 'text/html'),
        'image',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts valid PNG image', async () => {
    // Minimal valid-ish PNG header + padding for file-type
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0),
    ]);
    const result = await validateUploadedFile(
      fakeFile(png, 'photo.png', 'image/png'),
      'image',
    );
    expect(result.mimeType).toBe('image/png');
    expect(result.storageKeyName).toMatch(/\.png$/);
    expect(result.safeOriginalName).toBe('photo.png');
  });

  it('accepts CSV text content', async () => {
    const csv = Buffer.from('sku,name,price\nA1,Valve,100\n');
    const result = await validateUploadedFile(
      fakeFile(csv, 'import.csv', 'text/csv'),
      'csv',
    );
    expect(result.kind).toBe('csv');
    expect(result.mimeType).toBe('text/csv');
  });

  it('rejects oversized files', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 0xff);
    // JPEG magic so it fails on size before/with content
    big[0] = 0xff;
    big[1] = 0xd8;
    big[2] = 0xff;
    await expect(
      validateUploadedFile(
        fakeFile(big, 'huge.jpg', 'image/jpeg'),
        'image',
      ),
    ).rejects.toThrow(/too large/i);
  });

  it('rejects PE binary as CSV', async () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    await expect(
      validateUploadedFile(fakeFile(exe, 'data.csv', 'text/csv'), 'csv'),
    ).rejects.toThrow(BadRequestException);
  });
});
