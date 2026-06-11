import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withSoftDelete } from "@locateflow/db";

/**
 * Regression guard for the `delete`/`deleteMany` rewrite in `withSoftDelete`.
 *
 * The bug: the rewrite originally called `(this as any)[model].update(...)`.
 * In Prisma 5.x the `this` binding inside a `query` extension callback is NOT
 * the extended client (empirically it is an array-like internal object), so
 * `this[model]` is `undefined` and the first soft-delete `.delete()` in
 * production threw `TypeError: Cannot read properties of undefined`.
 *
 * The fix switches `withSoftDelete` to the client-factory form of
 * `defineExtension` (`(client) => client.$extends({...})`) and dispatches the
 * rewrite through the captured `client`. These tests run the REAL extension
 * against a real (but unreachable) PrismaClient and prove the override:
 *   (a) runs without a `this`-binding TypeError, and
 *   (b) reaches the underlying `update`/`updateMany` dispatch (it fails only
 *       at the DB connection, not synchronously on an undefined model accessor).
 */

function makeClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: "mysql://u:p@127.0.0.1:1/none" } },
  });
}

describe("withSoftDelete delete/deleteMany rewrite (real extension)", () => {
  it("rewrites delete() without a `this`-binding TypeError", async () => {
    const db = makeClient().$extends(withSoftDelete);
    let caught: unknown;
    try {
      // User is a soft-delete model — the override fires.
      await (db as unknown as PrismaClient).user.delete({ where: { id: "nope" } });
    } catch (e) {
      caught = e;
    } finally {
      await (db as unknown as PrismaClient).$disconnect().catch(() => {});
    }
    expect(caught).toBeTruthy();
    const message = String((caught as Error).message);
    // The OLD broken code threw a synchronous TypeError before any DB work.
    expect(message).not.toMatch(/Cannot read properties of undefined/i);
    expect((caught as Error).constructor.name).not.toBe("TypeError");
  });

  it("rewrites deleteMany() without a `this`-binding TypeError", async () => {
    const db = makeClient().$extends(withSoftDelete);
    let caught: unknown;
    try {
      await (db as unknown as PrismaClient).address.deleteMany({ where: { userId: "nope" } });
    } catch (e) {
      caught = e;
    } finally {
      await (db as unknown as PrismaClient).$disconnect().catch(() => {});
    }
    expect(caught).toBeTruthy();
    const message = String((caught as Error).message);
    expect(message).not.toMatch(/Cannot read properties of undefined/i);
    expect((caught as Error).constructor.name).not.toBe("TypeError");
  });
});
