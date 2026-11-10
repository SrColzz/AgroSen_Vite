import type { ReactNode } from "react";

type IconName =
  | "sprout" | "dashboard" | "farm" | "leaf" | "cattle" | "box" | "coins" | "users"
  | "chart" | "bell" | "settings" | "logout" | "menu" | "plus" | "warning" | "calendar"
  | "search" | "map" | "ruler" | "pin" | "water" | "harvest" | "shield" | "mail"
  | "clock" | "calculator" | "milk" | "lock" | "file" | "activity";

const drawings: Record<IconName, ReactNode> = {
  sprout: <><path d="M12 21v-9" /><path d="M12 15c-5 0-8-2.5-8-7 4.5 0 8 2.2 8 7Z" /><path d="M12 12c0-4.5 3-7 8-7 0 4.5-3 7-8 7Z" /></>,
  dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="8" height="7" rx="1.5" /></>,
  farm: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-7h6v7M3 10h18" /></>,
  leaf: <><path d="M20 4c-9 0-15 3-15 10a6 6 0 0 0 6 6c7 0 9-7 9-16Z" /><path d="M4 21c3-5 7-8 13-12" /></>,
  cattle: <><path d="M7 8 4 5 2 8l4 3M17 8l3-3 2 3-4 3" /><path d="M6 10a6 6 0 0 1 12 0v5a6 6 0 0 1-12 0Z" /><path d="M9 13h.01M15 13h.01M10 17h4M12 19v2" /></>,
  box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v9l9 5 9-5V8M12 13v9" /></>,
  coins: <><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.4M3 12v5c0 1.7 2.7 3 6 3 1.1 0 2.1-.2 3-.5" /><ellipse cx="16" cy="15" rx="5" ry="3" /><path d="M11 15v4c0 1.7 2.2 3 5 3s5-1.3 5-3v-4" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 6.8M17 14a5.5 5.5 0 0 1 4.5 5.5" /></>,
  chart: <><path d="M4 20V11M10 20V5M16 20v-8M22 20H2" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4L7.1 15a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 2Z" /></>,
  logout: <><path d="M10 17 15 12l-5-5M15 12H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  warning: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15M15 6v15" /></>,
  ruler: <><path d="M3 7h18v10H3zM7 7v4M11 7v3M15 7v4M19 7v3" /></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  water: <><path d="M12 22a7 7 0 0 0 7-7c0-4-7-13-7-13S5 11 5 15a7 7 0 0 0 7 7Z" /></>,
  harvest: <><path d="M12 21V4M12 10C7 10 5 7 5 4c4 0 7 2 7 6ZM12 15c5 0 7-3 7-6-4 0-7 2-7 6ZM12 18c-4 0-6-2-6-5 3 0 6 1 6 5Z" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  calculator: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8v3H8zM8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01" /></>,
  milk: <><path d="M9 3h6l1 4 2 3v11H6V10l2-3 1-4Z" /><path d="M8 7h8M7 11h10M10 3v4" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  file: <><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
};

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawings[name]}</svg>;
}
