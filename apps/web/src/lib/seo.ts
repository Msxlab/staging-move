export const SITE_NAME = "LocateFlow";
export const SITE_TITLE = "LocateFlow - Address & Moving Management";
export const SITE_DESCRIPTION = "Manage your addresses, services, and moving processes with intelligent assistance.";
export const DEFAULT_OG_IMAGE = "/icons/icon.svg";

export function absoluteUrl(path = "/") {
  return new URL(path, "http://localhost:3000").toString();
}
