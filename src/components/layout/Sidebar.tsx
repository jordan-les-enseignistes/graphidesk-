import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { useFeedbacksPendingCount } from "@/hooks/useFeedbacks";
import { cn } from "@/lib/utils";
import { ROUTES, APP_CONFIG } from "@/lib/constants";
import { useAppVersion } from "@/hooks/useAppUpdate";
import { Tooltip } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  FolderOpen,
  Folders,
  Archive,
  Building2,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Palmtree,
  Globe,
  BookOpen,
  UsersRound,
  Palette,
  MessageSquarePlus,
  Contact,
  Wrench,
  Calculator,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

// Tableau de bord (seul, hors groupes)
const dashboardItem: NavItem = {
  label: "Tableau de bord",
  icon: LayoutDashboard,
  path: ROUTES.DASHBOARD,
};

// Groupes de navigation
const navGroups: NavGroup[] = [
  {
    label: "Gestion de projet",
    defaultOpen: true,
    items: [
      { label: "Mes Dossiers", icon: FolderOpen, path: ROUTES.MES_DOSSIERS },
      { label: "Tous les Dossiers", icon: Folders, path: ROUTES.TOUS_LES_DOSSIERS, adminOnly: true },
      { label: "Archives", icon: Archive, path: ROUTES.ARCHIVES },
      { label: "Franchises", icon: Building2, path: ROUTES.FRANCHISES },
      { label: "Projets Internes", icon: ClipboardList, path: ROUTES.PROJETS_INTERNES },
      { label: "Statistiques", icon: BarChart3, path: ROUTES.STATISTIQUES },
    ],
  },
  {
    label: "Mes outils",
    defaultOpen: true,
    items: [
      { label: "FabRik", icon: Wrench, path: ROUTES.FABRIK },
      { label: "Heures supplémentaires", icon: Clock, path: ROUTES.HEURES_SUPPLEMENTAIRES },
      { label: "Planning vacances", icon: Palmtree, path: ROUTES.PLANNING_VACANCES },
      { label: "Sites internet", icon: Globe, path: ROUTES.SITES_INTERNET },
      { label: "Process", icon: BookOpen, path: ROUTES.PROCESS },
      { label: "Réunions", icon: UsersRound, path: ROUTES.REUNIONS },
      { label: "Nuancier", icon: Palette, path: ROUTES.RAL_CONVERTER },
      { label: "Calculatrice", icon: Calculator, path: ROUTES.CALCULATRICE },
      { label: "Annuaire", icon: Contact, path: ROUTES.ANNUAIRE },
      { label: "Feedbacks", icon: MessageSquarePlus, path: ROUTES.FEEDBACKS },
    ],
  },
];

// Items admin uniquement
const adminGroup: NavGroup = {
  label: "Administration",
  defaultOpen: true,
  items: [
    { label: "Utilisateurs", icon: Users, path: ROUTES.UTILISATEURS, adminOnly: true },
    { label: "Paramètres", icon: Settings, path: ROUTES.PARAMETRES, adminOnly: true },
  ],
};

export function Sidebar() {
  const location = useLocation();
  const { isAdmin } = useEffectiveRole();
  const appVersion = useAppVersion();

  // Récupérer le nombre de feedbacks en attente (admin only)
  const { data: pendingFeedbacksCount } = useFeedbacksPendingCount();

  // Récupérer l'état depuis localStorage
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved === "true";
  });

  // État d'ouverture des groupes
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("sidebar-open-groups");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    // Par défaut, tous les groupes ouverts
    return {
      "Gestion de projet": true,
      "Mes outils": true,
      "Administration": true,
    };
  });

  // Sauvegarder l'état dans localStorage
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem("sidebar-open-groups", JSON.stringify(openGroups));
  }, [openGroups]);

  const toggleGroup = (groupLabel: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupLabel]: !prev[groupLabel],
    }));
  };

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    const showBadge = item.badge && item.badge > 0;

    const linkContent = (
      <NavLink
        to={item.path}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors relative",
          isActive
            ? "bg-[#2470B8] text-white"
            : "text-slate-300 hover:bg-slate-700 hover:text-white"
        )}
      >
        <div className="relative">
          <Icon className="h-5 w-5 flex-shrink-0" />
          {showBadge && collapsed && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
              {item.badge! > 9 ? "9+" : item.badge}
            </span>
          )}
        </div>
        {!collapsed && (
          <>
            <span className="truncate flex-1">{item.label}</span>
            {showBadge && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-1.5 text-xs font-bold text-white">
                {item.badge! > 99 ? "99+" : item.badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip content={showBadge ? `${item.label} (${item.badge})` : item.label} side="right">
          {linkContent}
        </Tooltip>
      );
    }

    return linkContent;
  };

  const NavGroupComponent = ({ group }: { group: NavGroup }) => {
    const filteredItems = group.items.filter(
      (item) => !item.adminOnly || isAdmin
    );

    if (filteredItems.length === 0) return null;

    const isOpen = openGroups[group.label] ?? group.defaultOpen ?? true;

    // Injecter le badge sur l'item Feedbacks pour les admins
    const itemsWithBadges = filteredItems.map((item) => {
      if (item.path === ROUTES.FEEDBACKS && isAdmin && pendingFeedbacksCount) {
        return { ...item, badge: pendingFeedbacksCount };
      }
      return item;
    });

    // En mode collapsed, afficher juste les icônes sans groupes
    if (collapsed) {
      return (
        <>
          {itemsWithBadges.map((item) => (
            <NavItemComponent key={item.path} item={item} />
          ))}
        </>
      );
    }

    return (
      <div className="space-y-1">
        <button
          onClick={() => toggleGroup(group.label)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-300 transition-colors"
        >
          <span>{group.label}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              !isOpen && "-rotate-90"
            )}
          />
        </button>
        {isOpen && (
          <div className="space-y-1">
            {itemsWithBadges.map((item) => (
              <NavItemComponent key={item.path} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-slate-800 dark:bg-slate-900 text-white transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-700 dark:border-slate-800 px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="GraphiDesk" className="h-8 w-8" />
            <span className="font-semibold">{APP_CONFIG.name}</span>
          </div>
        )}
        {collapsed && (
          <img src="/icon.svg" alt="GraphiDesk" className="mx-auto h-8 w-8 rounded-lg" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {/* Tableau de bord (seul) */}
        <NavItemComponent item={dashboardItem} />

        {/* Séparateur */}
        <div className="my-3 border-t border-slate-700 dark:border-slate-800" />

        {/* Groupes de navigation */}
        {navGroups.map((group) => (
          <NavGroupComponent key={group.label} group={group} />
        ))}

        {/* Groupe Administration (admin only) */}
        {isAdmin && (
          <>
            <div className="my-3 border-t border-slate-700 dark:border-slate-800" />
            <NavGroupComponent group={adminGroup} />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 dark:border-slate-800 p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span className="ml-2 text-sm">Réduire</span>
            </>
          )}
        </button>

        {!collapsed && (
          <div className="mt-2 text-center text-xs text-slate-500">
            v{appVersion}
          </div>
        )}
      </div>
    </aside>
  );
}
