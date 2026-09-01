import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { REQUIRED_DOCUMENT_TYPES, type RequiredDocumentType, type SubmissionField } from '@pakyaw/shared/onboarding';
import { OnboardingTextField, FormField } from '@/features/onboarding/components/application-field';
import { DocumentUploadRow } from '@/features/onboarding/components/document-upload-row';
import { ExpiryDateField } from '@/features/onboarding/components/expiry-date-field';
import { onboardingFieldGuidance, submissionIssueMessage } from '@/features/onboarding/field-guidance';
import { sanitizeDescription, sanitizeIdentifier, sanitizeMobileInput, sanitizeNamePart } from '@/features/onboarding/input-validation';
import { useDriverApplication } from '@/features/onboarding/hooks/useDriverApplication';
import { markDocumentUploaded } from '@/features/onboarding/services/driver-application.service';
import { uploadDriverDocument } from '@/features/onboarding/services/document-upload.service';
import { getDriverOnboardingProfile, type DriverOnboardingProfile } from '@/features/onboarding/services/driver-profile.service';
import type { DriverApplicationForm } from '@/features/onboarding/types';
import { auth } from '@/services/firebase/firebase';

const emptyForm: DriverApplicationForm = {
  personalDetails: {
    fullLegalName: '', verifiedMobile: '', barangayAddress: '', emergencyContact: { name: '', mobile: '' },
  },
  vehicle: {
    plateNumber: '', unitBodyNumber: '', description: '', ownerOperatorInfo: '', isDriverOwner: false, orcrNumber: '', orcrExpiry: '',
  },
  license: { number: '', expiry: '' },
  franchise: { documentType: '', documentNumber: '', expiry: '' },
};

