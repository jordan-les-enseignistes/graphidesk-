import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export function Loading({ size = "md", className, text }: LoadingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-blue-600 dark:text-blue-400", sizeClasses[size])} />
      {text && <p className="text-sm text-gray-500 dark:text-slate-400">{text}</p>}
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <Loading size="lg" text="Chargement..." />
    </div>
  );
}

export function LoadingOverlay({ text = "Chargement..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <Loading size="lg" text={text} />
    </div>
  );
}
