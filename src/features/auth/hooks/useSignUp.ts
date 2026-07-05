import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import {
  createPassenger,
  createUserDoc,
} from '@pakyaw/shared/features/auth/services/auth.service';
import type { RiderType } from '@pakyaw/shared/features/auth/types';
import type { SignUpProfile } from '@pakyaw/shared/features/auth/validation/schemas';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

export type SignUpStep = 'credentials' | 'profile' | 'riderType' | 'review';

interface SignUpState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  riderType: RiderType;
  uid: string | null;
}

const INITIAL_STATE: SignUpState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  riderType: 'regular',
  uid: null,
};

export function useSignUp() {
  const setSession = useSessionStore((s) => s.setSession);
  const [step, setStep] = useState<SignUpStep>('credentials');
  const [formData, setFormData] = useState<SignUpState>(INITIAL_STATE);

  // Step 0 — create email/password account
  const credentialsMutation = useMutation({
    mutationFn: async (args: { email: string; password: string }) => {
      const uid = await createPassenger(args.email, args.password);
      return uid;
    },
    onSuccess: (uid, variables) => {
      setFormData((prev) => ({
        ...prev,
        email: variables.email,
        password: variables.password,
        uid,
      }));
      setStep('profile');
    },
  });

  // Step 1 — save profile info (no network call; advances to riderType)
  function saveProfile(values: SignUpProfile) {
    setFormData((prev) => ({ ...prev, ...values }));
    setStep('riderType');
  }

  // Step 2 — choose rider type (no mutation needed — just update local state)
  function selectRiderType(riderType: RiderType) {
    setFormData((prev) => ({ ...prev, riderType }));
    setStep('review');
  }

  // Step 3 — create user document and sign session in
  const createProfileMutation = useMutation({
    mutationFn: async () => {
      const { uid, email, firstName, lastName, phone, riderType } = formData;
      if (!uid) throw new Error('No uid — sign-up credentials step was skipped.');
      await createUserDoc(uid, {
        uid,
        role: 'passenger',
        email,
        firstName,
        lastName,
        phone,
        phoneVerified: false,
        riderType,
      });
      return uid;
    },
    onSuccess: (uid) => {
      setSession(uid, 'passenger');
    },
  });

  function goBack() {
    if (step === 'profile') setStep('credentials');
    else if (step === 'riderType') setStep('profile');
    else if (step === 'review') setStep('riderType');
  }

  return {
    step,
    formData,
    credentialsMutation,
    saveProfile,
    selectRiderType,
    createProfileMutation,
    goBack,
  };
}
