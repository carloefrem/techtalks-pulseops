import { z } from "zod";

/**
 * Environment variables, validated once at startup.
 * A missing or invalid value stops the server with a clear message
 * instead of failing later (docs/backend/README.md section 4).
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FRONTEND_ORIGIN: z.url({ protocol: /^https?$/ }),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must start with postgresql://"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration (check backend/.env):\n${problems}`);
  }
  return result.data;
}
