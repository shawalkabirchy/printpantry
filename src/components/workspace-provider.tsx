"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AppError,
  backup,
  emptyWorkspace,
  validateWorkspace,
  type Workspace,
} from "@/lib/domain";
import { commitWorkspace, readWorkspace, storageError } from "@/lib/storage";
import { downloadText } from "@/lib/download";

type WorkspaceContext = {
  workspace: Workspace;
  ready: boolean;
  busy: boolean;
  error: AppError | null;
  changedElsewhere: boolean;
  saved: boolean;
  epoch: number;
  recovery: Workspace | null;
  job: { required: string; reserve: string };
  setJob: React.Dispatch<
    React.SetStateAction<{ required: string; reserve: string }>
  >;
  save: (
    change: (current: Workspace) => Workspace,
    expectedRevision?: number,
  ) => Promise<boolean>;
  reload: () => Promise<void>;
  exportRecovery: () => void;
};
const Context = createContext<WorkspaceContext | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const current = useRef(workspace);
  const channel = useRef<BroadcastChannel | null>(null);
  const saving = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recovery, setRecovery] = useState<Workspace | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [job, setJob] = useState({ required: "", reserve: "10" });
  const reload = useCallback(async () => {
    try {
      const loaded = await readWorkspace();
      current.current = loaded;
      setWorkspace(loaded);
      setError(null);
      setChangedElsewhere(false);
      setRecovery(null);
      setSaved(false);
      setEpoch((value) => value + 1);
    } catch (cause) {
      setError(storageError(cause));
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    void reload();
    const handleRevision = (revision: number) => {
      if (revision !== current.current.revision) setChangedElsewhere(true);
    };
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("printpantry-revision");
      channel.current.onmessage = (event) => {
        if (typeof event.data?.revision === "number")
          handleRevision(event.data.revision);
      };
    }
    const onVisible = () => {
      if (document.visibilityState === "visible")
        void readWorkspace()
          .then((value) => handleRevision(value.revision))
          .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      channel.current?.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);
  async function save(
    change: (current: Workspace) => Workspace,
    expectedRevision = workspace.revision,
  ) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const proposed = validateWorkspace(change(workspace));
      backup(proposed);
      setRecovery(proposed);
      const next = await commitWorkspace(expectedRevision, () => proposed);
      current.current = next;
      setWorkspace(next);
      setRecovery(null);
      setSaved(true);
      setChangedElsewhere(false);
      channel.current?.postMessage({ revision: next.revision });
      return true;
    } catch (cause) {
      setError(storageError(cause));
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        workspace,
        ready,
        busy,
        error,
        changedElsewhere,
        saved,
        epoch,
        recovery,
        job,
        setJob,
        save,
        reload,
        exportRecovery: () =>
          downloadText(
            backup(recovery ?? workspace),
            "printpantry-recovery-unsaved.json",
          ),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace provider is missing.");
  return context;
}
