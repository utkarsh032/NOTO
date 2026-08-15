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

/** Injected by `define` in vite.config.ts, read from the workspace manifest. */
declare const __NOTO_VERSION__: string;

/** Version this bundle was built from. Always the real manifest version. */
export const BUILD_VERSION: string = __NOTO_VERSION__;

/** `production`, `staging`, or `development` when running locally. */
export const BUILD_ENV: string = env.VITE_NOTO_ENV || (env.DEV ? 'development' : 'production');

export const BUILD_COMMIT: string = env.VITE_NOTO_COMMIT || '';

/**
 * Where the web application is deployed, so "Open Noto" can link to it.
 *
 * The default is the current deployment rather than a placeholder, so the
 * button works without any dashboard configuration. Override it with
 * `VITE_NOTO_WEB_APP_URL` at build time — which is what a custom domain will
 * eventually want.
 */
export const WEB_APP_URL: string =
  env.VITE_NOTO_WEB_APP_URL || 'https://noto-app.utkarshraj525.workers.dev';

/** True on any deployment that is not the public production site. */
export const IS_PREVIEW = BUILD_ENV !== 'production';
