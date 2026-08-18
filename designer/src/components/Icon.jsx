// The icon set.
//
// One drawing style throughout: 24×24 box, 1.5 stroke, round caps and joins, no
// fills, `currentColor` so every mark inherits the text colour beside it. These
// are the only glyphs in the product — there are no emoji anywhere in the UI.
//
// Usage: <Icon.Storage size={16} /> or import { Storage } directly.

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Svg({ size = 20, className = '', children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...stroke}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* — Navigation ————————————————————————————————————————————— */

export const Overview = (p) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M9.5 20v-6h5v6" />
  </Svg>
);

export const Projects = (p) => (
  <Svg {...p}>
    <rect x="3" y="4" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="4" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="14.5" width="7.5" height="5.5" rx="1.5" />
    <rect x="13.5" y="14.5" width="7.5" height="5.5" rx="1.5" />
  </Svg>
);

export const NewDesign = (p) => (
  <Svg {...p}>
    <path d="M12 4.5v15" />
    <path d="M4.5 12h15" />
  </Svg>
);

export const Storage = (p) => (
  <Svg {...p}>
    <ellipse cx="12" cy="6" rx="7.5" ry="3" />
    <path d="M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" />
    <path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
  </Svg>
);

export const Settings = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 8.9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.47 1Z" />
  </Svg>
);

/* — Actions ————————————————————————————————————————————————— */

export const ArrowRight = (p) => (
  <Svg {...p}>
    <path d="M4.5 12h14" />
    <path d="M12.5 6l6 6-6 6" />
  </Svg>
);

export const ArrowLeft = (p) => (
  <Svg {...p}>
    <path d="M19.5 12h-14" />
    <path d="M11.5 6l-6 6 6 6" />
  </Svg>
);

export const ArrowDown = (p) => (
  <Svg {...p}>
    <path d="M12 4.5v14" />
    <path d="M6 12.5l6 6 6-6" />
  </Svg>
);

export const ChevronRight = (p) => (
  <Svg {...p}>
    <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />
  </Svg>
);

export const ChevronDown = (p) => (
  <Svg {...p}>
    <path d="M5.5 9.5l6.5 6.5 6.5-6.5" />
  </Svg>
);

export const Plus = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const Minus = (p) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const Check = (p) => (
  <Svg {...p}>
    <path d="M4.5 12.5l4.8 4.8L19.5 7" />
  </Svg>
);

export const Close = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const Menu = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const Upload = (p) => (
  <Svg {...p}>
    <path d="M12 16.5V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Svg>
);

export const Download = (p) => (
  <Svg {...p}>
    <path d="M12 4v12.5" />
    <path d="M7 11.5l5 5 5-5" />
    <path d="M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Svg>
);

export const Trash = (p) => (
  <Svg {...p}>
    <path d="M4 6.5h16" />
    <path d="M9.5 6.5V4.75A.75.75 0 0 1 10.25 4h3.5a.75.75 0 0 1 .75.75V6.5" />
    <path d="M6.5 6.5l.8 12.3a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.3" />
    <path d="M10 10.5v6M14 10.5v6" />
  </Svg>
);

export const Refresh = (p) => (
  <Svg {...p}>
    <path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" />
    <path d="M4 4.5v4h4" />
    <path d="M4 12.5A8 8 0 0 0 17.7 17.7L20 15.5" />
    <path d="M20 19.5v-4h-4" />
  </Svg>
);

export const Search = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M15.8 15.8L20 20" />
  </Svg>
);

export const ExternalLink = (p) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-8.5 8.5" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Svg>
);

/* — Identity ————————————————————————————————————————————————— */

export const User = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.75" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const Mail = (p) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3.5 7l8.5 6 8.5-6" />
  </Svg>
);

export const Lock = (p) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const Eye = (p) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const EyeOff = (p) => (
  <Svg {...p}>
    <path d="M10 5.8A8.6 8.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.8 3.6" />
    <path d="M6.3 7.4A16.7 16.7 0 0 0 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 3.9-.85" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M4 4l16 16" />
  </Svg>
);

export const SignOut = (p) => (
  <Svg {...p}>
    <path d="M10 20H6.5A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4H10" />
    <path d="M15 8.5l3.5 3.5-3.5 3.5" />
    <path d="M18.5 12H9" />
  </Svg>
);

export const Shield = (p) => (
  <Svg {...p}>
    <path d="M12 3.5l7 2.5v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6Z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </Svg>
);

/* — Product ————————————————————————————————————————————————— */

export const Sparkle = (p) => (
  <Svg {...p}>
    <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9Z" />
    <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
  </Svg>
);

