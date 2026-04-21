import { z, type ZodErrorMap } from "zod";

/**
 * Build a locale-aware zod error map.
 *
 * Pass this to `z.setErrorMap` once at module load (or per-request in
 * RSC) to have zod emit localized validation messages. The keys mirror
 * `validation.*` in `messages/{en,es}.json` so copy stays in one place.
 *
 * Usage (server action / route handler):
 *   import { getTranslations } from "next-intl/server";
 *   import { buildZodErrorMap } from "@/lib/zod-i18n";
 *   const t = await getTranslations("validation");
 *   z.setErrorMap(buildZodErrorMap(t));
 *
 * Usage (client component):
 *   import { useTranslations } from "next-intl";
 *   const t = useTranslations("validation");
 *   z.setErrorMap(buildZodErrorMap(t));
 */
export function buildZodErrorMap(
  t: (key: string, values?: Record<string, unknown>) => string,
): ZodErrorMap {
  return (issue, ctx) => {
    switch (issue.code) {
      case z.ZodIssueCode.invalid_type:
        if (issue.received === "undefined" || issue.received === "null") {
          return { message: t("required") };
        }
        return { message: ctx.defaultError };

      case z.ZodIssueCode.invalid_string:
        if (issue.validation === "email") return { message: t("invalidEmail") };
        if (issue.validation === "url") return { message: t("invalidUrl") };
        return { message: ctx.defaultError };

      case z.ZodIssueCode.too_small:
        if (issue.type === "string") {
          if (issue.minimum === 1) return { message: t("required") };
          return { message: t("tooShort") };
        }
        if (issue.type === "number") return { message: t("invalidNumber") };
        return { message: ctx.defaultError };

      case z.ZodIssueCode.too_big:
        if (issue.type === "string") return { message: t("tooLong") };
        return { message: ctx.defaultError };

      case z.ZodIssueCode.invalid_date:
        return { message: t("invalidDate") };

      default:
        return { message: ctx.defaultError };
    }
  };
}
