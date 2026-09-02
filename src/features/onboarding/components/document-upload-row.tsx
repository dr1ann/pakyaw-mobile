import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DocumentState } from '@pakyaw/shared/onboarding';
import { FieldHelpButton } from '@/features/onboarding/components/application-field';
import type { FieldGuidance } from '@/features/onboarding/field-guidance';

type DocumentUploadRowProps = {
  readonly documentType: string;
  readonly required?: boolean;
  readonly guidance: FieldGuidance;
  readonly state: DocumentState | 'missing';
  readonly uploading: boolean;
  readonly editable: boolean;
  readonly onChoose: () => void;
};

function stateLabel(state: DocumentState | 'missing'): string {
  switch (state) {
    case 'uploaded': return 'Uploaded';
    case 'under_review': return 'Under review';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected, replace document';
    case 'expired': return 'Expired, replace document';
    default: return 'Not uploaded';
  }
}

export function DocumentUploadRow({ documentType, guidance, required = true, state, uploading, editable, onChoose }: DocumentUploadRowProps) {
  const hasSuccess = state === 'uploaded' || state === 'approved';
  const actionLabel = state === 'rejected' || state === 'expired' ? 'Replace file' : 'Choose file';

  return (
    <View style={styles.row} testID={`document-upload-${documentType}`}>
      <View style={styles.content}>
        <View style={styles.labelRow}>
        <Text style={styles.label}>{guidance.label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
          <FieldHelpButton title={guidance.label} message={guidance.help ?? ''} />
        </View>
        <Text style={styles.state}>{stateLabel(state)}</Text>
        {hasSuccess ? <Text style={styles.success} accessibilityLabel={`${guidance.label} uploaded successfully`}>✓ {state === 'approved' ? 'Approved' : 'Uploaded'}</Text> : null}
      </View>
      <Pressable
        style={[styles.button, (!editable || uploading) && styles.disabled]}
        disabled={!editable || uploading}
        onPress={onChoose}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} for ${guidance.label}`}
      >
        {uploading ? <ActivityIndicator color="#0B2E6B" /> : <Text style={styles.buttonLabel}>{actionLabel}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E6EBF2', paddingBottom: 12 },
  content: { flex: 1, gap: 3 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  label: { color: '#364152', fontWeight: '700', flexShrink: 1 },
  required: { color: '#B42318' },
  state: { color: '#526173', fontSize: 13 },
  success: { color: '#16803C', fontSize: 13, fontWeight: '700' },
  button: { borderWidth: 1, borderColor: '#0B2E6B', paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 9 },
  buttonLabel: { color: '#0B2E6B', fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
