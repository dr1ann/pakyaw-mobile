import { z } from 'zod';

/**
 * Step 1 — email + password credentials.
 */
export const signUpCredentialsSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters.')
    .max(128, 'Password is too long.'),
});

export type SignUpCredentials = z.infer<typeof signUpCredentialsSchema>;

/**
 * Step 2 — name and +63 Philippine mobile number.
 */
export const signUpProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required.').max(64),
  lastName: z.string().min(1, 'Last name is required.').max(64),
  phone: z
    .string()
    .regex(
      /^\+639\d{9}$/,
      'Enter a valid Philippine mobile number starting with +639.',
    ),
});

export type SignUpProfile = z.infer<typeof signUpProfileSchema>;

/**
 * Step 3 — rider type selection.
 */
export const riderTypeSchema = z.object({
  riderType: z.enum(['regular', 'student', 'pwd', 'senior'], {
    errorMap: () => ({ message: 'Please select a rider type.' }),
  }),
});

export type RiderTypeForm = z.infer<typeof riderTypeSchema>;

/**
 * Passenger sign-in — email + password.
 */
export const signInSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export type SignInFields = z.infer<typeof signInSchema>;

/**
 * Driver sign-in — email + password.
 */
export const driverSignInSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export type DriverSignInFields = z.infer<typeof driverSignInSchema>;
