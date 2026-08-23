import { SafeAreaView, StyleSheet } from 'react-native';

import { PhoneRegistrationForm } from '@/features/auth/components/PhoneRegistrationForm';

export default function SignUpScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <PhoneRegistrationForm />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EAF1FB' },
});
