import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getSubmissionReadiness, type DriverApplication } from '@pakyaw/shared/onboarding';
import { useSession } from '@pakyaw/shared/features/auth/hooks/useSession';
import {
  createDriverApplicationDraft,
  saveDriverApplicationDraft,
  submitDriverApplication,
  subscribeDriverApplication,
} from '@/features/onboarding/services/driver-application.service';
import type { DriverApplicationForm, DriverApplicationSnapshot } from '@/features/onboarding/types';

export function useDriverApplication() {
  const { uid } = useSession();
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState<{
    readonly uid: string | null;
    readonly application: DriverApplicationSnapshot | null;
    readonly error: Error | null;
    readonly loaded: boolean;
  }>({ uid: null, application: null, error: null, loaded: false });
  const [readinessNow] = useState(() => Date.now());

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
      if (application === null) await createDriverApplicationDraft(uid, form);
      else await saveDriverApplicationDraft(uid, form);
    },
  });
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!uid || !application) throw new Error('Save your application before submitting.');
      const readiness = getSubmissionReadiness(application as DriverApplication, Date.now());
      if (!readiness.ready) {
        throw new Error('Complete the highlighted application fields and documents before submitting.');
      }
      await submitDriverApplication(uid);
    },
  });

  const readiness = useMemo(
    () => application ? getSubmissionReadiness(application as DriverApplication, readinessNow) : null,
    [application, readinessNow],
  );

  return { uid, application, readiness, error, isApplicationLoaded, saveMutation, submitMutation };
}
