import type { SyncState, SyncStateStore } from "@bibliograph/core";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Sync bookkeeping (file ids, versions, content hashes) in users/{uid}/sync/library. Derived
 * data: if it's lost, the next sync re-reads Drive and rebuilds it. Shared across devices so a
 * second browser doesn't mistake its own stale view for fresh edits.
 */
export class FirestoreSyncStateStore implements SyncStateStore {
  constructor(
    private readonly uid: string,
    private readonly rootFolderId: string
  ) {}

  private ref() {
    return doc(db, "users", this.uid, "sync", "library");
  }

  async load(): Promise<SyncState | null> {
    const snapshot = await getDoc(this.ref());
    const data = snapshot.data() as { rootFolderId?: string; state?: string } | undefined;
    // Bookkeeping for a different folder doesn't apply to this one.
    if (!data?.state || data.rootFolderId !== this.rootFolderId) return null;
    return JSON.parse(data.state) as SyncState;
  }

  async save(state: SyncState): Promise<void> {
    await setDoc(this.ref(), { rootFolderId: this.rootFolderId, state: JSON.stringify(state), updatedAt: new Date().toISOString() });
  }
}
