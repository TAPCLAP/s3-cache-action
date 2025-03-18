import { CompressionMethod } from "@actions/cache/lib/internal/constants";
import * as utils from "@actions/cache/lib/internal/cacheUtils";
import * as core from "@actions/core";
import * as minio from "minio";
import { State } from "./state";
import * as path from "path";
import {createTar, listTar} from "@actions/cache/lib/internal/tar";
import * as cache from "@actions/cache";
import { parse as yamlParse} from 'yaml';
import { existsSync, readFileSync } from 'fs';
import * as os from 'os';

export type cacheKey = {
  key: string;
  path: string;
};

export const ActionName = "s3-cache-action";


export class CacheNotFound extends Error {
  constructor(message) {
      super(message);
      this.name = "CacheNotFound";
  }
}

export function isGhes(): boolean {
  const ghUrl = new URL(
    process.env["GITHUB_SERVER_URL"] || "https://github.com"
  );
  return ghUrl.hostname.toUpperCase() !== "GITHUB.COM";
}

export function getInput(key: string, envKey?: string) {
  let result;
  if (envKey) {
    result = process.env[envKey]
  }
  if (result === undefined) {
    result = core.getInput(key);
  }
  return result;
}

export function newMinio({
  accessKey,
  secretKey,
  sessionToken,
  region,
}: {
  accessKey?: string;
  secretKey?: string;
  sessionToken?: string;
  region?: string;
} = {}) {
  return new minio.Client({
    endPoint: core.getInput("endpoint"),
    port: getInputAsInt("port"),
    useSSL: !getInputAsBoolean("insecure"),
    accessKey: accessKey ?? getInput("accessKey", "AWS_ACCESS_KEY_ID"),
    secretKey: secretKey ?? getInput("secretKey", "AWS_SECRET_ACCESS_KEY"),
    sessionToken: sessionToken ?? getInput("sessionToken", "AWS_SESSION_TOKEN"),
    region: region ?? getInput("region", "AWS_REGION"),
  });
}

export function getInputAsBoolean(
  name: string,
  options?: core.InputOptions
): boolean {
  return core.getInput(name, options) === "true";
}

export function getInputAsArray(
  name: string,
  options?: core.InputOptions
): string[] {
  return core
    .getInput(name, options)
    .split("\n")
    .map((s) => s.trim())
    .filter((x) => x !== "");
}

export function getInputAsInt(
  name: string,
  options?: core.InputOptions
): number | undefined {
  const value = parseInt(core.getInput(name, options));
  if (isNaN(value) || value < 0) {
    return undefined;
  }
  return value;
}

export function formatSize(value?: number, format = "bi") {
  if (!value) return "";
  const [multiple, k, suffix] = (
    format === "bi" ? [1000, "k", "B"] : [1024, "K", "iB"]
  ) as [number, string, string];
  const exp = (Math.log(value) / Math.log(multiple)) | 0;
  const size = Number((value / Math.pow(multiple, exp)).toFixed(2));
  return (
    size +
    (exp ? (k + "MGTPEZY")[exp - 1] + suffix : "byte" + (size !== 1 ? "s" : ""))
  );
}

export function setCacheHitOutput(isCacheHit: boolean): void {
  core.setOutput("cache-hit", isCacheHit.toString());
}

export function setCacheSizeOutput(cacheSize: number): void {
  core.setOutput("cache-size", cacheSize.toString())
}

type FindObjectResult = {
  item: minio.BucketItem;
  matchingKey: string;
};

export async function findObject(
  mc: minio.Client,
  bucket: string,
  key: string
): Promise<FindObjectResult> {
  core.debug("Key: " + JSON.stringify(key));

  core.debug(`Finding exact macth for: ${key}`);
  const exactMatch = await listObjects(mc, bucket, key);
  core.debug(`Found ${JSON.stringify(exactMatch, null, 2)}`);
  if (exactMatch.length) {
    const result = { item: exactMatch[0], matchingKey: key };
    core.debug(`Using ${JSON.stringify(result)}`);
    return result;
  }

  throw new CacheNotFound("Cache item not found");
}

export async function existObject(
  mc: minio.Client,
  bucket: string,
  key: string
): Promise<boolean> {
  core.debug("Check exist key: " + JSON.stringify(key));
  core.debug(`Finding exact macth for: ${key}`);
  const exactMatch = await listObjects(mc, bucket, key);
  core.debug(`Found ${JSON.stringify(exactMatch, null, 2)}`);
  return exactMatch.length > 0;
}

export function listObjects(
  mc: minio.Client,
  bucket: string,
  prefix: string
): Promise<minio.BucketItem[]> {
  return new Promise((resolve, reject) => {
    const h = mc.listObjectsV2(bucket, prefix, true);
    const r: minio.BucketItem[] = [];
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved)
        reject(new Error("list objects no result after 10 seconds"));
    }, 10000);

    h.on("data", (obj) => {
      r.push(obj);
    });
    h.on("error", (e) => {
      resolved = true;
      reject(e);
      clearTimeout(timeout)
    });
    h.on("end", () => {
      resolved = true;
      resolve(r);
      clearTimeout(timeout)
    });
  });
}

// export function saveMatchedKey(matchedKey: string) {
//   return core.saveState(State.MatchedKey, matchedKey);
// }

// function getMatchedKey() {
//   return core.getState(State.MatchedKey);
// }
// цель: сохранить в кеш только то что изменилось
// export function isExactKeyMatch(): boolean {
  
//   // const cacheListKeys = yamlParse(core.getState(State.CacheListKeys));

