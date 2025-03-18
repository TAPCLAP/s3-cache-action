import * as cache from "@actions/cache";
import * as utils from "@actions/cache/lib/internal/cacheUtils";
import { extractTar, listTar } from "@actions/cache/lib/internal/tar";
import * as core from "@actions/core";
import * as path from "path";
import { State } from "./state";
import { parse as yamlParse} from 'yaml';

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
} from "./utils";


process.on("uncaughtException", (e) => core.info("warning: " + e.message));

async function restoreCache() {
  try {
    await validateInputs();
    const bucket = core.getInput("bucket", { required: true });
    const cacheListKeys = yamlParse(core.getInput('cache-list-keys'));

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
      const restoredKeys = [];

      for (const ck of cacheListKeys) {
        core.info(`try restore cache for ${ck.path}: ${ck.key}`);
        const archivePath = path.join(
          await utils.createTempDirectory(),
          cacheFileName
        );

        try {
            const { item: obj, matchingKey } = await findObject(
            mc,
            bucket,
            ck.key
          );
          restoredKeys.push(ck)
          core.info(`Matching key: ${matchingKey}`);
          core.debug("found cache object");
          core.info(
            `Downloading cache from s3 to ${archivePath}. bucket: ${bucket}, object: ${obj.name}`
          );
          await mc.fGetObject(bucket, obj.name, archivePath);
    
          if (core.isDebug()) {
            await listTar(archivePath, compressionMethod);
          }
    
          core.info(`Cache Size: ${formatSize(obj.size)} (${obj.size} bytes)`);
    
          await extractTar(archivePath, compressionMethod);
          core.info("Cache restored from s3 successfully");

        } catch(e) {
          if (e.name == "CacheNotFound") {
            core.info(`Cache not found for ${ck.key}, skipping restore`);
            continue;
          }
          throw e;
        }
      }
      core.saveState(State.RestoredKeys, JSON.stringify(restoredKeys));

    } catch (e) {
      core.info("Restore s3 cache failed: " + e.message);
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
  } catch (e) {
    core.setFailed(`[${ActionName}]: ${e.message}`);
  }
}

restoreCache();
