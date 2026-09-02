import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DriverApplicationForm } from '@/features/onboarding/types';
import {
  assertNoUndefinedProperties,
  buildDriverApplicationCreatePayload,
  buildDriverApplicationDraftPatch,
  createDriverApplicationDraft,
  saveDriverApplicationDraft,
} from './driver-application.service';
import { DriverAccountNotReadyError } from './driver-profile.service';

vi.mock('@/services/firebase/firebase', () => ({
  auth: { currentUser: { uid: 'driver-1' } },
  firestore: {},
  collection: vi.fn(),
  doc: vi.fn((_db: unknown, ...parts: string[]) => parts.join('/')),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _methodName: 'serverTimestamp', _elements: undefined })),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  FieldValue: class MockFieldValue {},
  Timestamp: class MockTimestamp {},
}));

import { getDoc, setDoc, updateDoc } from '@/services/firebase/firebase';

const baseForm: DriverApplicationForm = {
  personalDetails: {
    fullLegalName: 'Driver One',
    verifiedMobile: '+639171234567',
    barangayAddress: 'Brgy. Cogon, Ormoc City',
    emergencyContact: { name: 'Contact One', mobile: '+639181234567' },
  },
  vehicle: {
    vehicleTypeId: 'tricycle',
    plateNumber: 'ABC-123',
    unitBodyNumber: 'UNIT-1',
    description: '',
    ownerOperatorInfo: 'Driver One',
    isDriverOwner: true,
    orcrNumber: '',
    orcrExpiry: '',
  },
  license: { number: '', expiry: '' },
  franchise: { documentType: 'franchise', documentNumber: '', expiry: '' },
};

