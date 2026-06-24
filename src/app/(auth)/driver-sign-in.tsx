import { SafeAreaView, StyleSheet } from 'react-native';

import { DriverSignInForm } from '@/features/auth/components/DriverSignInForm';

export default function DriverSignInScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <DriverSignInForm />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFE' },
});
