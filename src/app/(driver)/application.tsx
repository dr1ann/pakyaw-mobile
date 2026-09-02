import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { colors, spacing, typography } from '@/constants/theme';
import { OnboardingProgressHeader } from '@/features/onboarding/components/OnboardingProgressHeader';
import { StepAboutYou } from '@/features/onboarding/components/StepAboutYou';
import { StepVehicle } from '@/features/onboarding/components/StepVehicle';
import { StepRequirements } from '@/features/onboarding/components/StepRequirements';
import { StepReview } from '@/features/onboarding/components/StepReview';
import {
  ApprovedStatusScreen,
  NeedsCorrectionStatusScreen,
  RejectedStatusScreen,
  SubmittedStatusScreen,
} from '@/features/onboarding/components/OnboardingStatusScreens';
import { useDriverApplication } from '@/features/onboarding/hooks/useDriverApplication';
import {
  uploadDriverDocument,
  type DriverDocumentUploadRuleContext,
  type PickedDriverDocument,
} from '@/features/onboarding/services/document-upload.service';
import {
  getDriverOnboardingProfile,
  DriverAccountNotReadyError,
  type DriverOnboardingProfile,
} from '@/features/onboarding/services/driver-profile.service';
import { resolveAndStoreDriverSession } from '@/features/auth/services/driver-session.service';
import {
  adaptDynamicRequirementsToLegacyForm,
  adaptLegacyFormToRequirementMetadata,
} from '@/features/onboarding/services/compatibility-adapter';
import type { DriverApplicationForm, DriverApplicationSnapshot } from '@/features/onboarding/types';
import { composeStructuredLegalName, type DriverDocumentMetadata, type DriverOnboardingCatalog } from '@pakyaw/shared/onboarding';
import { auth } from '@/services/firebase/firebase';

