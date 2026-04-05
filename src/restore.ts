import * as cache from "@actions/cache";
import * as utils from "@actions/cache/lib/internal/cacheUtils";
import { extractTar, listTar } from "@actions/cache/lib/internal/tar";
import * as core from "@actions/core";
import * as minio from "minio";
import * as path from "path";
import { State } from "./state";

import { ActionName } from "./utils";
import {
  findObject,
  formatSize,
  getInputAsArray,
  getInputAsBoolean,
  isGhes,
  newMinio,
  setCacheHitOutput,
  setCacheSizeOutput,
  getInput,
  validateInputs,
  readCacheListKeys,
  cacheKey,
  CacheNotFound,
} from "./utils";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

process.on("uncaughtException", (e: unknown) =>
  core.info("warning: " + errMsg(e))
);

async function restoreCache() {
  try {
    await validateInputs();
    const bucket = core.getInput("bucket", { required: true });
    const cacheListKeys = await readCacheListKeys();

    // const key = core.getInput("key", { required: true });
    // const useFallback = getInputAsBoolean("use-fallback");
    const useFallback = false
    // const paths = getInputAsArray("path");
    // const restoreKeys = getInputAsArray("restore-keys");


    try {
      // Inputs are re-evaluted before the post action, so we want to store the original values
      // core.saveState(State.PrimaryKey, key);
      core.saveState(State.AccessKey, getInput("accessKey", "AWS_ACCESS_KEY_ID"));
      core.saveState(State.SecretKey, getInput("secretKey", "AWS_SECRET_ACCESS_KEY"));
      core.saveState(State.SessionToken, getInput("sessionToken", "AWS_SESSION_TOKEN"));
      core.saveState(State.Region, getInput("region", "AWS_REGION"));
      core.saveState(State.CacheListKeys, JSON.stringify(cacheListKeys));

      const mc = newMinio();

      const compressionMethod = await utils.getCompressionMethod();
      const cacheFileName = utils.getCacheFileName(compressionMethod);
      const restoredKeys: cacheKey[] = [];
      const notFoundKeys: cacheKey[] = [];

      for (const ck of cacheListKeys) {
        core.info(`try restore cache for ${ck.path}: ${ck.key}`);
        const archivePath = path.join(
          await utils.createTempDirectory(),
          cacheFileName
        );

        let obj: minio.BucketItem;
        let matchingKey: string;
        try {

          const fo = await findObject(
            mc,
            bucket,
            ck.key
          );
          obj         = fo.item;
          matchingKey = fo.matchingKey;

        } catch (e: unknown) {
          if (e instanceof CacheNotFound) {
            notFoundKeys.push(ck);
            core.info(`Cache not found for ${ck.key}, skipping restore`);
            continue;
          }
          throw e;
        }

        restoredKeys.push(ck)
        core.info(`Matching key: ${matchingKey}`);
        core.debug("found cache object");
        const objectName = obj.name;
        if (!objectName) {
          throw new Error("S3 object has no name");
        }
        core.info(
          `Downloading cache from s3 to ${archivePath}. bucket: ${bucket}, object: ${objectName}`
        );
        await mc.fGetObject(bucket, objectName, archivePath);
  
        if (core.isDebug()) {
          await listTar(archivePath, compressionMethod);
        }
  
        core.info(`Cache Size: ${formatSize(obj.size)} (${obj.size} bytes)`);
  
        await extractTar(archivePath, compressionMethod);
        core.info("Cache restored from s3 successfully");

      }

      core.info(`Restored keys: ${JSON.stringify(restoredKeys, null, 2)}`);
      core.info(`Not found keys: ${JSON.stringify(notFoundKeys, null, 2)}`);
      
      
      await core.summary
        .addHeading('s3 restore cache')
        .addRaw("<details>\n<summary>Restored keys</summary>\n\n```json\n" + JSON.stringify(restoredKeys, null, 2) + "\n```\n</details>\n", true)
        .addRaw("<details>\n<summary>Not found keys</summary>\n\n```json\n" + JSON.stringify(notFoundKeys, null, 2) + "\n```\n</details>\n", true)
        .write()

      core.saveState(State.RestoredKeys, JSON.stringify(restoredKeys));

    } catch (e: unknown) {
      core.info("Restore s3 cache failed: " + errMsg(e));
      core.debug("Stack: " + (e instanceof Error ? e.stack : ""));
      setCacheHitOutput(false);
      if (useFallback) {
        if (isGhes()) {
          core.warning("Cache fallback is not supported on Github Enterpise.");
        } else {
          core.info("Restore cache using fallback cache");
          // const fallbackMatchingKey = await cache.restoreCache(
          //   paths,
          //   key,
          //   restoreKeys
          // );
          // if (fallbackMatchingKey) {
          //   setCacheHitOutput(fallbackMatchingKey === key);
          //   core.info("Fallback cache restored successfully");
          // } else {
          //   core.info("Fallback cache restore failed");
          // }
        }
      }
    }
  } catch (e: unknown) {
    core.setFailed(`[${ActionName}]: ${errMsg(e)}`);
  }
}

restoreCache();
