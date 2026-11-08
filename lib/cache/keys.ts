export const dashKey = (channelId: string, from: string, to: string, kind: string, extra = "") =>
  `dash:${channelId}:${from}:${to}:${kind}${extra ? `:${extra}` : ""}`;
export const videoKey = (channelId: string, videoId: string, from: string, to: string) =>
  `dash:${channelId}:video:${videoId}:${from}:${to}`;
export const channelPattern = (channelId: string) => `dash:${channelId}:*`;
export const syncProgressKey = (channelId: string) => `sync:progress:${channelId}`;
export const manualSyncLockKey = (channelId: string) => `sync:manual:${channelId}`;
export const circuitKey = (channelId: string) => `sync:circuit:${channelId}`;
export const quotaPauseKey = () => `sync:quota-paused`;
export const grantChannelsKey = (tokenId: string) => `grant:channels:${tokenId}`;