const emptyForm: DriverApplicationForm = {
  personalDetails: {
    fullLegalName: '',
    verifiedMobile: '',
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

function formFromApplication(
  application: DriverApplicationSnapshot | null,
  profile: DriverOnboardingProfile | null | undefined,
): DriverApplicationForm {
  if (application) {
    const personal = (application as any).personal;
    const personalDetails = application.personalDetails || {};
    const fullLegalName = composeStructuredLegalName({
      firstName: personalDetails.firstName ?? personal?.firstName,
      middleName: personalDetails.middleName ?? personal?.middleName,
      lastName: personalDetails.lastName ?? personal?.lastName,
      suffix: personalDetails.suffix ?? personal?.suffix,
      fullLegalName: personalDetails.fullLegalName,
      name: profile?.name,
    });

    const rawFirstName = personalDetails.firstName ?? personal?.firstName;
    const rawMiddleName = personalDetails.middleName ?? personal?.middleName;
    const rawLastName = personalDetails.lastName ?? personal?.lastName;
    const rawSuffix = personalDetails.suffix ?? personal?.suffix;

    const nextPersonalDetails: DriverApplicationForm['personalDetails'] = {
      fullLegalName,
      verifiedMobile: personalDetails.verifiedMobile || auth.currentUser?.phoneNumber || profile?.mobile || '',
      barangayAddress: personalDetails.barangayAddress ?? '',
      emergencyContact: {
        name: personalDetails.emergencyContact?.name ?? '',
        mobile: personalDetails.emergencyContact?.mobile ?? '',
      },
      ...(typeof rawFirstName === 'string' && rawFirstName.trim().length > 0 ? { firstName: rawFirstName.trim() } : {}),
      ...(typeof rawMiddleName === 'string' && rawMiddleName.trim().length > 0 ? { middleName: rawMiddleName.trim() } : {}),
      ...(typeof rawLastName === 'string' && rawLastName.trim().length > 0 ? { lastName: rawLastName.trim() } : {}),
      ...(typeof rawSuffix === 'string' && rawSuffix.trim().length > 0 ? { suffix: rawSuffix.trim() } : {}),
    };

    return {
      ...(personal ? { personal } : {}),
      personalDetails: nextPersonalDetails,
      vehicle: {
        ...application.vehicle,
        isDriverOwner: typeof application.vehicle.isDriverOwner === 'boolean' ? application.vehicle.isDriverOwner : true,
      },
      license: application.license,
      franchise: application.franchise,
    };
  }

  return {
    ...emptyForm,
    personalDetails: {
      ...emptyForm.personalDetails,
      fullLegalName: profile?.name ?? '',
      verifiedMobile: auth.currentUser?.phoneNumber ?? profile?.mobile ?? '',
    },
  };
}

type WizardProps = {
  readonly uid: string | null;
  readonly application: DriverApplicationSnapshot | null;
  readonly profile: DriverOnboardingProfile | null | undefined;
  readonly catalog: DriverOnboardingCatalog | null;
  readonly isLoadingCatalog: boolean;
  readonly saveMutation: ReturnType<typeof useDriverApplication>['saveMutation'];
  readonly submitMutation: ReturnType<typeof useDriverApplication>['submitMutation'];
  readonly refetchCatalog?: () => Promise<unknown>;
};

function DriverApplicationWizard({
  uid,
  application,
  profile,
  catalog,
  isLoadingCatalog,
  saveMutation,
  submitMutation,
  refetchCatalog,
}: WizardProps) {
  const initialForm = useMemo(() => formFromApplication(application, profile), [application, profile]);
  const initialMetadata = useMemo(
    () => adaptLegacyFormToRequirementMetadata(initialForm, application?.documentMetadata ?? {}),
    [initialForm, application?.documentMetadata],
  );

  const [form, setForm] = useState<DriverApplicationForm>(initialForm);
  const [metadataState, setMetadataState] = useState<Record<string, DriverDocumentMetadata>>(initialMetadata);

  const initialStep = useMemo(() => {
    if (application?.status === 'draft') {
      if (!initialForm.personalDetails.barangayAddress) return 2;
      if (!initialForm.vehicle.vehicleTypeId) return 3;
      return 4;
    }
    return 2;
  }, [application?.status, initialForm.personalDetails.barangayAddress, initialForm.vehicle.vehicleTypeId]);

  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isTransitioningStep, setIsTransitioningStep] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAdaptedFormRef = useRef<DriverApplicationForm>(initialForm);
  const initialDraftCreatedRef = useRef(false);
  const initialDraftCreatingRef = useRef(false);

  const selectedVehicleType = useMemo(() => {
    return catalog?.vehicleTypes.find((vt) => vt.id === form.vehicle.vehicleTypeId);
  }, [catalog, form.vehicle.vehicleTypeId]);

  // Debounced draft persistence (750ms)
  const triggerDebouncedSave = (adapted: DriverApplicationForm) => {
    latestAdaptedFormRef.current = adapted;
    if (!uid || application?.status !== 'draft') return;
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveMutation
        .mutateAsync(adapted)
        .then(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
        })
        .catch((err) => {
          console.warn('[Driver Application] Autosave warning:', err);
          setSaveStatus('idle');
        });
    }, 750);
  };

  // Flush pending draft on AppState background & refresh catalog on foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
          if (uid && application?.status === 'draft') {
            saveMutation.mutate(latestAdaptedFormRef.current);
          }
        }
      } else if (nextAppState === 'active') {
        refetchCatalog?.();
      }
    });
    return () => {
      sub.remove();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [uid, application?.status, saveMutation, refetchCatalog]);

  // Refresh catalog when entering Vehicle (Step 3) or Requirements (Step 4)
  useEffect(() => {
    if (currentStep === 3 || currentStep === 4) {
      refetchCatalog?.();
    }
  }, [currentStep, refetchCatalog]);

  // Handle Field Updates
  function handleFieldChange(path: string, value: string | boolean) {
    setForm((previous) => {
      const next = structuredClone(previous) as DriverApplicationForm & Record<string, unknown>;
      const keys = path.split('.');
      let cursor: Record<string, unknown> = next;
      for (const entry of keys.slice(0, -1)) {
        cursor = cursor[entry] as Record<string, unknown>;
      }
      cursor[keys[keys.length - 1]] = value;

      const adapted = adaptDynamicRequirementsToLegacyForm(
        next,
        metadataState,
        selectedVehicleType?.type,
      );

      triggerDebouncedSave(adapted);
      return adapted;
    });
  }

  // Handle Metadata Updates (Step 4)
  function handleMetadataChange(requirementKey: string, patch: Partial<DriverDocumentMetadata>) {
    setMetadataState((prev) => {
      const updated = {
        ...prev,
        [requirementKey]: {
          ...(prev[requirementKey] || {}),
          ...patch,
        },
      };

      // Synchronize with compatibility fields
      setForm((prevForm) => {
        const adapted = adaptDynamicRequirementsToLegacyForm(
          prevForm,
          updated,
          selectedVehicleType?.type,
        );
        triggerDebouncedSave(adapted);
        return adapted;
      });

      return updated;
    });
  }

  // Handle Document Upload
  async function handleUploadDocument(requirementKey: string, asset: PickedDriverDocument) {
    if (!uid) return;
    setUploadingKey(requirementKey);
    setUploadProgress(0);
    try {
      const currentMeta = metadataState[requirementKey] || {};
      await uploadDriverDocument(
        uid,
        requirementKey,
        asset,
        currentMeta,
        (ratio) => setUploadProgress(ratio),
        application?.status,
        {
          catalog,
          vehicleTypeId: form.vehicle.vehicleTypeId,
        } satisfies DriverDocumentUploadRuleContext,
      );

      // Merge into adapted form and save
      const adapted = adaptDynamicRequirementsToLegacyForm(
        form,
        metadataState,
        selectedVehicleType?.type,
      );
      if (application?.status === 'draft') {
        await saveMutation.mutateAsync(adapted);
      }
    } catch (err: any) {
      console.error('[Driver Application] Document upload failed:', err);
      throw err;
    } finally {
      setUploadingKey(null);
      setUploadProgress(0);
    }
  }

  // Navigation between steps
  async function goToStep(step: number) {
    if (step < 2 || step > 5) return;
    setSubmitError(null);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (uid && application === null && step === 4 && !initialDraftCreatedRef.current) {
      if (initialDraftCreatingRef.current) return;
      initialDraftCreatingRef.current = true;
      setIsTransitioningStep(true);
      const adapted = adaptDynamicRequirementsToLegacyForm(
        form,
        metadataState,
        selectedVehicleType?.type,
      );
      setSaveStatus('saving');
      try {
        await saveMutation.mutateAsync(adapted);
        initialDraftCreatedRef.current = true;
        setSaveStatus('saved');
        setCurrentStep(step);
      } catch (error) {
        setSaveStatus('idle');
        if (error instanceof DriverAccountNotReadyError && uid) {
          try {
            await resolveAndStoreDriverSession(uid);
          } catch {
            // ignore
          }
          if (error.code === 'missing') {
            router.replace('/account-setup-recovery');
            return;
          }
          if (error.code === 'role_mismatch' || error.code === 'inactive') {
            router.replace('/driver-account-state');
            return;
          }
        }
        setSubmitError(error instanceof Error ? error.message : 'We couldn’t save your application. Try again.');
        return;
      } finally {
        initialDraftCreatingRef.current = false;
        setIsTransitioningStep(false);
      }
      return;
    }

    // Autosave on step change
    if (uid && application?.status === 'draft') {
      const adapted = adaptDynamicRequirementsToLegacyForm(
        form,
        metadataState,
        selectedVehicleType?.type,
      );
      saveMutation.mutate(adapted);
    }
    setCurrentStep(step);
  }

  // Handle Application Submit
  async function handleSubmitApplication() {
    setSubmitError(null);
    try {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // 1. Ensure latest adapted form is saved
      const adapted = adaptDynamicRequirementsToLegacyForm(
        form,
        metadataState,
        selectedVehicleType?.type,
      );
      await saveMutation.mutateAsync(adapted);

      // 2. Submit
      await submitMutation.mutateAsync();
      setCorrectionMode(false);
    } catch (err: any) {
      console.error('[Driver Application] Submit failed:', err);
      setSubmitError(err?.message || 'We couldn’t submit your application. Check the highlighted fields.');
    }
  }

  // Lifecycle States
  const status = application?.status;

  // 1. Approved
  if (status === 'approved') {
    return (
      <ApprovedStatusScreen
        onAction={() => router.replace('./')}
      />
    );
  }

  // 2. Rejected
  if (status === 'rejected' && application) {
    return (
      <RejectedStatusScreen
        reason={application.rejectionReason}
        onContactSupport={() => router.push('./support')}
      />
    );
  }

  // 3. Submitted / Under Review
  if ((status === 'submitted' || (status as string) === 'under_review') && !correctionMode) {
    return (
      <SubmittedStatusScreen
        onAction={() => setCurrentStep(5)}
        onContactSupport={() => router.push('./support')}
      />
    );
  }

  // 4. Needs Correction (and not currently in correction editing mode)
  if (status === 'needs_correction' && !correctionMode && application) {
    return (
      <NeedsCorrectionStatusScreen
        reason={application.correctionReason}
        onAction={() => {
          setCorrectionMode(true);
          // Jump directly to requirements step if document flagged
          if (application.correctionDocumentTypes && application.correctionDocumentTypes.length > 0) {
            setCurrentStep(4);
          } else {
            setCurrentStep(2);
          }
        }}
      />
    );
  }

  // 5. Active Editing Wizard (Draft or Correction Mode)
  const stepTitles: Record<number, string> = {
    2: 'About You',
    3: 'Vehicle',
    4: 'Requirements',
    5: 'Review',
  };

  const canGoBack = currentStep > 2 || (typeof router.canGoBack === 'function' && router.canGoBack());

  const handleHeaderBack = () => {
    if (correctionMode) {
      setCorrectionMode(false);
      return;
    }
    if (currentStep > 2) {
      goToStep(currentStep - 1);
    } else if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View style={styles.screen}>
      <OnboardingProgressHeader
        currentStep={currentStep}
        totalSteps={5}
        stepTitle={stepTitles[currentStep] || 'Application'}
        onBack={handleHeaderBack}
        canGoBack={canGoBack}
        saveStatus={saveStatus}
      />

      {currentStep === 2 ? (
        <StepAboutYou
          form={form}
          onChange={handleFieldChange}
          onNext={() => goToStep(3)}
          isSaving={isTransitioningStep || (saveStatus === 'saving' && currentStep === 2)}
          error={currentStep === 2 ? submitError : null}
        />
      ) : null}

      {currentStep === 3 ? (
        <StepVehicle
          form={form}
          catalog={catalog}
          isLoadingCatalog={isLoadingCatalog}
          onChange={handleFieldChange}
          onNext={() => goToStep(4)}
          isSaving={isTransitioningStep || (saveStatus === 'saving' && currentStep === 3)}
          error={currentStep === 3 ? submitError : null}
        />
      ) : null}

      {currentStep === 4 ? (
        <StepRequirements
          catalog={catalog}
          isLoadingCatalog={isLoadingCatalog}
          selectedVehicleTypeId={form.vehicle.vehicleTypeId || ''}
          documents={application?.documents ?? {}}
          documentMetadata={metadataState}
          onMetadataChange={handleMetadataChange}
          onUploadDocument={handleUploadDocument}
          uploadingKey={uploadingKey}
          uploadProgress={uploadProgress}
          correctionDocumentTypes={application?.correctionDocumentTypes}
          correctionReason={application?.correctionReason}
          applicationStatus={application?.status}
          onNext={() => goToStep(5)}
        />
      ) : null}

      {currentStep === 5 ? (
        <StepReview
          form={form}
          catalog={catalog}
          documents={application?.documents ?? {}}
          documentMetadata={metadataState}
          onEditStep={goToStep}
          onSubmit={handleSubmitApplication}
          isSubmitting={submitMutation.isPending}
          submitError={submitError}
        />
      ) : null}
    </View>
  );
}

