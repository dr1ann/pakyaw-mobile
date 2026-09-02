import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  REQUIRED_DOCUMENT_TYPES,
  getSubmissionReadiness,
  requirementAppliesToVehicle,
  type DocumentState,
  type DriverApplication,
  type DriverDocumentMetadata,
} from '@pakyaw/shared/onboarding';
import { useSession } from '@pakyaw/shared/features/auth/hooks/useSession';
import {
  asApplication,
  ensureDriverApplicationDraft,
  saveDriverApplicationDraft,
  submitDriverApplication,
  subscribeDriverApplication,
  syncDriverDocuments,
} from '@/features/onboarding/services/driver-application.service';
import { getDriverOnboardingCatalog } from '@/features/onboarding/services/onboarding-catalog.service';
import { doc, firestore, getDoc } from '@/services/firebase/firebase';
import type { DriverApplicationForm, DriverApplicationSnapshot } from '@/features/onboarding/types';

export type SubmitDriverApplicationOptions = {
  readonly form?: DriverApplicationForm;
  readonly documents?: Record<string, DocumentState>;
  readonly documentMetadata?: Record<string, DriverDocumentMetadata>;
};

export function useDriverApplication() {
  const { uid } = useSession();
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({
    queryKey: ['driverOnboardingCatalog', uid],
    queryFn: getDriverOnboardingCatalog,
    enabled: Boolean(uid),
    staleTime: 60_000,
  });
  const [snapshot, setSnapshot] = useState<{
    readonly uid: string | null;
    readonly application: DriverApplicationSnapshot | null;
    readonly error: Error | null;
    readonly loaded: boolean;
  }>({ uid: null, application: null, error: null, loaded: false });
  const [readinessNow] = useState(() => Date.now());
  const draftCreatedRef = useRef(false);

  useEffect(() => {
    draftCreatedRef.current = false;
  }, [uid]);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeDriverApplication(uid, (value) => {
      setSnapshot({ uid, application: value, error: null, loaded: true });
      queryClient.setQueryData(['driverApplication', uid], value);
    }, (nextError) => {
      setSnapshot({ uid, application: null, error: nextError, loaded: true });
    });
  }, [queryClient, uid]);

  useEffect(() => {
    if (!uid || !catalogQuery.data?.documentRequirements) return;
    const keys = catalogQuery.data.documentRequirements.map((r) => r.key);
    syncDriverDocuments(uid, keys);
  }, [uid, catalogQuery.data]);

  const activeSnapshot = snapshot.uid === uid ? snapshot : null;
  const application = activeSnapshot?.application ?? null;
  const error = activeSnapshot?.error ?? null;
  const isApplicationLoaded = uid === null || activeSnapshot?.loaded === true;

  const saveMutation = useMutation({
    mutationFn: async (form: DriverApplicationForm) => {
      if (!uid) throw new Error('Sign in before completing an application.');
      if (application === null) {
        const catalog = catalogQuery.data;
        const requirementKeys = catalog
          ? catalog.documentRequirements
              .filter((requirement) => requirementAppliesToVehicle(requirement, form.vehicle.vehicleTypeId))
              .map((requirement) => requirement.key)
          : REQUIRED_DOCUMENT_TYPES;

        const result = await ensureDriverApplicationDraft(uid, form, requirementKeys, undefined, catalog);
        draftCreatedRef.current = true;
        return result;
      } else {
        draftCreatedRef.current = true;
        await saveDriverApplicationDraft(uid, form);
      }
    },
  });
  const submitMutation = useMutation({
    mutationFn: async (options?: SubmitDriverApplicationOptions) => {
      if (!uid) throw new Error('Sign in before completing an application.');
      if (!catalogQuery.data) throw new Error('The current onboarding catalog is unavailable. Try again.');

      // Fetch the latest Firestore application doc directly so validation never lags behind React state
      const snap = await getDoc(doc(firestore, 'driverApplications', uid));
      const rawData = snap.exists() ? snap.data() : null;
      if (!rawData && !application) {
        throw new Error('Save your application before submitting.');
      }

      const baseApp = application ?? asApplication(uid, rawData ?? {});
      const mergedForm = options?.form ?? baseApp;
      const vehicleTypeId = mergedForm.vehicle.vehicleTypeId || baseApp.vehicle.vehicleTypeId;

      const requirements = catalogQuery.data.documentRequirements
        .filter((requirement) => requirementAppliesToVehicle(requirement, vehicleTypeId));

      // Build effective documents & metadata combining snapshot, passed options, and Firestore records
      const effectiveDocs: Record<string, DocumentState> = {
        ...(baseApp.documents ?? {}),
        ...(options?.documents ?? {}),
      };
      const effectiveMeta: Record<string, DriverDocumentMetadata> = {
        ...(baseApp.documentMetadata ?? {}),
        ...(options?.documentMetadata ?? {}),
      };

      await Promise.all(
        requirements.map(async (req) => {
          if (!effectiveDocs[req.key] || effectiveDocs[req.key] === 'missing') {
            try {
              const docSnap = await getDoc(doc(firestore, 'drivers', uid, 'driverDocuments', req.key));
              if (docSnap.exists()) {
                const d = docSnap.data();
                if (d?.state) effectiveDocs[req.key] = d.state;
                if (d) {
                  effectiveMeta[req.key] = {
                    ...effectiveMeta[req.key],
                    identificationNumber: d.identificationNumber || effectiveMeta[req.key]?.identificationNumber,
                    issuanceDate: d.issuanceDate || effectiveMeta[req.key]?.issuanceDate,
                    expiryDate: d.expiryDate || effectiveMeta[req.key]?.expiryDate,
                  };
                }
              }
            } catch {
              // ignore
            }
          }
        }),
      );

      const appToValidate: DriverApplication = {
        ...baseApp,
        ...mergedForm,
        personalDetails: { ...baseApp.personalDetails, ...mergedForm.personalDetails },
        vehicle: { ...baseApp.vehicle, ...mergedForm.vehicle },
        license: { ...baseApp.license, ...mergedForm.license },
        franchise: { ...baseApp.franchise, ...mergedForm.franchise },
        documents: effectiveDocs,
        documentMetadata: effectiveMeta,
      };

      const readiness = getSubmissionReadiness(appToValidate, Date.now(), requirements);
      if (!readiness.ready) {
        console.error('[Driver Application] Submission readiness issues:', readiness.issues);
        const firstIssue = readiness.issues[0];
        const detail = firstIssue ? ` (${firstIssue.field}: ${firstIssue.code})` : '';
        throw new Error(`Complete the highlighted application fields and documents before submitting.${detail}`);
      }

      await submitDriverApplication(uid);
    },
  });

  const readiness = useMemo(
    () => application && catalogQuery.data ? getSubmissionReadiness(
      application as DriverApplication,
      readinessNow,
      catalogQuery.data.documentRequirements.filter((requirement) => requirementAppliesToVehicle(requirement, application.vehicle.vehicleTypeId)),
    ) : null,
    [application, readinessNow, catalogQuery.data],
  );

  return { uid, application, readiness, error, isApplicationLoaded, saveMutation, submitMutation, catalog: catalogQuery.data ?? null, catalogQuery };
}
