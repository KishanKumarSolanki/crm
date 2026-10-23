const paths = {
  dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  leads: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7" r="4" /><path d="M17 11a4 4 0 0 0 0-8M21 20v-1.5a4 4 0 0 0-3-3.87" /></>,
  pipeline: <><path d="M4 5h16M6 12h12m-9 7h6" /><circle cx="7" cy="5" r="1.5" /><circle cx="16" cy="12" r="1.5" /><circle cx="10" cy="19" r="1.5" /></>,
  marketing: <><path d="M3 11v2a2 2 0 0 0 2 2h2l8 4V5l-8 4H5a2 2 0 0 0-2 2Z" /><path d="m7 15 1.5 5H12l-2-4m7-7a4 4 0 0 1 0 4m2-6a7 7 0 0 1 0 8" /></>,
  tasks: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 10h16m-11 5 2 2 4-4" /></>,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20v-1.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V20m1-12a3.5 3.5 0 0 1 0 7m2 1.5a4 4 0 0 1 3 3.87V20" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  arrow: <><path d="M5 12h14m-7-7 7 7-7 7" /></>,
};

export default function Icon({ name, size = 20, strokeWidth = 1.8, className = "" }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.dashboard}
    </svg>
  );
}