export const Palette = (p) => (
  <Svg {...p}>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2a1.7 1.7 0 0 1 1.2-2.9h1.6a4.4 4.4 0 0 0 4.4-4.4C20.5 6.5 16.7 3.5 12 3.5Z" />
    <circle cx="8" cy="10" r="1.1" />
    <circle cx="12" cy="7.5" r="1.1" />
    <circle cx="16" cy="10" r="1.1" />
  </Svg>
);

export const Lighting = (p) => (
  <Svg {...p}>
    <path d="M9 17.5h6" />
    <path d="M10 20.5h4" />
    <path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.5.4.8 1 .8 1.6v.4h4.8v-.4c0-.6.3-1.2.8-1.6A5.5 5.5 0 0 0 12 3.5Z" />
  </Svg>
);

export const Layout = (p) => (
  <Svg {...p}>
    <path d="M4 10.5V8a2 2 0 0 1 2-2h1.5a2 2 0 0 1 2 2v2.5" />
    <path d="M14.5 10.5V8a2 2 0 0 1 2-2H18a2 2 0 0 1 2 2v2.5" />
    <rect x="3" y="10.5" width="18" height="5.5" rx="1.8" />
    <path d="M5.5 16v2.5M18.5 16v2.5" />
  </Svg>
);

export const Materials = (p) => (
  <Svg {...p}>
    <path d="M12 3.5l8.5 4.75L12 13 3.5 8.25Z" />
    <path d="M3.5 12.2L12 17l8.5-4.8" />
    <path d="M3.5 16.1L12 20.9l8.5-4.8" />
  </Svg>
);

export const Shopping = (p) => (
  <Svg {...p}>
    <path d="M4 7.5h16l-1.2 11.1a1.6 1.6 0 0 1-1.6 1.4H6.8a1.6 1.6 0 0 1-1.6-1.4Z" />
    <path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" />
  </Svg>
);

export const Photo = (p) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M3.5 16.5l4.6-4.3a1.8 1.8 0 0 1 2.5 0l5.2 4.9" />
    <path d="M14.5 14l1.6-1.5a1.8 1.8 0 0 1 2.5 0l1.9 1.8" />
  </Svg>
);

export const Compare = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M12 5v14" />
    <path d="M6.5 15l2.2-2.4L11 15" />
  </Svg>
);

export const Pro = (p) => (
  <Svg {...p}>
    <path d="M4 17.5h16" />
    <path d="M3.5 7.5l4 3.2 4.5-6 4.5 6 4-3.2-1.8 7H5.3Z" />
  </Svg>
);

export const Clock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Svg>
);

/* — Feedback ————————————————————————————————————————————————— */

export const Alert = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.8v4.7" />
    <path d="M12 16.1h.01" />
  </Svg>
);

export const Info = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.2" />
    <path d="M12 7.9h.01" />
  </Svg>
);

export const CheckCircle = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.3 12.2l2.5 2.5 4.9-5.4" />
  </Svg>
);

export function Spinner({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`hd-spin ${className}`}
      aria-hidden="true"
      focusable="false"
      {...stroke}
    >
      <circle cx="12" cy="12" r="8.5" opacity="0.25" />
      <path d="M20.5 12A8.5 8.5 0 0 0 12 3.5" />
    </svg>
  );
}

/* — Brand marks ————————————————————————————————————————————— */

/** Google "G" — the official four-colour mark, so it must keep its fills. */
export function Google({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84a10.13 10.13 0 0 1-4.4 6.65v5.52h7.12c4.16-3.83 6.56-9.47 6.56-16.18Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.12-5.52c-1.97 1.32-4.49 2.1-7.44 2.1-5.72 0-10.57-3.86-12.3-9.06H4.34v5.7A22 22 0 0 0 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.7 28.19a13.2 13.2 0 0 1 0-8.38v-5.7H4.34a22 22 0 0 0 0 19.78l7.36-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1A22 22 0 0 0 4.34 13.11l7.36 5.7c1.73-5.2 6.58-9.06 12.3-9.06Z"
      />
    </svg>
  );
}

/** The STUDIO wordmark's glyph — an abstract room in plan. */
export function Logomark({ size = 22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...stroke}
      strokeWidth={1.6}
    >
      <path d="M3.5 9.8L12 3l8.5 6.8" />
      <path d="M5.8 11.6V21h12.4v-9.4" />
      <path d="M9.9 21v-5.4h4.2V21" />
    </svg>
  );
}

const Icon = {
  Overview,
  Projects,
  NewDesign,
  Storage,
  Settings,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Check,
  Close,
  Menu,
  Upload,
  Download,
  Trash,
  Refresh,
  Search,
  ExternalLink,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  SignOut,
  Shield,
  Sparkle,
  Palette,
  Lighting,
  Layout,
  Materials,
  Shopping,
  Photo,
  Compare,
  Pro,
  Clock,
  Alert,
  Info,
  CheckCircle,
  Spinner,
  Google,
  Logomark,
};

export default Icon;
