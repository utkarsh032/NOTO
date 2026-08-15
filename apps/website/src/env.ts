/**
 * Build-time facts injected by the web workflow.
 *
 * The website is a static bundle, so the version it advertises is whatever was
 * true when it was built. That is deliberate: a release deploys the website as
 * part of the same pipeline that publishes the installers, so the two agree.
 * The download page still asks GitHub for the live latest release and prefers
 * that answer when it can reach the API.
 */

const env = import.meta.env;

/** Version baked in at build time; the fallback keeps `pnpm dev` working. */
export const BUILD_VERSION: string = env.VITE_NOTO_VERSION || '0.0.0';

/** `production`, `staging`, or `development` when running locally. */
export const BUILD_ENV: string = env.VITE_NOTO_ENV || (env.DEV ? 'development' : 'production');

export const BUILD_COMMIT: string = env.VITE_NOTO_COMMIT || '';

/** Where the web application is deployed, so "Open Noto" can link to it. */
export const WEB_APP_URL: string = env.VITE_NOTO_WEB_APP_URL || 'https://app.noto.example.com';

/** True on any deployment that is not the public production site. */
export const IS_PREVIEW = BUILD_ENV !== 'production';
