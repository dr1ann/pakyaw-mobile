import { z } from 'zod';

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'production']).default('development'),
  EXPO_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  EXPO_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  EXPO_PUBLIC_FIREBASE_AUTH_TEST_MODE: z.enum(['true', 'false']).optional(),
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1),
  EXPO_PUBLIC_USE_FIREBASE_EMULATOR: z.enum(['true', 'false']).optional(),
  EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

export const env: Env = parseEnv({
  APP_ENV: process.env.APP_ENV,
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_AUTH_TEST_MODE: process.env.EXPO_PUBLIC_FIREBASE_AUTH_TEST_MODE,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
  EXPO_PUBLIC_USE_FIREBASE_EMULATOR: process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR,
  EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST:
    process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST,
});
