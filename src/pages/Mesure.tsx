import { Ruler } from "lucide-react";
import { MeasureApp } from "@/measure/MeasureApp";

export default function Mesure() {
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40">
            <Ruler className="h-5 w-5 text-teal-600 dark:text-teal-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Mesure photo
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Dimensions provisoires de vitrines et façades à partir d'une photo
            </p>
          </div>
        </div>
        <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
          Provisoire — à confirmer en visite technique
        </span>
      </div>

      <MeasureApp />
    </div>
  );
}