describe('driver application draft payload construction', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('fresh Driver autosave: builds patch with defined values only and no undefined fields', () => {
    const freshForm: DriverApplicationForm = {
      ...baseForm,
      personalDetails: {
        ...baseForm.personalDetails,
        firstName: undefined,
        middleName: undefined,
        lastName: undefined,
        suffix: undefined,
      },
    };

    const patch = buildDriverApplicationDraftPatch(freshForm);
    expect(patch).toHaveProperty('personalDetails.barangayAddress', 'Brgy. Cogon, Ormoc City');
    expect(patch).toHaveProperty('personalDetails.emergencyContact.name', 'Contact One');
    expect(patch).not.toHaveProperty('personalDetails.firstName');
    expect(patch).not.toHaveProperty('personalDetails.middleName');
    expect(patch).not.toHaveProperty('personalDetails.lastName');
    expect(patch).not.toHaveProperty('personalDetails.suffix');
    expect(() => assertNoUndefinedProperties(patch)).not.toThrow();
  });

  it('first + last only: includes firstName and lastName but omits optional middle and suffix', () => {
    const form: DriverApplicationForm = {
      ...baseForm,
      personalDetails: {
        ...baseForm.personalDetails,
        firstName: 'Juan',
        middleName: '',
        lastName: 'Dela Cruz',
        suffix: '',
      },
    };

    const payload = buildDriverApplicationCreatePayload('driver-1', form, ['drivers_license']);
    expect(payload.personalDetails).toMatchObject({
      firstName: 'Juan',
      lastName: 'Dela Cruz',
    });
    expect(payload.personalDetails).not.toHaveProperty('middleName');
    expect(payload.personalDetails).not.toHaveProperty('suffix');
    expect(() => assertNoUndefinedProperties(payload)).not.toThrow();

    const patch = buildDriverApplicationDraftPatch(form);
    expect(patch).toHaveProperty('personalDetails.firstName', 'Juan');
    expect(patch).toHaveProperty('personalDetails.lastName', 'Dela Cruz');
    expect(patch).not.toHaveProperty('personalDetails.middleName');
    expect(patch).not.toHaveProperty('personalDetails.suffix');
    expect(() => assertNoUndefinedProperties(patch)).not.toThrow();
  });

  it('optional middle missing: preserves suffix when middle is absent', () => {
    const form: DriverApplicationForm = {
      ...baseForm,
      personalDetails: {
        ...baseForm.personalDetails,
        firstName: 'Juan',
        middleName: undefined,
        lastName: 'Dela Cruz',
        suffix: 'Jr.',
      },
    };

    const payload = buildDriverApplicationCreatePayload('driver-1', form, ['drivers_license']);
    expect(payload.personalDetails).toMatchObject({
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      suffix: 'Jr.',
    });
    expect(payload.personalDetails).not.toHaveProperty('middleName');
    expect(() => assertNoUndefinedProperties(payload)).not.toThrow();

    const patch = buildDriverApplicationDraftPatch(form);
    expect(patch).toHaveProperty('personalDetails.suffix', 'Jr.');
    expect(patch).not.toHaveProperty('personalDetails.middleName');
    expect(() => assertNoUndefinedProperties(patch)).not.toThrow();
  });

  it('optional suffix missing: preserves middle when suffix is absent', () => {
    const form: DriverApplicationForm = {
      ...baseForm,
      personalDetails: {
        ...baseForm.personalDetails,
        firstName: 'Juan',
        middleName: 'Santos',
        lastName: 'Dela Cruz',
        suffix: undefined,
      },
    };

    const payload = buildDriverApplicationCreatePayload('driver-1', form, ['drivers_license']);
    expect(payload.personalDetails).toMatchObject({
      firstName: 'Juan',
      middleName: 'Santos',
      lastName: 'Dela Cruz',
    });
    expect(payload.personalDetails).not.toHaveProperty('suffix');
    expect(() => assertNoUndefinedProperties(payload)).not.toThrow();

    const patch = buildDriverApplicationDraftPatch(form);
    expect(patch).toHaveProperty('personalDetails.middleName', 'Santos');
    expect(patch).not.toHaveProperty('personalDetails.suffix');
    expect(() => assertNoUndefinedProperties(patch)).not.toThrow();
  });

  it('legacy name-only application hydration: creates valid payload and patch without undefined', () => {
    const legacyForm: DriverApplicationForm = {
      ...baseForm,
      personalDetails: {
        fullLegalName: 'Legacy Driver Name',
        verifiedMobile: '+639171234567',
        barangayAddress: 'Brgy. Linao, Ormoc City',
        emergencyContact: { name: 'Emergency Contact', mobile: '+639181234567' },
      },
    };

    const payload = buildDriverApplicationCreatePayload('driver-legacy', legacyForm, ['drivers_license', 'orcr']);
    expect(payload.personalDetails).toEqual({
      fullLegalName: 'Legacy Driver Name',
      verifiedMobile: '+639171234567',
      barangayAddress: 'Brgy. Linao, Ormoc City',
      emergencyContact: { name: 'Emergency Contact', mobile: '+639181234567' },
    });
    expect(() => assertNoUndefinedProperties(payload)).not.toThrow();

    const patch = buildDriverApplicationDraftPatch(legacyForm);
    expect(patch).not.toHaveProperty('personalDetails.firstName');
    expect(patch).not.toHaveProperty('personalDetails.lastName');
    expect(() => assertNoUndefinedProperties(patch)).not.toThrow();
  });

  it('navigation before all Step 2 fields are filled: safely builds patch without undefined', () => {
    const incompleteStep2Form: DriverApplicationForm = {
      personalDetails: {
        fullLegalName: 'Driver One',
        verifiedMobile: '+639171234567',
        barangayAddress: '',
        emergencyContact: { name: '', mobile: '' },
      },
      vehicle: {
        vehicleTypeId: '',
        plateNumber: '',
        unitBodyNumber: '',
        description: '',
        ownerOperatorInfo: '',
        isDriverOwner: true,
        orcrNumber: '',
        orcrExpiry: '',
      },
      license: { number: '', expiry: '' },
      franchise: { documentType: 'franchise', documentNumber: '', expiry: '' },
    };

    const patch = buildDriverApplicationDraftPatch(incompleteStep2Form);
    expect(patch).toHaveProperty('personalDetails.fullLegalName', 'Driver One');
    expect(patch).toHaveProperty('personalDetails.barangayAddress', '');
    expect(patch).toHaveProperty('personalDetails.emergencyContact.name', '');
    expect(patch).toHaveProperty('personalDetails.emergencyContact.mobile', '');
    expect(patch).not.toHaveProperty('vehicle.vehicleTypeId');
    expect(() => assertNoUndefinedProperties(patch)).not.toThrow();
  });

  it('recursively detects and rejects any undefined values via assertNoUndefinedProperties', () => {
    expect(() => assertNoUndefinedProperties({ a: 1, b: { c: undefined } })).toThrow(
      'Found undefined at b.c',
    );
  });

  it('safely ignores FieldValue sentinels with internal undefined elements', () => {
    const sentinel = { _methodName: 'serverTimestamp', _elements: undefined };
    expect(() => assertNoUndefinedProperties({ createdAt: sentinel, name: 'Juan' })).not.toThrow();
  });
});

