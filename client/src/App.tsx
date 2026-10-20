// Root App component. Signing in is required: a signed-out visitor sees the landing page, a signed-in user gets the dashboard (/) and project workspaces (/projects/:id). The pre-redesign compiler stays reachable at /classic until the compiler is rebuilt inside projects.
import { Loader2, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useMatch } from "react-router-dom";
import Compiler from "./components/Compiler";
import LoginModal from "./components/LoginModal";
import AppHeader from "./components/shell/AppHeader";
import { useAuth } from "./context/AuthContext";
import { useToast } from "./context/ToastContext";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from "./pages/LandingPage";
import ProjectPage from "./pages/ProjectPage";

const PENDING_LOGIN_TOAST_KEY = "pendingLoginToast";
const PENDING_LOGOUT_TOAST_KEY = "pendingLogoutToast";

function App() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const onClassic = useMatch("/classic") !== null;
  const { currentUser, initializing } = useAuth();
  const { showToast } = useToast();
  const previousAuthKeyRef = useRef<string | null | undefined>(
    undefined,
  );
  useEffect(() => {
    if (initializing) return;
    const currentKey = currentUser ? currentUser.id : null;
    if (previousAuthKeyRef.current === undefined) {
      previousAuthKeyRef.current = currentKey;
      return;
    }
    if (previousAuthKeyRef.current !== currentKey) {
      if (currentKey && currentUser) {
        // Stash both the email and the friendly display name so the post-reload
        // toast can greet the user with their name instead of their email
        // (displayName typically comes from the OAuth provider; fall back to the
        // email when the provider didn't return one).
        sessionStorage.setItem(
          PENDING_LOGIN_TOAST_KEY,
          currentUser.displayName || currentUser.email,
        );
      } else {
        sessionStorage.setItem(PENDING_LOGOUT_TOAST_KEY, "1");
      }
      window.location.reload();
    }
  }, [currentUser, initializing]);

  useEffect(() => {
    if (initializing) return;
    const loginName = sessionStorage.getItem(PENDING_LOGIN_TOAST_KEY);
    if (loginName) {
      sessionStorage.removeItem(PENDING_LOGIN_TOAST_KEY);
      // The pending value can be either a display name (preferred) or — for
      // older sessions where only the email was stashed — an email address.
      // Show either as the friendly greeting the user expects.
      showToast(`Welcome, ${loginName}`, "success");
      return;
    }
    if (sessionStorage.getItem(PENDING_LOGOUT_TOAST_KEY) === "1") {
      sessionStorage.removeItem(PENDING_LOGOUT_TOAST_KEY);
      showToast("Logged out successfully", "success");
    }
  }, [initializing, showToast]);

  const openLogin = () => setShowLoginModal(true);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      {initializing ? (
        <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
          <span>Loading…</span>
        </div>
      ) : currentUser ? (
        <>
          <AppHeader
            onSignIn={openLogin}
            leading={
              onClassic && !libraryOpen ? (
                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  title="Expand Library"
                  aria-label="Expand Library"
                >
                  <PanelLeftOpen aria-hidden="true" className="h-5 w-5" />
                </button>
              ) : undefined
            }
          />
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projects/:projectId/*" element={<ProjectPage />} />
            <Route
              path="/classic"
              element={
                <div id="main" tabIndex={-1} className="legacy-light bg-mesh min-h-screen pt-0 font-sans antialiased outline-none selection:bg-indigo-200 selection:text-indigo-900">
                  <Compiler onRequireAuth={openLogin} libraryOpen={libraryOpen} onLibraryToggle={setLibraryOpen} />
                </div>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </>
      ) : (
        <>
          <AppHeader onSignIn={openLogin} />
          <LandingPage onSignIn={openLogin} />
        </>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}

export default App;
