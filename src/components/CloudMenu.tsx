import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  CloudUpload,
  FolderOpen,
  Loader2,
  LogIn,
  LogOut,
  UserRound,
} from 'lucide-react';
import { AuthModal } from './AuthModal';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { useAppStore } from '../store/appStore';
import {
  listCloudProjects,
  loadCloudProject,
  saveProjectToCloud,
  type CloudProjectSummary,
} from '../lib/projects';

interface SaveStatus {
  kind: 'success' | 'error';
  text: string;
}

const SKELETON_ROWS = [0, 1, 2];

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function CloudMenu() {
  const user = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const signOut = useAuthStore((state) => state.signOut);

  const project = useAppStore((state) => state.project);
  const cloudProjectId = useAppStore((state) => state.cloudProjectId);
  const loadProject = useAppStore((state) => state.loadProject);
  const setCloudProjectId = useAppStore((state) => state.setCloudProjectId);
  const setProjectLoading = useAppStore((state) => state.setProjectLoading);
  const pushToast = useToastStore((state) => state.pushToast);

  const [authOpen, setAuthOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [status, setStatus] = useState<SaveStatus | null>(null);

  const projectsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectsOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (
        target !== null &&
        projectsRef.current !== null &&
        !projectsRef.current.contains(target)
      ) {
        setProjectsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProjectsOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [projectsOpen]);

  useEffect(() => {
    if (user === null) {
      setProjects([]);
      setProjectsOpen(false);
      setStatus(null);
    }
  }, [user]);

  if (user === null) {
    return (
      <div className="cloud-menu">
        <button
          type="button"
          className="cloud-save"
          onClick={() => setAuthOpen(true)}
          disabled={authStatus === 'loading'}
          title="Sign in to save your project to the cloud"
        >
          <CloudUpload size={15} aria-hidden="true" />
          Save to Cloud
        </button>
        <button
          type="button"
          className="cloud-signin"
          onClick={() => setAuthOpen(true)}
          disabled={authStatus === 'loading'}
        >
          <LogIn size={15} aria-hidden="true" />
          Sign In
        </button>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    );
  }

  const refreshProjects = async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      setProjects(await listCloudProjects(user.id));
    } catch (error: unknown) {
      setProjectsError(toMessage(error));
    } finally {
      setProjectsLoading(false);
    }
  };

  const handleToggleProjects = () => {
    const next = !projectsOpen;
    setProjectsOpen(next);
    if (next) {
      void refreshProjects();
    }
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const saved = await saveProjectToCloud(project, user.id, cloudProjectId);
      setCloudProjectId(saved.id);
      setProjects((current) => [
        { id: saved.id, name: saved.name, updatedAt: saved.updatedAt },
        ...current.filter((item) => item.id !== saved.id),
      ]);
      setStatus({ kind: 'success', text: 'Saved to cloud' });
      pushToast('Project saved to the cloud.', 'success');
    } catch (error: unknown) {
      const message = toMessage(error);
      setStatus({ kind: 'error', text: message });
      pushToast(`Could not save the project: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadProject = async (projectId: string) => {
    if (loadingProjectId !== null) {
      return;
    }
    setLoadingProjectId(projectId);
    setProjectsError(null);
    setProjectLoading(true);
    try {
      const loaded = await loadCloudProject(projectId);
      loadProject(loaded.data, loaded.id);
      setProjectsOpen(false);
      setStatus({ kind: 'success', text: `Loaded “${loaded.name}”` });
      pushToast(`Loaded “${loaded.name}”.`, 'success');
    } catch (error: unknown) {
      const message = toMessage(error);
      setProjectsError(message);
      pushToast(`Could not load the project: ${message}`, 'error');
    } finally {
      setLoadingProjectId(null);
      setProjectLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    if (result.error !== null) {
      setStatus({ kind: 'error', text: result.error });
      return;
    }
    setCloudProjectId(null);
    setStatus(null);
  };

  return (
    <div className="cloud-menu">
      <span className="cloud-user" title={user.email ?? undefined}>
        <UserRound size={14} aria-hidden="true" />
        {user.email ?? 'Signed in'}
      </span>
      <button type="button" className="cloud-save" onClick={handleSave} disabled={saving}>
        {saving ? (
          <Loader2 className="spin" size={15} aria-hidden="true" />
        ) : (
          <CloudUpload size={15} aria-hidden="true" />
        )}
        {saving ? 'Saving…' : 'Save to Cloud'}
      </button>
      <div className="export-menu" ref={projectsRef}>
        <button
          type="button"
          className="export-toggle"
          aria-haspopup="menu"
          aria-expanded={projectsOpen}
          onClick={handleToggleProjects}
        >
          <FolderOpen size={15} aria-hidden="true" />
          My Projects
          <ChevronDown
            className={projectsOpen ? 'chevron chevron-open' : 'chevron'}
            size={14}
            aria-hidden="true"
          />
        </button>
        {projectsOpen && (
          <div
            className="export-dropdown cloud-projects"
            role="menu"
            aria-busy={projectsLoading || loadingProjectId !== null}
          >
            {projectsLoading && (
              <div className="skeleton-list" role="status" aria-label="Loading projects">
                {SKELETON_ROWS.map((row) => (
                  <div key={row} className="skeleton-row skeleton-row-project">
                    <span className="skeleton-bar skeleton-bar-name" />
                    <span className="skeleton-bar skeleton-bar-date" />
                  </div>
                ))}
              </div>
            )}
            {projectsError !== null && (
              <p className="cloud-message cloud-message-error">{projectsError}</p>
            )}
            {!projectsLoading && projectsError === null && projects.length === 0 && (
              <p className="cloud-message">No saved projects yet.</p>
            )}
            {!projectsLoading && projects.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className="export-item cloud-project-item"
                disabled={loadingProjectId !== null}
                onClick={() => void handleLoadProject(item.id)}
              >
                <span className="cloud-project-name">{item.name}</span>
                <span className="cloud-project-date">
                  {loadingProjectId === item.id
                    ? 'Loading…'
                    : new Date(item.updatedAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className="cloud-signout"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <Loader2 className="spin" size={15} aria-hidden="true" />
        ) : (
          <LogOut size={15} aria-hidden="true" />
        )}
        {signingOut ? 'Signing Out…' : 'Sign Out'}
      </button>
      {status !== null && (
        <span
          className={`cloud-status cloud-status-${status.kind}`}
          role="status"
          title={status.text}
        >
          {status.text}
        </span>
      )}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