export default function DriverApplicationScreen() {
  const {
    uid,
    application,
    isApplicationLoaded,
    saveMutation,
    submitMutation,
    catalog,
    catalogQuery,
  } = useDriverApplication();

  const profileNeeded = isApplicationLoaded && application === null && Boolean(uid);
  const profileQuery = useQuery<DriverOnboardingProfile | null>({
    queryKey: ['driverOnboardingProfile', uid],
    queryFn: () => getDriverOnboardingProfile(uid!),
    enabled: profileNeeded,
    staleTime: 5 * 60_000,
  });

  const profile = application ? undefined : profileQuery.data;

  // Loading State
  if (!isApplicationLoaded || (profileNeeded && profileQuery.isLoading) || catalogQuery.isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.blue.primary} size="large" />
        <Text style={styles.loadingText}>Loading your driver application</Text>
      </View>
    );
  }

  return (
    <DriverApplicationWizard
      key={uid ?? 'driver-wizard'}
      uid={uid}
      application={application}
      profile={profile}
      catalog={catalog}
      isLoadingCatalog={catalogQuery.isLoading}
      saveMutation={saveMutation}
      submitMutation={submitMutation}
      refetchCatalog={() => catalogQuery.refetch()}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface.bgLight,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.bgLight,
    padding: spacing[4],
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
  },
});