function formFromApplication(
  application: ReturnType<typeof useDriverApplication>['application'],
  profile: DriverOnboardingProfile | null | undefined,
): DriverApplicationForm {
  if (application) {
    return {
      personalDetails: application.personalDetails,
      vehicle: application.vehicle,
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

function sourceKey(
  application: ReturnType<typeof useDriverApplication>['application'],
  profile: DriverOnboardingProfile | null | undefined,
): string {
  if (application) return `application:${application.id}`;
  return `profile:${profile?.name ?? ''}:${auth.currentUser?.phoneNumber ?? profile?.mobile ?? ''}`;
}

export default function DriverApplicationScreen() {
  const { uid, application, readiness, error, isApplicationLoaded, saveMutation, submitMutation } = useDriverApplication();
  const profileNeeded = isApplicationLoaded && application === null && Boolean(uid);
  const profileQuery = useQuery<DriverOnboardingProfile | null>({
    queryKey: ['driverOnboardingProfile', uid],
    queryFn: () => getDriverOnboardingProfile(uid!),
    enabled: profileNeeded,
    staleTime: 5 * 60_000,
  });
  const profile = application ? undefined : profileQuery.data;
  const preparingForm = !isApplicationLoaded || (profileNeeded && profileQuery.isLoading);
  const profileUnavailable = profileNeeded && !profileQuery.isLoading && (profileQuery.error || profileQuery.data === null);
  const key = sourceKey(application, profile);
  const [formState, setFormState] = useState(() => ({ key: '', form: emptyForm }));
  const [uploading, setUploading] = useState<RequiredDocumentType | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const form = formState.key === key ? formState.form : formFromApplication(application, profile);
  const isReadOnly = application?.status === 'submitted' || application?.status === 'approved'
    || application?.status === 'rejected' || application?.status === 'suspended' || application?.status === 'expired';
  const issuesByField = useMemo(() => {
    const issues = readiness?.issues ?? [];
    return (field: SubmissionField): readonly string[] => issues
      .filter((issue) => issue.field === field)
      .map((issue) => submissionIssueMessage(issue.code));
  }, [readiness]);

  function update(path: string, value: string | boolean) {
    setFormState((previous) => {
      const source = previous.key === key ? previous.form : form;
      const next = structuredClone(source) as DriverApplicationForm & Record<string, unknown>;
      const keys = path.split('.');
      let cursor: Record<string, unknown> = next;
      for (const entry of keys.slice(0, -1)) cursor = cursor[entry] as Record<string, unknown>;
      cursor[keys[keys.length - 1]] = value;
      return { key, form: next };
    });
  }

  async function chooseAndUpload(documentType: RequiredDocumentType) {
    if (!uid) return;
    if (application === null) {
      setUploadMessage('Save your application details before uploading documents.');
      return;
    }

    setUploadMessage(null);
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'], multiple: false, copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      setUploading(documentType);
      await uploadDriverDocument(uid, documentType, {
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? null,
        mimeType: asset.mimeType ?? null,
      });
      await markDocumentUploaded(uid, documentType);
      setUploadMessage('Document uploaded privately. The check mark appears once the saved application state updates.');
    } catch {
      setUploadMessage('We could not upload that document. Confirm it is an image or PDF under the size limit, then try again.');
    } finally {
      setUploading(null);
    }
  }

  if (!uid) {
    return <ApplicationMessage title="Sign in required" message="Sign in with your verified mobile number before completing a driver application." />;
  }
  if (preparingForm) {
    return <ApplicationMessage title="Loading application" message="We are loading your verified profile and driver application." loading />;
  }
  if (profileUnavailable) {
    return (
      <ApplicationMessage
        title="Profile unavailable"
        message="We could not load your verified profile. Please try again before starting an application."
        actionLabel="Retry"
        onAction={() => profileQuery.refetch()}
      />
    );
  }

  const formError = saveMutation.error ?? submitMutation.error ?? error;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Driver application</Text>
      <Text style={styles.subtitle}>Complete every required field and upload the three private documents. Pakyaw operations handles approval.</Text>
      <Text style={styles.requiredNote}><Text style={styles.required}>*</Text> Required field</Text>
      {application ? <Status status={application.status} message={application.correctionReason ?? application.rejectionReason} /> : null}
      {formError ? <Text style={styles.error} selectable>{submitMutation.error ? 'We could not submit your application. Complete the highlighted fields and try again.' : 'We could not save your application. Please try again.'}</Text> : null}

      <Section title="Personal details">
        <OnboardingTextField
          label="Full legal name"
          required
          value={form.personalDetails.fullLegalName}
          onChangeText={(value) => update('personalDetails.fullLegalName', sanitizeNamePart(value, 160))}
          placeholder="Juan Santos Dela Cruz"
          editable={!isReadOnly}
          autoCapitalize="words"
          errors={issuesByField('personalDetails.fullLegalName')}
        />
        <OnboardingTextField
          label={onboardingFieldGuidance.mobile.label}
          required
          help={onboardingFieldGuidance.mobile.help}
          value={form.personalDetails.verifiedMobile}
          placeholder={onboardingFieldGuidance.mobile.placeholder}
          editable={false}
          keyboardType="phone-pad"
          errors={issuesByField('personalDetails.verifiedMobile')}
        />
        <OnboardingTextField
          label={onboardingFieldGuidance.barangayAddress.label}
          required
          help={onboardingFieldGuidance.barangayAddress.help}
          value={form.personalDetails.barangayAddress}
          onChangeText={(value) => update('personalDetails.barangayAddress', sanitizeDescription(value))}
          placeholder={onboardingFieldGuidance.barangayAddress.placeholder}
          editable={!isReadOnly}
          errors={issuesByField('personalDetails.barangayAddress')}
        />
        <OnboardingTextField
          label="Emergency contact name"
          required
          value={form.personalDetails.emergencyContact.name}
          onChangeText={(value) => update('personalDetails.emergencyContact.name', sanitizeNamePart(value))}
          placeholder="Maria Dela Cruz"
          autoCapitalize="words"
          editable={!isReadOnly}
          errors={issuesByField('personalDetails.emergencyContact.name')}
        />
        <OnboardingTextField
          label={onboardingFieldGuidance.emergencyContactMobile.label}
          required
          help={onboardingFieldGuidance.emergencyContactMobile.help}
          value={form.personalDetails.emergencyContact.mobile}
          onChangeText={(value) => update('personalDetails.emergencyContact.mobile', sanitizeMobileInput(value))}
          placeholder={onboardingFieldGuidance.emergencyContactMobile.placeholder}
          editable={!isReadOnly}
          keyboardType="phone-pad"
          errors={issuesByField('personalDetails.emergencyContact.mobile')}
        />
      </Section>

      <Section title="Vehicle and ownership">
        <OnboardingTextField label={onboardingFieldGuidance.plateNumber.label} required help={onboardingFieldGuidance.plateNumber.help} value={form.vehicle.plateNumber} onChangeText={(value) => update('vehicle.plateNumber', sanitizeIdentifier(value, 12))} placeholder={onboardingFieldGuidance.plateNumber.placeholder} editable={!isReadOnly} autoCapitalize="characters" errors={issuesByField('vehicle.plateNumber')} />
        <OnboardingTextField label={onboardingFieldGuidance.unitBodyNumber.label} required help={onboardingFieldGuidance.unitBodyNumber.help} value={form.vehicle.unitBodyNumber} onChangeText={(value) => update('vehicle.unitBodyNumber', sanitizeIdentifier(value, 30))} placeholder={onboardingFieldGuidance.unitBodyNumber.placeholder} editable={!isReadOnly} autoCapitalize="characters" errors={issuesByField('vehicle.unitBodyNumber')} />
        <OnboardingTextField label={onboardingFieldGuidance.vehicleDescription.label} required help={onboardingFieldGuidance.vehicleDescription.help} value={form.vehicle.description} onChangeText={(value) => update('vehicle.description', sanitizeDescription(value))} placeholder={onboardingFieldGuidance.vehicleDescription.placeholder} editable={!isReadOnly} errors={issuesByField('vehicle.description')} />
        <OnboardingTextField label={onboardingFieldGuidance.ownerOperatorInfo.label} required help={onboardingFieldGuidance.ownerOperatorInfo.help} value={form.vehicle.ownerOperatorInfo} onChangeText={(value) => update('vehicle.ownerOperatorInfo', sanitizeDescription(value))} placeholder={onboardingFieldGuidance.ownerOperatorInfo.placeholder} editable={!isReadOnly} autoCapitalize="words" errors={issuesByField('vehicle.ownerOperatorInfo')} />
        <FormField label={onboardingFieldGuidance.ownerSwitch.label} required help={onboardingFieldGuidance.ownerSwitch.help} errors={issuesByField('vehicle.isDriverOwner')}>
          <View style={styles.switchRow}>
            <Text style={styles.switchHint}>Turn on only when the registered owner is you.</Text>
            <Switch value={form.vehicle.isDriverOwner} onValueChange={(value) => update('vehicle.isDriverOwner', value)} disabled={isReadOnly} accessibilityLabel={onboardingFieldGuidance.ownerSwitch.label} />
          </View>
        </FormField>
        <OnboardingTextField label={onboardingFieldGuidance.orcrNumber.label} required help={onboardingFieldGuidance.orcrNumber.help} value={form.vehicle.orcrNumber} onChangeText={(value) => update('vehicle.orcrNumber', sanitizeIdentifier(value, 40))} placeholder={onboardingFieldGuidance.orcrNumber.placeholder} editable={!isReadOnly} autoCapitalize="characters" errors={issuesByField('vehicle.orcrNumber')} />
        <ExpiryDateField label={onboardingFieldGuidance.orcrExpiry.label} value={form.vehicle.orcrExpiry} onChange={(value) => update('vehicle.orcrExpiry', value)} editable={!isReadOnly} help={onboardingFieldGuidance.orcrExpiry.help} errors={issuesByField('vehicle.orcrExpiry')} />
      </Section>

      <Section title="Driver's license and franchise">
        <OnboardingTextField label={onboardingFieldGuidance.licenseNumber.label} required help={onboardingFieldGuidance.licenseNumber.help} value={form.license.number} onChangeText={(value) => update('license.number', sanitizeIdentifier(value, 40))} placeholder={onboardingFieldGuidance.licenseNumber.placeholder} editable={!isReadOnly} autoCapitalize="characters" errors={issuesByField('license.number')} />
        <ExpiryDateField label={onboardingFieldGuidance.licenseExpiry.label} value={form.license.expiry} onChange={(value) => update('license.expiry', value)} editable={!isReadOnly} help={onboardingFieldGuidance.licenseExpiry.help} errors={issuesByField('license.expiry')} />
        <OnboardingTextField label={onboardingFieldGuidance.franchiseType.label} required help={onboardingFieldGuidance.franchiseType.help} value={form.franchise.documentType} onChangeText={(value) => update('franchise.documentType', sanitizeIdentifier(value, 20))} placeholder={onboardingFieldGuidance.franchiseType.placeholder} editable={!isReadOnly} autoCapitalize="characters" errors={issuesByField('franchise.documentType')} />
        <OnboardingTextField label={onboardingFieldGuidance.franchiseNumber.label} required help={onboardingFieldGuidance.franchiseNumber.help} value={form.franchise.documentNumber} onChangeText={(value) => update('franchise.documentNumber', sanitizeIdentifier(value, 40))} placeholder={onboardingFieldGuidance.franchiseNumber.placeholder} editable={!isReadOnly} autoCapitalize="characters" errors={issuesByField('franchise.documentNumber')} />
        <ExpiryDateField label={onboardingFieldGuidance.franchiseExpiry.label} value={form.franchise.expiry} onChange={(value) => update('franchise.expiry', value)} editable={!isReadOnly} help={onboardingFieldGuidance.franchiseExpiry.help} errors={issuesByField('franchise.expiry')} />
      </Section>

      <Section title="Private documents">
        <Text style={styles.documentIntro}>Upload clear images or PDFs. These files are private and are reviewed only by authorized Pakyaw staff.</Text>
        {REQUIRED_DOCUMENT_TYPES.map((documentType) => (
          <DocumentUploadRow
            key={documentType}
            documentType={documentType}
            guidance={documentGuidance(documentType)}
            state={application?.documents[documentType] ?? 'missing'}
            uploading={uploading === documentType}
            editable={!isReadOnly}
            onChoose={() => chooseAndUpload(documentType)}
          />
        ))}
        {uploadMessage ? <Text style={styles.help} selectable>{uploadMessage}</Text> : null}
      </Section>

      {readiness && !readiness.ready ? <IssueSummary fields={readiness.issues.map((issue) => submissionIssueMessage(issue.code))} /> : null}
      {!isReadOnly ? (
        <>
          <Pressable style={[styles.primaryButton, saveMutation.isPending && styles.disabled]} disabled={saveMutation.isPending} onPress={() => saveMutation.mutate(form)} accessibilityRole="button">
            <Text style={styles.primaryLabel}>{saveMutation.isPending ? 'Saving…' : application ? 'Save changes' : 'Save draft'}</Text>
          </Pressable>
          <Pressable style={[styles.submitButton, (!application || readiness?.ready !== true || submitMutation.isPending) && styles.disabled]} disabled={!application || readiness?.ready !== true || submitMutation.isPending} onPress={() => submitMutation.mutate()} accessibilityRole="button">
            <Text style={styles.primaryLabel}>{submitMutation.isPending ? 'Submitting…' : 'Submit for review'}</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

function documentGuidance(documentType: RequiredDocumentType) {
  switch (documentType) {
    case 'drivers_license': return onboardingFieldGuidance.driversLicenseDocument;
    case 'orcr': return onboardingFieldGuidance.orcrDocument;
    case 'franchise': return onboardingFieldGuidance.franchiseDocument;
  }
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Status({ status, message }: { readonly status: string; readonly message?: string }) {
  return <View style={styles.status}><Text style={styles.statusText}>{status.replaceAll('_', ' ').toUpperCase()}</Text>{message ? <Text style={styles.help} selectable>{message}</Text> : null}</View>;
}

function IssueSummary({ fields }: { readonly fields: readonly string[] }) {
  return <View style={styles.issueBox}><Text style={styles.issueTitle}>Complete these items before submitting</Text>{fields.map((message, index) => <Text key={`${message}-${index}`} style={styles.issue}>• {message}</Text>)}</View>;
}

function ApplicationMessage({ title, message, loading = false, actionLabel, onAction }: { readonly title: string; readonly message: string; readonly loading?: boolean; readonly actionLabel?: string; readonly onAction?: () => void }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.messagePage} contentInsetAdjustmentBehavior="automatic">
      {loading ? <ActivityIndicator color="#0B2E6B" /> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{message}</Text>
      {actionLabel && onAction ? <Pressable style={styles.primaryButton} onPress={onAction} accessibilityRole="button"><Text style={styles.primaryLabel}>{actionLabel}</Text></Pressable> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 20, gap: 14 },
  messagePage: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 14 },
  title: { fontSize: 26, fontWeight: '800', color: '#0E1726' },
  subtitle: { color: '#526173', lineHeight: 20 },
  requiredNote: { color: '#526173', fontSize: 12 },
  required: { color: '#B42318', fontWeight: '800' },
  section: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, gap: 12 },
  sectionTitle: { fontWeight: '800', fontSize: 17, color: '#0E1726' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  switchHint: { color: '#526173', flex: 1, lineHeight: 18 },
  documentIntro: { color: '#526173', lineHeight: 19 },
  primaryButton: { minHeight: 50, borderRadius: 25, backgroundColor: '#0B2E6B', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  submitButton: { minHeight: 50, borderRadius: 25, backgroundColor: '#208AEF', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  primaryLabel: { color: '#FFFFFF', fontWeight: '800' },
  disabled: { opacity: 0.45 },
  error: { color: '#B42318', backgroundColor: '#FEE4E2', padding: 10, borderRadius: 8, lineHeight: 19 },
  status: { backgroundColor: '#E8F1FE', borderRadius: 9, padding: 12, gap: 5 },
  statusText: { color: '#0B2E6B', fontWeight: '800' },
  help: { color: '#526173', lineHeight: 18 },
  issueBox: { backgroundColor: '#FFF4E5', padding: 12, borderRadius: 10, gap: 5 },
  issueTitle: { color: '#7A3E00', fontWeight: '800' },
  issue: { color: '#92400E', fontSize: 13, lineHeight: 18 },
});
