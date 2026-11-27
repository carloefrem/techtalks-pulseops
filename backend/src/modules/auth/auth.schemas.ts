import { z } from "zod";

/** Field rules from docs/api/README.md section 6.1 and openapi.yaml (RegisterRequest / LoginRequest). */
const email = z
  .string()
  .trim()
  .max(254, "must be at most 254 characters")
  .pipe(z.email("must be a valid email address"))
  .transform((value) => value.toLowerCase());

export const RegisterBody = z
  .object({
    email,
    // bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently cut.
    password: z
      .string()
      .min(8, "must be at least 8 characters")
      .max(72, "must be at most 72 characters")
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "must be at most 72 bytes"),
    displayName: z.string().trim().min(1, "must not be empty").max(100, "must be at most 100 characters").optional(),
  })
  .strict();

export const LoginBody = z
  .object({
    email,
    // No length rules on login: a wrong password is just INVALID_CREDENTIALS. The cap stops huge inputs.
    password: z.string().min(1, "is required").max(1024, "is too long"),
  })
  .strict();

export type RegisterInput = z.infer<typeof RegisterBody>;
export type LoginInput = z.infer<typeof LoginBody>;
