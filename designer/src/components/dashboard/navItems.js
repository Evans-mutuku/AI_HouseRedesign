import Icon from '../Icon.jsx';

// The primary navigation, in one place: the sidebar renders it, and the top bar
// reads it to name the current page.
export const NAV_ITEMS = [
  { to: '/app', label: 'Overview', icon: Icon.Overview, end: true },
  { to: '/app/new', label: 'New redesign', icon: Icon.NewDesign },
  { to: '/app/projects', label: 'Projects', icon: Icon.Projects },
  { to: '/app/storage', label: 'Storage & plan', icon: Icon.Storage },
  { to: '/app/settings', label: 'Settings', icon: Icon.Settings },
];
