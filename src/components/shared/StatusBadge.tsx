import { cn } from "@/lib/utils";
import { STATUT_MAP, type Statut } from "@/lib/constants";
import { useStatuts } from "@/hooks/useStatuts";
import {
  Circle,
  Clock,
  Pause,
  PauseCircle,
  AlertTriangle,
  Building,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  Hourglass,
  Flag,
  Star,
  Zap,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Circle,
  Clock,
  Pause,
  PauseCircle,
  AlertTriangle,
  Building,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  Hourglass,
  Flag,
  Star,
  Zap,
};

interface StatusBadgeProps {
  statut: string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ statut, className, showIcon = true }: StatusBadgeProps) {
  // Utiliser les statuts dynamiques depuis la base de données
  const { data: dynamicStatuts } = useStatuts();

  // Chercher d'abord dans les statuts dynamiques, puis dans les constantes en fallback
  const dynamicConfig = dynamicStatuts?.find((s) => s.value === statut);
  const staticConfig = STATUT_MAP[statut as Statut];

  // Priorité aux statuts dynamiques
  const config = dynamicConfig || staticConfig;

  if (!config) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
          "bg-gray-100 text-gray-800 border-gray-200",
          className
        )}
      >
        {statut}
      </span>
    );
  }

  const Icon = iconMap[config.icon as keyof typeof iconMap];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        config.color,
        className
      )}
    >
      {showIcon && Icon && <Icon className="h-3 w-3 flex-shrink-0" />}
      {config.label}
    </span>
  );
}
