// Top bar for every screen: brand, the colour theme switch, and either a Sign in button or the user menu. It is fixed and exactly 57px tall because the pre-redesign compiler screens position themselves below a header of that height.
import { LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { reloadPage } from "../../lib/navigation";
import ThemeToggle from "../ui/ThemeToggle";
import UserMenu from "./UserMenu";

type AppHeaderProps = {
  onSignIn: () => void;
  // Controls shown before the brand (the legacy library toggle).
  leading?: ReactNode;
};

export default function AppHeader({ onSignIn, leading }: AppHeaderProps) {
  const { currentUser, logout } = useAuth();

  async function handleSignOut() {
    await logout();
    reloadPage();
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-[57px] items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <a href="/" className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutGrid aria-hidden="true" className="h-4 w-4" />
          </span>
          <span className="truncate font-bold tracking-tight text-foreground">SVG Sprite Compiler</span>
        </a>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <ThemeToggle />
        {currentUser ? (
          <UserMenu user={currentUser} onSignOut={handleSignOut} />
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
