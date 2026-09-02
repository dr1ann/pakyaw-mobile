import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getSubmissionReadiness,
  requirementAppliesToVehicle,
  type DriverApplication,
} from '@pakyaw/shared/onboarding';
import { useSession } from '@pakyaw/shared/features/auth/hooks/useSession';
import {
  createDriverApplicationDraft,
  saveDriverApplicationDraft,
  submitDriverApplication,
  subscribeDriverApplication,
} from '@/features/onboarding/services/driver-application.service';
import { getDriverOnboardingCatalog } from '@/features/onboarding/services/onboarding-catalog.service';
import type { DriverApplicationForm, DriverApplicationSnapshot } from '@/features/onboarding/types';

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

  const activeSnapshot = snapshot.uid === uid ? snapshot : null;
  const application = activeSnapshot?.application ?? null;
  const error = activeSnapshot?.error ?? null;
  const isApplicationLoaded = uid === null || activeSnapshot?.loaded === true;

  const saveMutation = useMutation({
    mutationFn: async (form: DriverApplicationForm) => {
      if (!uid) throw new Error('Sign in before completing an application.');
      if (application === null) {
        if (draftCreatedRef.current) {
          await saveDriverApplicationDraft(uid, form);
        } else {
          const catalog = catalogQuery.data;
          if (!catalog) {
            throw new Error('The current onboarding catalog is unavailable. Try again.');
          }
          const requirementKeys = catalog.documentRequirements
            .filter((requirement) => requirementAppliesToVehicle(requirement, form.vehicle.vehicleTypeId))
            .map((requirement) => requirement.key);
          await createDriverApplicationDraft(uid, form, requirementKeys, undefined, catalog);
          draftCreatedRef.current = true;
        }
      }
      else {
        draftCreatedRef.current = true;
        await saveDriverApplicationDraft(uid, form);
      }
    },
  });
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!uid || !application) throw new Error('Save your application before submitting.');
      if (!catalogQuery.data) throw new Error('The current onboarding catalog is unavailable. Try again.');
      const requirements = catalogQuery.data.documentRequirements
        .filter((requirement) => requirementAppliesToVehicle(requirement, application.vehicle.vehicleTypeId));
      const readiness = getSubmissionReadiness(application as DriverApplication, Date.now(), requirements);
      if (!readiness.ready) {
        throw new Error('Complete the highlighted application fields and documents before submitting.');
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