describe('createDriverApplicationDraft', () => {
  const canonicalUserDoc = {
    exists: () => true,
    data: () => ({
      uid: 'driver-1',
      name: 'Canonical Driver Name',
      mobile: '+639171234567',
      role: 'driver',
      accountStatus: 'active',
    }),
  };

  beforeEach(() => {
    vi.mocked(getDoc).mockResolvedValue(canonicalUserDoc as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('canonical user + matching application identity: create succeeds', async () => {
    vi.stubGlobal('__DEV__', true);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await createDriverApplicationDraft('driver-1', baseForm, ['drivers_license', 'orcr']);

    expect(setDoc).toHaveBeenCalledTimes(1);
    const [docRef, payload] = vi.mocked(setDoc).mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(docRef).toBe('driverApplications/driver-1');
    expect(payload).toMatchObject({
      uid: 'driver-1',
      status: 'draft',
      personalDetails: {
        fullLegalName: 'Canonical Driver Name',
        verifiedMobile: '+639171234567',
      },
      vehicle: { vehicleTypeId: 'tricycle' },
      documents: { drivers_license: 'missing', orcr: 'missing' },
    });

    // Check safe booleans diagnostic logging
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('userExists=true\ndriverRole=true\naccountActive=true\nfullLegalNameMatches=true\nverifiedMobileMatches=true\nvehicleTypeValid=true'),
    );
  });

  it('missing users doc: application create not attempted', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
    } as any);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      createDriverApplicationDraft('driver-missing', baseForm, ['drivers_license']),
    ).rejects.toThrow(DriverAccountNotReadyError);

    expect(setDoc).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[Driver Onboarding] account identity not ready');
  });

  it('inactive account: application create not attempted', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: 'driver-suspended',
        name: 'Suspended Driver',
        mobile: '+639171234567',
        role: 'driver',
        accountStatus: 'suspended',
      }),
    } as any);

    await expect(
      createDriverApplicationDraft('driver-suspended', baseForm, ['drivers_license']),
    ).rejects.toThrow(DriverAccountNotReadyError);

    expect(setDoc).not.toHaveBeenCalled();
  });

  it('local wizard name differs from users.name: application uses users.name', async () => {
    const divergedForm: DriverApplicationForm = {
      ...baseForm,
      personalDetails: {
        ...baseForm.personalDetails,
        fullLegalName: 'Different Wizard Name',
      },
    };

    await createDriverApplicationDraft('driver-1', divergedForm, ['drivers_license']);

    const [, payload] = vi.mocked(setDoc).mock.calls[0] as unknown as [unknown, Record<string, unknown>];
    const personal = payload.personalDetails as Record<string, unknown>;
    expect(personal.fullLegalName).toBe('Canonical Driver Name');
  });

  it('local phone formatting differs: application uses users.mobile', async () => {
    const divergedPhoneForm: DriverApplicationForm = {
      ...baseForm,
      personalDetails: {
        ...baseForm.personalDetails,
        verifiedMobile: '0917-123-4567',
      },
    };

    await createDriverApplicationDraft('driver-1', divergedPhoneForm, ['drivers_license']);

    const [, payload] = vi.mocked(setDoc).mock.calls[0] as unknown as [unknown, Record<string, unknown>];
    const personal = payload.personalDetails as Record<string, unknown>;
    expect(personal.verifiedMobile).toBe('+639171234567');
  });

  it('stale cached profile: canonical account wins', async () => {
    const staleProfile = {
      name: 'Old Stale Name',
      mobile: '+639170000000',
    };

    const payload = buildDriverApplicationCreatePayload(
      'driver-1',
      {
        ...baseForm,
        personalDetails: {
          ...baseForm.personalDetails,
          fullLegalName: 'Local Wizard Name',
          verifiedMobile: '+639179999999',
        },
      },
      ['drivers_license'],
      staleProfile,
    );

    expect(payload.personalDetails).toMatchObject({
      fullLegalName: 'Old Stale Name',
      verifiedMobile: '+639170000000',
    });
  });

  it('fresh OTP account creation: Step 3 create succeeds without race', async () => {
    const freshCanonicalAccount = {
      uid: 'fresh-driver-1',
      name: 'Freshly Verified Driver',
      mobile: '+639178889999',
      role: 'driver' as const,
      accountStatus: 'active' as const,
    };

    await createDriverApplicationDraft(
      'fresh-driver-1',
      baseForm,
      ['drivers_license', 'orcr'],
      freshCanonicalAccount,
    );

    expect(setDoc).toHaveBeenCalledWith(
      'driverApplications/fresh-driver-1',
      expect.objectContaining({
        uid: 'fresh-driver-1',
        personalDetails: expect.objectContaining({
          fullLegalName: 'Freshly Verified Driver',
          verifiedMobile: '+639178889999',
        }),
      }),
    );
  });

  it('persists exact Admin catalog keys without abbreviating them', async () => {
    await createDriverApplicationDraft(
      'driver-1',
      baseForm,
      ['barangay_clearance'],
      undefined,
      {
        vehicleTypes: [{ id: 'tricycle', type: 'Tricycle', capacity: 3, wheels: 3, status: 'active', icon: null }],
        documentRequirements: [{
          key: 'barangay_clearance',
          label: 'Barangay Clearance',
          description: '',
          active: true,
          requiredForApplication: true,
          requiredForOnline: true,
          requiresIdentification: false,
          requiresIssuanceDate: false,
          requiresExpiryDate: false,
          vehicleTypeIds: [],
          sortOrder: 1,
        }],
      },
    );

    const [, payload] = vi.mocked(setDoc).mock.calls[0] as unknown as [unknown, Record<string, unknown>];
    expect(payload.documents).toEqual({ barangay_clearance: 'missing' });
    expect(payload.documents).not.toHaveProperty('brgy_clearance');
  });

  it('reports the application create stage and Firebase code without private data', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.mocked(setDoc).mockRejectedValueOnce({ code: 'permission-denied' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(createDriverApplicationDraft('driver-1', baseForm, ['tricycle_requirement']))
      .rejects.toMatchObject({ code: 'permission-denied' });

    expect(errorSpy).toHaveBeenCalledWith(
      '[Driver Onboarding] driverApplications/{uid} create failed: permission-denied',
    );
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Canonical Driver Name'));
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('driver-1'));
  });
});

