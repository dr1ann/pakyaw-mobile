import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DriverDocumentUploadError,
  MAX_DRIVER_DOCUMENT_BYTES,
  uploadDriverDocument,
  validatePickedDriverDocument,
} from '@/features/onboarding/services/document-upload.service';

vi.mock('@/services/firebase/firebase', () => ({
  firestore: {},
  storage: {},
  ref: vi.fn((_storage: unknown, path: string) => ({ fullPath: path })),
  uploadBytesResumable: vi.fn(),
  doc: vi.fn((_db: unknown, ...parts: string[]) => parts.join('/')),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  setDoc: vi.fn(),
}));

import { setDoc, uploadBytesResumable } from '@/services/firebase/firebase';

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
});

describe('uploadDriverDocument', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const validAsset = {
    uri: 'file:///data/user/0/com.example.pakyaw/cache/test-doc.jpg',
    name: 'test-doc.jpg',
    size: 2048,
    mimeType: 'image/jpeg',
  };

  it('logs upload stages and writes metadata on success', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/jpeg' })),
      }),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    vi.mocked(uploadBytesResumable).mockReturnValue({
      on: vi.fn((_event, _onProgress, _onError, onComplete) => {
        onComplete();
      }),
    } as any);
    vi.mocked(setDoc).mockResolvedValueOnce(undefined);

    const result = await uploadDriverDocument(
      'driver-uid-123',
      'drivers_license',
      validAsset,
      { identificationNumber: 'N01-12-345678' },
      undefined,
      'draft',
    );

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

  it('logs safe diagnostic error without PII when storage upload fails', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/jpeg' })),
      }),
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.mocked(uploadBytesResumable).mockReturnValue({
      on: vi.fn((_event, _onProgress, onError) => {
        onError({ code: 'storage/unauthorized', message: 'User is not authorized' });
      }),
    } as any);

    await expect(
      uploadDriverDocument(
        'secret-uid-999',
        'valid_id',
        validAsset,
        {},
        undefined,
        'draft',
      ),
    ).rejects.toThrow('We couldn’t upload that file. Try again.');

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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'image/jpeg' })),
      }),
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.mocked(uploadBytesResumable).mockReturnValue({
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
        validAsset,
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
