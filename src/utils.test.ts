import { S3Client } from "@aws-sdk/client-s3";
import { findObject } from "./utils";

describe("utils", () => {
  const itIntegration =
    process.env.RUN_S3_E2E_TEST === "1" ? it : it.skip;

  itIntegration(
    "findObject against play.min.io (set RUN_S3_E2E_TEST=1)",
    async () => {
      const client = new S3Client({
        region: "us-east-1",
        endpoint: "https://play.min.io",
        forcePathStyle: true,
        credentials: {
          accessKeyId: "Q3AM3UQ867SPQQA43P2F",
          secretAccessKey:
            "zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG",
        },
      });
      const got = await findObject(client, "actions-cache", "foo.bar");
      expect(got).toBeTruthy();
      console.log(got);
    }
  );
});
