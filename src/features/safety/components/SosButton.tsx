import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { colors } from '@/constants/theme';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

import { getSafetyStatus } from '../services/incident.service';
import { SosModal } from './SosModal';

export function SosButton({ tripId }: { readonly tripId: string | null }) {
  const uid = useSessionStore((state) => state.uid);
  const [modalVisible, setModalVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getSafetyStatus().then((result) => {
      if (mounted) setEnabled(result.sosEnabled);
    }).catch(() => {
      if (mounted) setEnabled(false);
    });
    return () => { mounted = false; };
  }, []);

  if (!enabled || tripId === null || uid === null) return null;

  return (
    <>
      <Button
        label="Emergency SOS"
        onPress={() => setModalVisible(true)}
        style={styles.button}
        testID="passenger-sos"
      />
      {modalVisible && (
        <SosModal
          visible={modalVisible}
          tripId={tripId}
          userId={uid}
          onClose={() => setModalVisible(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.danger },
});
