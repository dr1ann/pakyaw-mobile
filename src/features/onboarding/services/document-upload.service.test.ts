import { describe, expect, it } from 'vitest';

import { DriverDocumentUploadError, MAX_DRIVER_DOCUMENT_BYTES, validatePickedDriverDocument } from '@/features/onboarding/services/document-upload.service';

describe('driver document selection validation', () => {
  it('accepts images and PDFs below the private upload limit', () => {
    expect(validatePickedDriverDocument({ uri: 'file://document.pdf', name: 'document.pdf', size: 1024, mimeType: 'application/pdf' }))
      .toBe('application/pdf');
  });

  it('rejects unknown and oversized files before upload', () => {
    expect(() => validatePickedDriverDocument({ uri: 'file://document.txt', name: 'document.txt', size: 1024, mimeType: 'text/plain' }))
      .toThrow(DriverDocumentUploadError);
    expect(() => validatePickedDriverDocument({ uri: 'file://large.jpg', name: 'large.jpg', size: MAX_DRIVER_DOCUMENT_BYTES + 1, mimeType: 'image/jpeg' }))
      .toThrow(DriverDocumentUploadError);
  });
});
