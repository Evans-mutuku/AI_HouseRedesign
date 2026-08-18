import { Navigate, useLocation } from 'react-router-dom';

import { Spinner } from './Icon.jsx';
import { useAuth } from '../lib/authContext.js';

/**
 * Gate for everything under /app.
 *
 * This is a convenience, not the security boundary - it keeps signed-out people
 * from seeing an empty shell. The real enforcement is server-side: every API
 * route verifies the Firebase ID token and scopes its queries to that account,
 * so bypassing this component reveals nothing.
 */
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <Spinner size={22} />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }

  if (!user) {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return children;
}
