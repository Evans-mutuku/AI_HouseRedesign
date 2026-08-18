import { Link, Navigate, Route, Routes } from 'react-router-dom';

import RequireAuth from './components/RequireAuth.jsx';
import DashboardLayout from './components/dashboard/DashboardLayout.jsx';
import Button from './components/ui/Button.jsx';
import Icon from './components/Icon.jsx';

import Landing from './pages/Landing.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';
import Overview from './pages/app/Overview.jsx';
import NewRedesign from './pages/app/NewRedesign.jsx';
import Projects from './pages/app/Projects.jsx';
import ProjectDetail from './pages/app/ProjectDetail.jsx';
import StoragePlan from './pages/app/StoragePlan.jsx';
import Settings from './pages/app/Settings.jsx';

/**
 * Two zones: the public marketing site, and /app behind RequireAuth.
 *
 * The gate is a UX affordance only — the server independently authenticates
 * every API call and scopes it to the caller's account, so a route reached by
 * other means still returns nothing.
 */
export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      {/* Common aliases people type or bookmark. */}
      <Route path="/login" element={<Navigate to="/signin" replace />} />
      <Route path="/register" element={<Navigate to="/signup" replace />} />

      {/* Dashboard */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Overview />} />
        <Route path="new" element={<NewRedesign />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="storage" element={<StoragePlan />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound inApp />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound({ inApp = false }) {
  return (
    <div
      className={
        inApp
          ? 'py-16 text-center'
          : 'flex min-h-screen flex-col items-center justify-center px-6 text-center'
      }
    >
      <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-muted">
        <Icon.Search size={21} />
      </span>
      <h1 className="font-display text-title font-semibold text-ink">
        There is nothing at this address
      </h1>
      <p className="mt-2 text-sm text-muted">
        The page may have moved, or the link may be wrong.
      </p>
      <div className="mt-7">
        <Button as={Link} to={inApp ? '/app' : '/'} icon={Icon.ArrowLeft}>
          {inApp ? 'Back to dashboard' : 'Back to home'}
        </Button>
      </div>
    </div>
  );
}