describe('saveDriverApplicationDraft', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('updates a draft with field-level patch and logs stage in development', async () => {
    vi.stubGlobal('__DEV__', true);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await saveDriverApplicationDraft('driver-1', baseForm);

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [docRef, patch] = vi.mocked(updateDoc).mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(docRef).toBe('driverApplications/driver-1');
    expect(patch).toHaveProperty('personalDetails.barangayAddress', 'Brgy. Cogon, Ormoc City');
    expect(patch).toHaveProperty('vehicle.vehicleTypeId', 'tricycle');
    expect(() => assertNoUndefinedProperties(patch)).not.toThrow();

    expect(logSpy).toHaveBeenCalledWith('[Driver Onboarding] updating driverApplications/{uid}');
    expect(logSpy).toHaveBeenCalledWith('[Driver Onboarding] driverApplications/{uid} updated');
  });

  it('reports the application update stage and Firebase code without private data on failure', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.mocked(updateDoc).mockRejectedValueOnce({ code: 'permission-denied' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(saveDriverApplicationDraft('driver-1', baseForm))
      .rejects.toMatchObject({ code: 'permission-denied' });

    expect(errorSpy).toHaveBeenCalledWith(
      '[Driver Onboarding] driverApplications/{uid} update failed: permission-denied',
    );
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Driver One'));
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('driver-1'));
  });
});
