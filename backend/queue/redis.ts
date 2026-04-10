import IORedis from "ioredis";
import { REDIS_URL } from "./config";

declare global {
  // eslint-disable-next-line no-var
  var __consolidadorRedis__: IORedis | undefined;
}

export function getRedis(): IORedis {
  if (!global.__consolidadorRedis__) {
    global.__consolidadorRedis__ = new IORedis(REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 1200,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
  }
  return global.__consolidadorRedis__;
}
