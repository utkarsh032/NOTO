import { PLATFORMS, type PlatformId } from '@noto/config';

/** Display name for every platform, keyed by id. */
export const PLATFORM_LABEL = Object.fromEntries(
  PLATFORMS.map((platform) => [platform.id, platform.label]),
) as Record<PlatformId, string>;
