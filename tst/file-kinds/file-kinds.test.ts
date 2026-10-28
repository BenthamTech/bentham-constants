import {
  FileExtension,
  FILE_KINDS,
  FILE_EXTENSIONS,
  SNIFF_BYTES,
  isFileExtension,
  extensionOf,
  kindForFileName,
  contentTypeForFileName,
  acceptAllows,
  acceptLabel,
  toAcceptAttribute,
  sniffMatches,
} from '../../src/file-kinds';

const { PDF, JPG, JPEG, PNG, ZIP } = FileExtension;

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => Uint8Array.from(Buffer.from(text, 'latin1'));

describe('FILE_KINDS', () => {
  // Adding a type widens what every flow could be configured to accept: make it deliberate.
  it('lists exactly the types Bentham stores', () => {
    expect(FILE_EXTENSIONS).toEqual(['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.csv', '.zip']);
  });

  it('has a kind for every FileExtension, keyed by its own extension', () => {
    expect(Object.keys(FILE_KINDS)).toEqual(FILE_EXTENSIONS);
    for (const ext of FILE_EXTENSIONS) expect(FILE_KINDS[ext].extension).toBe(ext);
  });

  it('never falls back to a generic content type', () => {
    for (const ext of FILE_EXTENSIONS) expect(FILE_KINDS[ext].contentType).not.toBe('application/octet-stream');
  });
});

describe('extensionOf', () => {
  it.each([
    ['report.pdf', '.pdf'],
    ['Scan.PDF', '.pdf'],
    ['my.report.final.Xlsx', '.xlsx'],
    ['C:\\Users\\me\\photo.JPG', '.jpg'],
    ['folder/statement.csv', '.csv'],
    ['README', ''],
    ['.env', ''],
    ['name.', ''],
    ['', ''],
  ])('%s → %s', (name, ext) => {
    expect(extensionOf(name)).toBe(ext);
  });
});

describe('kindForFileName and contentTypeForFileName', () => {
  it('derive from the extension, ignoring case', () => {
    expect(kindForFileName('a.PNG')).toBe(FILE_KINDS['.png']);
    expect(contentTypeForFileName('a.jpeg')).toBe('image/jpeg');
    expect(contentTypeForFileName('a.xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it.each(['a.exe', 'a.docx', 'a.svg', 'a.html', 'a.xlsm', 'a', '.pdf'])('refuse %s', (name) => {
    expect(kindForFileName(name)).toBeNull();
    expect(contentTypeForFileName(name)).toBeNull();
  });

  it("don't treat object prototype keys as extensions", () => {
    expect(kindForFileName('a.constructor')).toBeNull();
  });
});

describe('isFileExtension', () => {
  it('accepts listed extensions only', () => {
    expect(isFileExtension('.pdf')).toBe(true);
    expect(isFileExtension('.PDF')).toBe(false);
    expect(isFileExtension('pdf')).toBe(false);
    expect(isFileExtension('.docx')).toBe(false);
    expect(isFileExtension(undefined)).toBe(false);
  });
});

describe('acceptAllows', () => {
  it('matches the extension case-insensitively', () => {
    expect(acceptAllows([PDF, PNG], 'Scan.PDF')).toBe(true);
    expect(acceptAllows([PDF, PNG], 'photo.jpg')).toBe(false);
    expect(acceptAllows([PDF], 'no-extension')).toBe(false);
    expect(acceptAllows([], 'a.pdf')).toBe(false);
  });

  it('treats .jpg and .jpeg as separate entries', () => {
    expect(acceptAllows([JPG], 'photo.jpeg')).toBe(false);
  });

  it.each([
    ['a comma-separated string', '.pdf,.png'],
    ['an unknown extension', ['.pdf', '.docx']],
    ['an extension without the dot', ['pdf']],
  ])('throws on %s', (_label, accept) => {
    expect(() => acceptAllows(accept as never, 'a.pdf')).toThrow(TypeError);
  });
});

describe('acceptLabel and toAcceptAttribute', () => {
  it('keep the order given', () => {
    expect(acceptLabel([PDF, JPG, PNG])).toBe('PDF, JPG, PNG');
    expect(toAcceptAttribute([PDF, JPG, JPEG, PNG])).toBe('.pdf,.jpg,.jpeg,.png');
    expect(toAcceptAttribute([ZIP])).toBe('.zip');
  });
});

describe('sniffMatches', () => {
  const zip = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);

  it.each([
    ['.pdf', ascii('%PDF-1.7\n')],
    ['.pdf', ascii(`${'\0'.repeat(500)}%PDF-1.4`)],
    ['.jpg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['.JPEG', bytes(0xff, 0xd8, 0xff, 0xe1)],
    ['.png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00)],
    ['.xlsx', zip],
    ['.zip', zip],
    ['.xls', bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)],
    ['.csv', ascii('name,amount\nA,1\n')],
    ['.csv', Uint8Array.from([0x41, 0x2c, 0x80, 0xe9, 0x0a])], // Windows-1252, not UTF-8
  ])('accepts a real %s', (ext, head) => {
    expect(sniffMatches(head, ext)).toBe(true);
  });

  it.each([
    ['.pdf', ascii('<!DOCTYPE html><html>')],
    ['.pdf', ascii(`${' '.repeat(1020)}%PDF-1.4`)], // signature starts past the first 1 KB
    ['.pdf', ascii('%PDF')], // truncated
    ['.jpg', bytes(0x89, 0x50, 0x4e, 0x47)],
    ['.png', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['.xlsx', bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)], // an .xls renamed
    ['.xls', zip], // an .xlsx renamed
    ['.xls', ascii('<html><table>')], // HTML saved as .xls
    ['.csv', bytes(0x4d, 0x5a, 0x90, 0x00, 0x03)], // a Windows program
    ['.csv', ascii('a,b\n\0c')],
    ['.exe', bytes(0x4d, 0x5a)],
    ['.pdf', new Uint8Array(0)],
  ])('refuses %s with %p', (ext, head) => {
    expect(sniffMatches(head, ext)).toBe(false);
  });

  it('looks at no more than SNIFF_BYTES for CSV', () => {
    const head = new Uint8Array(SNIFF_BYTES + 10).fill(0x41);
    head[SNIFF_BYTES + 5] = 0;
    expect(sniffMatches(head, '.csv')).toBe(true);
  });
});
