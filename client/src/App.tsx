import { AuthPage } from "./pages/AuthPage";
import { UnlockPage } from "./pages/UnlockPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { useAuth } from "./context/AuthContext";

const App = () => {
  const { loading, user, privateKey } = useAuth();

  if (loading) {
    return (
      <main className="loading-shell">
        <div className="loading-orb" />
        <p>Building your secure link...</p>
      </main>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!privateKey) {
    return <UnlockPage />;
  }

  return <WorkspacePage />;
};

export default App;