//   const matchedKey = getMatchedKey();
//   const inputKey = core.getState(State.PrimaryKey);
//   const result = getMatchedKey() === inputKey;
//   core.debug(
//     `isExactKeyMatch: matchedKey=${matchedKey} inputKey=${inputKey}, result=${result}`
//   );
//   return result;
// }

export async function validateInputs() {
  const cacheListKeys = core.getInput('cache-list-keys');
  const cacheListKeysFile = core.getInput('cache-list-keys-file');

  if (cacheListKeys == '' && cacheListKeysFile == '') {
    throw new Error("Input required and must be a non-empty string either 'cache-list-keys' or 'cache-list-keys-file'");
  }

  if (cacheListKeys !== '') {
    try {
      yamlParse(cacheListKeys);
    } catch(e) {
      throw new Error(`Parse error from input 'cache-list-keys': ${e.message}`);
    }
  }

  if (cacheListKeysFile !== '') {
    if (!existsSync(cacheListKeysFile)) {
      throw new Error(`Cache list keys file not found: ${cacheListKeysFile}`);
    }
    try {
      yamlParse(readFileSync(cacheListKeysFile, 'utf8'))
    } catch(e) {
      throw new Error(`Parse error from input 'cache-list-keys-file': ${e.message}`);
    }
  }
}

export async function readCacheListKeys(): Promise<cacheKey[]> {
  const cacheListKeys = core.getInput('cache-list-keys');
  const cacheListKeysFile = core.getInput('cache-list-keys-file');

  if (cacheListKeys !== '') {
    return yamlParse(cacheListKeys);
  }

  if (cacheListKeysFile !== '') {
    return yamlParse(readFileSync(cacheListKeysFile, 'utf8'));
  }

  return [];
}

export async function saveCache(standalone: boolean) {
  try {
    await validateInputs();

    const bucket = core.getInput("bucket", { required: true });

    const useFallback = false
    // Inputs are re-evaluted before the post action, so we want the original key
    // const useFallback = getInputAsBoolean("use-fallback");
    // const key = standalone ? core.getInput("key", { required: true }) : core.getState(State.PrimaryKey);
    // const paths = getInputAsArray("path");

    try {
      const mc = newMinio({
        // Inputs are re-evaluted before the post action, so we want the original keys & tokens
        accessKey: standalone ? getInput("accessKey", "AWS_ACCESS_KEY_ID") : core.getState(State.AccessKey),
        secretKey: standalone ? getInput("secretKey", "AWS_SECRET_ACCESS_KEY") : core.getState(State.SecretKey),
        sessionToken: standalone ? getInput("sessionToken", "AWS_SESSION_TOKEN") : core.getState(State.SessionToken),
        region: standalone ? getInput("region", "AWS_REGION") : core.getState(State.Region),
      });

      let cacheListKeys: cacheKey[] = [];
      if (standalone) {
        cacheListKeys = await readCacheListKeys();
      } else {
        // откуда-то надо прочитать список файлов которые надо запаковать
        // cacheListKeys = yamlParse(core.getState(State.CacheListKeys));
      }

      const compressionMethod = await utils.getCompressionMethod();
      const cacheFileName = utils.getCacheFileName(compressionMethod);
      
      for (const ck of cacheListKeys) {
        core.debug(`try save cache for ${ck.path}: ${ck.key}`);

        if (standalone) {
          const a = await existObject(mc, bucket, ck.key);
          if (await existObject(mc, bucket, ck.key)) {
            core.info(`Cache already exists for ${ck.key}, skipping upload`);
            continue;
          }

        } else {
          // restoreKeys is a list of keys that were restored from cache
          // смотрим каким были восстановлены
          // сравниваем с теми какие указаны в файле core.getInput('cache-list-keys-file')
          // проверяем надо ли заливать файл
          // const restoredKeys = yamlParse(core.getState(State.RestoredKeys));
        }
        if (!existsSync(ck.path)) {
          core.info(`File or Directory not found: ${ck.path}, skipping upload`);
          continue;
        }
        core.info(`Cache not found for key ${ck.key}, uploading cache`);
        const cachePaths = await utils.resolvePaths([ck.path]);
        core.debug(`Cache Paths for ${ck.path}:`);
        core.debug(`${JSON.stringify(cachePaths)}`);

        const archiveFolder = await utils.createTempDirectory();
        const archivePath = path.join(archiveFolder, cacheFileName);
        core.debug(`Archive Path: ${archivePath}`);
        await createTar(archiveFolder, cachePaths, compressionMethod);

        if (core.isDebug()) {
          await listTar(archivePath, compressionMethod);
        }
        
        let object = path.join(ck.key, cacheFileName)
        if (os.platform() == "win32") {
          object = object.replace(/\\/g, '/');
        }
        core.info(`Uploading tar to s3. Bucket: ${bucket}, Object: ${object}`);
        await mc.fPutObject(bucket, object, archivePath, {});
        core.info("Cache saved to s3 successfully");
      }

    } catch (e) {
      core.info("Error: " + JSON.stringify(e));
      if (useFallback) {
        if (isGhes()) {
          core.warning("Cache fallback is not supported on Github Enterpise.");
        } else {
          core.info("Saving cache using fallback");
          // await cache.saveCache(paths, key);
          core.info("Save cache using fallback successfully");
        }
      } else {
        core.debug("skipped fallback cache");
        core.warning("Save s3 cache failed: " + e.message);
      }
    }
  } catch (e) {
    core.setFailed(`[${ActionName}]: ${e.message}`);
  }
}
