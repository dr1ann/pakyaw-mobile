import { SafeAreaView, StyleSheet } from 'react-native';

import { SignUpForm } from '@/features/auth/components/SignUpForm';

export default function SignUpScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <SignUpForm />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EAF1FB' },
});
