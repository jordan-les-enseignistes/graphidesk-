import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useViewAsStore } from "@/stores/viewAsStore";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { useProfiles } from "@/hooks/useProfiles";
import { ROUTES } from "@/lib/constants";
import { getFirstName, cn } from "@/lib/utils";
import { getBadgeClassName } from "@/lib/badgeColors";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, User, ChevronDown, Eye, X } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export function Header() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();
  const { viewAsUser, isViewingAs, setViewAsUser, clearViewAs } = useViewAsStore();
  const { data: allProfiles } = useProfiles();
  // Pour le Header, on utilise realIsAdmin car on veut toujours montrer le sélecteur "Voir comme"
  // même quand l'admin est en mode simulation
  const { realIsAdmin } = useEffectiveRole();
  const isAdmin = realIsAdmin;
  // Filtrer pour ne montrer que les autres utilisateurs (pas l'admin lui-même)
  const otherUsers = allProfiles?.filter((p) => p.id !== profile?.id) ?? [];

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6">
      {/* Left side - Global Search */}
      <div className="flex-1">
        <GlobalSearch />
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <ThemeToggle />
        {/* Bannière "Vue en tant que" si active */}
        {isViewingAs && viewAsUser && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-100 border border-amber-300 px-3 py-1.5">
            <Eye className="h-4 w-4 text-amber-700" />
            <span className="text-sm font-medium text-amber-800">
              Vue : {getFirstName(viewAsUser.full_name)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-amber-700 hover:text-amber-900 hover:bg-amber-200"
              onClick={clearViewAs}
              title="Revenir à ma vue"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Sélecteur "Vue en tant que" pour admin */}
        {isAdmin && !isViewingAs && otherUsers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Voir comme...</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <DropdownMenuLabel>Voir l'app comme</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {otherUsers.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => setViewAsUser(user)}
                  className="flex items-center gap-2"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className={cn("text-xs", getBadgeClassName(user.badge_color))}>
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span>{getFirstName(user.full_name)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={cn("text-sm font-medium", getBadgeClassName(profile?.badge_color))}>
                  {profile?.initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {getFirstName(profile?.full_name) || "Utilisateur"}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={profile?.role === "admin" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {profile?.role === "admin" ? "Admin" : "Graphiste"}
                  </Badge>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400 dark:text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <DropdownMenuLabel className="dark:text-slate-200">
              <div className="flex flex-col">
                <span>{getFirstName(profile?.full_name)}</span>
                <span className="text-xs font-normal text-gray-500 dark:text-slate-400">
                  {profile?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="dark:bg-slate-700" />
            <DropdownMenuItem onClick={() => navigate(ROUTES.MON_PROFIL)} className="dark:text-slate-200 dark:hover:bg-slate-700">
              <User className="mr-2 h-4 w-4" />
              Mon profil
            </DropdownMenuItem>
            <DropdownMenuSeparator className="dark:bg-slate-700" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:text-red-400 dark:focus:text-red-400 dark:focus:bg-red-900/20"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
