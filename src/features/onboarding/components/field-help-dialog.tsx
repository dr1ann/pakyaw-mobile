import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type FieldHelpDialogProps = {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly onClose: () => void;
};

export function FieldHelpDialog({ visible, title, message, onClose }: FieldHelpDialogProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close help" />
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel={`Close help for ${title}`}>
            <Text style={styles.closeLabel}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(14, 23, 38, 0.45)' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#0E1726' },
  message: { color: '#364152', fontSize: 15, lineHeight: 21 },
  closeButton: { alignSelf: 'flex-end', minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 12 },
  closeLabel: { color: '#0B2E6B', fontWeight: '800' },
});
