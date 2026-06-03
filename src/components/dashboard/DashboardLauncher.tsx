import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useHasPermission } from "@/hooks/useHasPermission";
import { useRoles } from "@/hooks/useRoles";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";
import { getFirstName, getContrastTextColor } from "@/lib/utils";
import {
  Building2,
  ClipboardList,
  BarChart3,
  Globe,
  BookOpen,
  UsersRound,
  Palette,
  Calculator,
  MessageSquarePlus,
  Wrench,
  Archive,
  Folders,
  FolderOpen,
  Users,
  Settings,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

interface ToolCard {
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
  permission?: string;
  color: string;
}

// Tous les outils possibles avec leur permission. On affiche ceux auxquels l'user a accès.
const TOOLS: ToolCard[] = [
  // Gestion de projet
  {
    label: "Mes Dossiers",
    description: "Mes dossiers en cours",
    icon: FolderOpen,
    path: ROUTES.MES_DOSSIERS,
    permission: "access:mes_dossiers",
    color: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300",
  },
  {
    label: "Tous les Dossiers",
    description: "Tous les dossiers de l'équipe",
    icon: Folders,
    path: ROUTES.TOUS_LES_DOSSIERS,
    permission: "access:dossiers_all",
    color: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300",
  },
  {
    label: "Archives",
    description: "Dossiers archivés",
    icon: Archive,
    path: ROUTES.ARCHIVES,
    permission: "access:archives",
    color: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  },
  {
    label: "Franchises",
    description: "Gestion des franchises",
    icon: Building2,
    path: ROUTES.FRANCHISES,
    permission: "access:franchises",
    color: "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300",
  },
  {
    label: "Projets Internes",
    description: "Projets de l'équipe",
    icon: ClipboardList,
    path: ROUTES.PROJETS_INTERNES,
    permission: "access:projets_internes",
    color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300",
  },
  {
    label: "Statistiques",
    description: "Indicateurs et tendances",
    icon: BarChart3,
    path: ROUTES.STATISTIQUES,
    permission: "access:statistiques",
    color: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300",
  },
  // Outils
  {
    label: "FabRik",
    description: "Outils de calcul de production",
    icon: Wrench,
    path: ROUTES.FABRIK,
    permission: "access:fabrik",
    color: "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300",
  },
  {
    label: "Calculatrice",
    description: "Calculs rapides",
    icon: Calculator,
    path: ROUTES.CALCULATRICE,
    permission: "access:calculatrice",
    color: "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300",
  },
  {
    label: "Nuancier",
    description: "Convertisseur RAL",
    icon: Palette,
    path: ROUTES.RAL_CONVERTER,
    permission: "access:nuancier",
    color: "bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300",
  },
  {
    label: "Sites Internet",
    description: "Coffre-fort des sites",
    icon: Globe,
    path: ROUTES.SITES_INTERNET,
    permission: "access:sites_internet",
    color: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-300",
  },
  {
    label: "Process",
    description: "Bibliothèque de process",
    icon: BookOpen,
    path: ROUTES.PROCESS,
    permission: "access:process",
    color: "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300",
  },
  {
    label: "Réunions",
    description: "Sujets à aborder",
    icon: UsersRound,
    path: ROUTES.REUNIONS,
    permission: "access:reunions",
    color: "bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300",
  },
  {
    label: "Feedbacks",
    description: "Signaler bug / suggérer",
    icon: MessageSquarePlus,
    path: ROUTES.FEEDBACKS,
    permission: "access:feedbacks",
    color: "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300",
  },
  // Admin
  {
    label: "Utilisateurs",
    description: "Gérer les comptes",
    icon: Users,
    path: ROUTES.UTILISATEURS,
    permission: "access:utilisateurs",
    color: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300",
  },
  {
    label: "Paramètres",
    description: "Configuration de l'app",
    icon: Settings,
    path: ROUTES.PARAMETRES,
    permission: "access:parametres",
    color: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
  },
];

// Composant qui rend une carte d'outil seulement si l'user a la permission
function ToolCardItem({ tool }: { tool: ToolCard }) {
  const allowed = useHasPermission(tool.permission ?? "");
  // Si pas de permission requise, toujours montrer (cas hypothétique)
  if (tool.permission && !allowed) return null;

  const Icon = tool.icon;

  return (
    <Link to={tool.path} className="block">
      <Card className="h-full hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer border border-gray-200 dark:border-slate-700">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg shrink-0 ${tool.color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">{tool.label}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{tool.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardLauncher() {
  const profile = useAuthStore((state) => state.profile);
  const { data: allRoles } = useRoles();
  const currentRole = profile?.role_id
    ? allRoles?.find((r) => r.id === profile.role_id)
    : null;

  return (
    <div className="space-y-6">
      {/* Header personnalisé */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
            <LayoutDashboard className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Bonjour, {getFirstName(profile?.full_name) || "utilisateur"} !
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Bienvenue sur ton espace.
              </p>
              {currentRole && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: currentRole.couleur,
                    color: getContrastTextColor(currentRole.couleur),
                  }}
                >
                  {currentRole.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grille des outils accessibles */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3">
          Mes outils
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <ToolCardItem key={tool.path} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  );
}
