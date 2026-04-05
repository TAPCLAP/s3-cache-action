import * as minio from "minio";
import { findObject } from "./utils";

describe("utils", () => {
  const itIntegration =
    process.env.RUN_MINIO_INTEGRATION === "1" ? it : it.skip;

  itIntegration("findObject against play.min.io (set RUN_MINIO_INTEGRATION=1)", async () => {
    const mc = new minio.Client({
      endPoint: "play.min.io",
      accessKey: "Q3AM3UQ867SPQQA43P2F",
      secretKey: "zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG",
    });
    const got = await findObject(mc, "actions-cache", "foo.bar");
    expect(got).toBeTruthy();
    console.log(got);
  });
});
