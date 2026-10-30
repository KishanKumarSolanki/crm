import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChartNoAxesColumn,
  CircleCheck,
  Clock3,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";

const icons = {
  dashboard: LayoutDashboard,
  leads: UsersRound,
  pipeline: SlidersHorizontal,
  marketing: Megaphone,
  broadcast: Megaphone,
  mail: Mail,
  whatsapp: MessageCircle,
  chart: ChartNoAxesColumn,
  file: FileText,
  send: ArrowRight,
  check: CircleCheck,
  clock: Clock3,
  calendar: CalendarDays,
  refresh: RefreshCw,
  tasks: ListChecks,
  team: UsersRound,
  search: Search,
  bell: Bell,
  menu: Menu,
  close: X,
  logout: LogOut,
  plus: Plus,
  arrow: ArrowRight,
};

export default function Icon({ name, size = 20, strokeWidth = 1.8, className = "" }) {
  const LucideIcon = icons[name] || LayoutDashboard;
  return <LucideIcon aria-hidden="true" size={size} strokeWidth={strokeWidth} className={className} />;
}
