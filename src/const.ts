/** Card version. Must equal `package.json` `version`: `release.yml` refuses
 *  to attach a bundle whose package version differs from the tag, and
 *  `tests/i18n.test.ts` keeps the two in step between releases. It is also
 *  the cache key on every data chunk's URL (`?v=`). */
export const CARD_VERSION = "0.3.0";

export const CARD_TAG = "austria-map-card";
export const CARD_NAME = "Austria Map Card";
export const REPO_URL = "https://github.com/rolandzeiner/austria-map-card";
