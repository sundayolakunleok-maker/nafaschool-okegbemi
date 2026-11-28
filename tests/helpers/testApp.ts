import type { AddressInfo } from "node:net";
import { neon } from "@neondatabase/serverless";
import type { Pool } from "@neondatabase/serverless";
import { createApp } from "../../src/app";

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

export function startTestServer(
  pool: Pool,
  databaseUrl: string
): Promise<TestServer> {
  const app = createApp({ pool, sql: neon(databaseUrl) });

  return new Promise((resolve, reject) => {
    const server = app.listen(0);

    server.once("error", reject);

    server.once("listening", () => {
      const address = server.address() as AddressInfo;

      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: async () => {
          const closed = new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) =>
              error ? rejectClose(error) : resolveClose()
            );
          });

          server.closeAllConnections();
          await closed;
        },
      });
    });
  });
}
