import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DriverDocumentUploadError,
  MAX_DRIVER_DOCUMENT_BYTES,
  getUriScheme,
  uploadDriverDocument,
  validatePickedDriverDocument,
} from '@/features/onboarding/services/document-upload.service';

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
  storage: {},
  ref: vi.fn((_storage: unknown, path: string) => ({ fullPath: path })),
  putFile: vi.fn(),
  uploadBytesResumable: vi.fn(),
  doc: vi.fn((_db: unknown, ...parts: string[]) => parts.join('/')),
  serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp', _elements: undefined })),
  setDoc: vi.fn(),
  FieldValue: class MockFieldValue {},
  Timestamp: class MockTimestamp {},
}));

import { putFile, setDoc } from '@/services/firebase/firebase';

describe('driver document selection validation', () => {
  it('accepts images and PDFs below the private upload limit', () => {
    expect(
      validatePickedDriverDocument({
        uri: 'file://document.pdf',
        name: 'document.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      }),
    ).toBe('application/pdf');
  });

  it('rejects unknown and oversized files before upload', () => {
    expect(() =>
      validatePickedDriverDocument({
        uri: 'file://document.txt',
        name: 'document.txt',
        size: 1024,
        mimeType: 'text/plain',
      }),
    ).toThrow(DriverDocumentUploadError);
    expect(() =>
      validatePickedDriverDocument({
        uri: 'file://large.jpg',
        name: 'large.jpg',
        size: MAX_DRIVER_DOCUMENT_BYTES + 1,
        mimeType: 'image/jpeg',
      }),
    ).toThrow(DriverDocumentUploadError);
  });

  it('extracts URI scheme correctly for content and file URIs', () => {
    expect(getUriScheme('content://media/external/images/media/123')).toBe('content');
    expect(getUriScheme('file:///var/mobile/Containers/Data/temp.jpg')).toBe('file');
    expect(getUriScheme('invalid-uri')).toBe('unknown');
  });
});

describe('uploadDriverDocument', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const validImageAsset = {
    uri: 'file:///data/user/0/com.example.pakyaw/cache/test-doc.jpg',
    name: 'test-doc.jpg',
    size: 2048,
    mimeType: 'image/jpeg',
  };

  const validPdfAsset = {
    uri: 'content://com.android.providers.media.documents/document/123',
    name: 'franchise.pdf',
    size: 4096,
    mimeType: 'application/pdf',
  };

  it('uploads image file via native putFile and writes metadata without Blob conversion', async () => {
    vi.stubGlobal('__DEV__', true);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    let capturedProgressCb: ((snapshot: any) => void) | undefined;
    vi.mocked(putFile).mockReturnValue({
      on: vi.fn((_event, onProgress, _onError, onComplete) => {
        capturedProgressCb = onProgress;
        onComplete();
      }),
    } as any);
    vi.mocked(setDoc).mockResolvedValueOnce(undefined);

    const progressReports: number[] = [];
    const result = await uploadDriverDocument(
      'driver-uid-123',
      'drivers_license',
      validImageAsset,
      { identificationNumber: 'N01-12-345678' },
      (ratio) => progressReports.push(ratio),
      'draft',
    );

    // Verify putFile was called with file URI directly
    expect(putFile).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: expect.stringMatching(/^driver-documents\/driver-uid-123\/drivers_license\//) }),
      validImageAsset.uri,
      { contentType: 'image/jpeg' },
    );

    // Verify Blob / fetch conversion was NEVER called
    expect(fetchSpy).not.toHaveBeenCalled();

    // Verify progress forwarding
    if (capturedProgressCb) {
      capturedProgressCb({ bytesTransferred: 1024, totalBytes: 2048 });
      expect(progressReports).toContain(0.5);
    }

    // Verify metadata write
    expect(result.storagePath).toMatch(/^driver-documents\/driver-uid-123\/drivers_license\//);
    expect(setDoc).toHaveBeenCalledWith(
      'drivers/driver-uid-123/driverDocuments/drivers_license',
      expect.objectContaining({
        requirementKey: 'drivers_license',
        state: 'uploaded',
        contentType: 'image/jpeg',
        sizeBytes: 2048,
        identificationNumber: 'N01-12-345678',
      }),
    );

    expect(logSpy).toHaveBeenCalledWith('[Driver Document Upload] starting storage upload');
    expect(logSpy).toHaveBeenCalledWith('[Driver Document Upload] storage upload completed');
    expect(logSpy).toHaveBeenCalledWith('[Driver Document Upload] writing document metadata');
    expect(logSpy).toHaveBeenCalledWith('[Driver Document Upload] document metadata written');
  });

  it('uploads PDF file via native putFile with content URI', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.mocked(putFile).mockReturnValue({
      on: vi.fn((_event, _onProgress, _onError, onComplete) => {
        onComplete();
      }),
    } as any);
    vi.mocked(setDoc).mockResolvedValueOnce(undefined);

    const result = await uploadDriverDocument(
      'driver-uid-123',
      'franchise',
      validPdfAsset,
      { identificationNumber: 'FR-9988' },
      undefined,
      'draft',
    );

    expect(putFile).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: expect.stringMatching(/^driver-documents\/driver-uid-123\/franchise\//) }),
      validPdfAsset.uri,
      { contentType: 'application/pdf' },
    );

    expect(result.storagePath).toMatch(/^driver-documents\/driver-uid-123\/franchise\//);
  });

  it('logs safe diagnostic error without PII when native storage upload fails', async () => {
    vi.stubGlobal('__DEV__', true);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.mocked(putFile).mockReturnValue({
      on: vi.fn((_event, _onProgress, onError) => {
        onError({ code: 'storage/unauthorized', message: 'User is not authorized' });
      }),
    } as any);

    await expect(
      uploadDriverDocument(
        'secret-uid-999',
        'valid_id',
        validImageAsset,
        {},
        undefined,
        'draft',
      ),
    ).rejects.toThrow('We couldn’t upload that file. Try again.');

    expect(setDoc).not.toHaveBeenCalled();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Driver Document Upload] storage upload failed:\ncode=storage/unauthorized\nrequirementKey=valid_id\ncontentType=image/jpeg\nsizeBytes=2048\napplicationStatus=draft'),
    );

    // Verify NO PII or sensitive path details leaked into log
    for (const call of errorSpy.mock.calls) {
      const logMessage = call.join(' ');
      expect(logMessage).not.toContain('secret-uid-999');
      expect(logMessage).not.toContain('file:///data/user');
      expect(logMessage).not.toContain('driver-documents/secret-uid-999');
    }
  });

  it('logs safe diagnostic error when storage succeeds but metadata write fails', async () => {
    vi.stubGlobal('__DEV__', true);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.mocked(putFile).mockReturnValue({
      on: vi.fn((_event, _onProgress, _onError, onComplete) => {
        onComplete();
      }),
    } as any);

    vi.mocked(setDoc).mockRejectedValueOnce({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions.',
    });

    await expect(
      uploadDriverDocument(
        'secret-uid-999',
        'orcr',
        validImageAsset,
        {},
        undefined,
        'draft',
      ),
    ).rejects.toThrow('We couldn’t upload that file. Try again.');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Driver Document Upload] document metadata write failed:\ncode=permission-denied\nrequirementKey=orcr\ncontentType=image/jpeg\nsizeBytes=2048\napplicationStatus=draft'),
    );

    // Verify NO PII or sensitive path details leaked into log
    for (const call of errorSpy.mock.calls) {
      const logMessage = call.join(' ');
      expect(logMessage).not.toContain('secret-uid-999');
      expect(logMessage).not.toContain('file:///data/user');
    }
  });
});
