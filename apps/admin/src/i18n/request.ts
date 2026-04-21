import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale } from "./config";

/**
 * Admin i18n request config. Pattern mirrors `apps/web/src/i18n/request.ts`
 * — cookie wins, header is fallback, default is en. Admin is unlikely
 * to onboard a third locale before the marketing surface does, but the
 * machinery is in place either way.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerList = await headers();

  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const acceptLanguage = headerList.get("accept-language");
  const locale = resolveLocale(cookieValue, acceptLanguage);

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    now: new Date(),
    timeZone: "UTC",
  };
});
