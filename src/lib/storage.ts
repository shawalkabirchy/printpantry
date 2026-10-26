import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  AppError,
  emptyWorkspace,
  validateWorkspace,
  type Workspace,
} from "./domain";

interface PantryDB extends DBSchema {
  workspace: { key: string; value: Workspace };
}
let connection: Promise<IDBPDatabase<PantryDB>> | undefined;
function database() {
  connection ??= openDB<PantryDB>("printpantry", 1, {
    upgrade(db) {
      db.createObjectStore("workspace");
    },
    blocking() {
      void connection?.then((db) => db.close());
      connection = undefined;
    },
    terminated() {
      connection = undefined;
    },
  }).catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}
export function storageError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return new AppError(
      "STORAGE_FULL",
      "Device storage is full. Your entry was not saved. Export a recovery copy before freeing space.",
    );
  return new AppError(
    "STORAGE_UNAVAILABLE",
    "Browser storage is unavailable or unreadable. Your saved database has not been cleared. Keep this tab open and export a recovery copy.",
  );
}
export async function readWorkspace(): Promise<Workspace> {
  try {
    const db = await database();
    const value = await db.get("workspace", "current");
    return value ? validateWorkspace(value) : emptyWorkspace();
  } catch (error) {
    throw storageError(error);
  }
}
export async function commitWorkspace(
  expectedRevision: number,
  change: (current: Workspace) => Workspace,
): Promise<Workspace> {
  try {
    const db = await database();
    const transaction = db.transaction("workspace", "readwrite");
    try {
      const current =
        (await transaction.store.get("current")) ?? emptyWorkspace();
      validateWorkspace(current);
      if (current.revision !== expectedRevision)
        throw new AppError(
          "STALE_LOCAL_STATE",
          "Another tab changed this workspace. Copy your unsaved entry, then reload before saving again.",
        );
      const next = validateWorkspace({
        ...change(current),
        revision: current.revision + 1,
      });
      await transaction.store.put(next, "current");
      await transaction.done;
      return next;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        /* The transaction may already have aborted. */
      }
      await transaction.done.catch(() => undefined);
      throw error;
    }
  } catch (error) {
    throw storageError(error);
  }
}
