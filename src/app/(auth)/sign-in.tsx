import { SafeAreaView, StyleSheet } from 'react-native';

import { SignInForm } from '@/features/auth/components/SignInForm';

export default function SignInScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <SignInForm />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EAF1FB' },
});
