import { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import * as Location from 'expo-location';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { colors } from '@/constants/theme';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

import { createTripIncident, getSafetyStatus } from '../services/incident.service';

export function SosButton({ tripId }: { readonly tripId: string | null }) {
  const uid = useSessionStore((state) => state.uid);
  const [pending, setPending] = useState(false);
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
  const incidentTripId = tripId;
  const triggeredBy = uid;

  async function trigger(): Promise<void> {
    try {
      setPending(true);
      const currentPermission = await Location.getForegroundPermissionsAsync();
      const permission = currentPermission.status === 'granted'
        ? currentPermission
        : await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Location permission is required to send SOS.');
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await createTripIncident(incidentTripId, triggeredBy, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      Alert.alert('SOS sent', 'Pakyaw operations has been notified.');
    } catch (error) {
      Alert.alert('Unable to send SOS', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }

  return <Button label="Emergency SOS" onPress={() => void trigger()} loading={pending} style={styles.button} testID="passenger-sos" />;
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.danger },
});
