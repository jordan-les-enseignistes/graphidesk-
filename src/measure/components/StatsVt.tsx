import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import type { MeasureProjectRow } from "../persistence/projects";
import { formatDate } from "@/lib/utils";

/**
 * Stats de précision des mesures photo (vue ADMIN uniquement).
 * Compare les cotes provisoires (homographie) aux cotes réelles saisies
 * après visite technique, sur tous les projets visibles (RLS : l'admin
 * voit tout le monde).
 *
 * Paliers MÉTIER en mm ABSOLUS (la tolérance de fab ne dépend pas de la
 * taille de la vitrine) : < 10 mm vert · 10-50 mm ambre · > 50 mm rouge.
 *
 * ⚠️ Lecture : les champs VT sont préremplis avec la cote provisoire —
 * une cote non corrigée par le poseur compte donc comme « sans écart ».
 * Les écarts ≤ 2 mm sont isolés pour cette raison.
 */

// paliers métier (mm absolus)
const SEUIL_VERT_MM = 10;
const SEUIL_AMBRE_MM = 50;
// en-dessous : indistinguable d'une cote non vérifiée (champs préremplis)
const SEUIL_CORRIGEE_MM = 2;

interface DeltaPoint {
  projet: string;
  date: string;
  zone: string;
  vitrage: boolean;
  axe: "L" | "H";
  prov: number;
  vt: number;
  deltaMm: number; // vt - prov
  pct: number; // |delta| / vt * 100 (info secondaire)
}

function collectDeltas(projects: MeasureProjectRow[]): DeltaPoint[] {
  const out: DeltaPoint[] = [];
  for (const p of projects) {
    if (!p.vt_dims) continue;
    for (const z of p.doc?.zones ?? []) {
      const v = p.vt_dims[z.id];
      if (!v) continue;
      const axes: Array<["L" | "H", number, number]> = [];
      if (v.widthMm > 0 && z.widthMm > 0) axes.push(["L", z.widthMm, v.widthMm]);
      if (v.heightMm > 0 && z.heightMm > 0) axes.push(["H", z.heightMm, v.heightMm]);
      for (const [axe, provRaw, vt] of axes) {
        const prov = Math.round(provRaw);
        out.push({
          projet: p.nom,
          date: p.updated_at,
          zone: z.label,
          vitrage: z.fill === "vitrage",
          axe,
          prov,
          vt,
          deltaMm: vt - prov,
          pct: (Math.abs(vt - prov) / vt) * 100,
        });
      }
    }
  }
  return out;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** couleur d'un écart en mm absolus, selon les paliers métier */
function mmColor(absMm: number): string {
  return absMm < SEUIL_VERT_MM
    ? "text-emerald-600 dark:text-emerald-400"
    : absMm < SEUIL_AMBRE_MM
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
        {label}
      </p>
      <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

function subsetStats(points: DeltaPoint[]) {
  const corrected = points.filter((d) => Math.abs(d.deltaMm) > SEUIL_CORRIGEE_MM);
  return {
    n: points.length,
    nCorrected: corrected.length,
    meanAbsMm: mean(corrected.map((d) => Math.abs(d.deltaMm))),
    medianAbsMm: median(corrected.map((d) => Math.abs(d.deltaMm))),
  };
}

export function StatsVt({ projects }: { projects: MeasureProjectRow[] }) {
  const deltas = useMemo(() => collectDeltas(projects), [projects]);

  const withVt = useMemo(() => new Set(deltas.map((d) => d.projet)).size, [deltas]);

  const global = subsetStats(deltas);
  const vitrage = subsetStats(deltas.filter((d) => d.vitrage));
  const autres = subsetStats(deltas.filter((d) => !d.vitrage));
  const largeurs = subsetStats(deltas.filter((d) => d.axe === "L"));
  const hauteurs = subsetStats(deltas.filter((d) => d.axe === "H"));

  const buckets = useMemo(() => {
    const corrected = deltas.filter((d) => Math.abs(d.deltaMm) > SEUIL_CORRIGEE_MM);
    return {
      exact: deltas.length - corrected.length,
      vert: corrected.filter((d) => Math.abs(d.deltaMm) < SEUIL_VERT_MM).length,
      ambre: corrected.filter(
        (d) => Math.abs(d.deltaMm) >= SEUIL_VERT_MM && Math.abs(d.deltaMm) < SEUIL_AMBRE_MM
      ).length,
      rouge: corrected.filter((d) => Math.abs(d.deltaMm) >= SEUIL_AMBRE_MM).length,
    };
  }, [deltas]);

  const worst = useMemo(
    () => [...deltas].sort((a, b) => Math.abs(b.deltaMm) - Math.abs(a.deltaMm)).slice(0, 10),
    [deltas]
  );

  const perProject = useMemo(() => {
    const map = new Map<string, { date: string; points: DeltaPoint[] }>();
    for (const d of deltas) {
      if (!map.has(d.projet)) map.set(d.projet, { date: d.date, points: [] });
      map.get(d.projet)!.points.push(d);
    }
    return [...map.entries()]
      .map(([nom, { date, points }]) => {
        const corrected = points.filter((p) => Math.abs(p.deltaMm) > SEUIL_CORRIGEE_MM);
        return {
          nom,
          date,
          n: points.length,
          corrected: corrected.length,
          meanAbsMm: mean(corrected.map((p) => Math.abs(p.deltaMm))),
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [deltas]);

  if (deltas.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Pas encore de cotes VT saisies — les statistiques de précision apparaîtront ici dès
        que des projets auront reçu leurs cotes réelles.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vue d'ensemble */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Cotes comparées"
          value={String(global.n)}
          hint={`${withVt} projet(s) avec VT`}
        />
        <StatTile
          label="Cotes corrigées par le poseur"
          value={`${global.nCorrected} (${global.n ? Math.round((global.nCorrected / global.n) * 100) : 0}%)`}
          hint={`écart > ${SEUIL_CORRIGEE_MM} mm vs provisoire`}
        />
        <StatTile
          label="Écart moyen (corrigées)"
          value={`${global.meanAbsMm.toFixed(0)} mm`}
          hint="moyenne des écarts absolus"
        />
        <StatTile
          label="Écart médian"
          value={`${global.medianAbsMm.toFixed(0)} mm`}
          hint="la moitié des corrections font moins"
        />
      </div>

      {/* Répartition */}
      <Card className="p-4 space-y-2">
        <h4 className="text-sm font-medium dark:text-slate-200">
          Répartition des écarts (paliers fab : {SEUIL_VERT_MM} / {SEUIL_AMBRE_MM} mm)
        </h4>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          {global.n > 0 && (
            <>
              <div
                className="bg-slate-400"
                style={{ width: `${(buckets.exact / global.n) * 100}%` }}
                title={`Sans écart (≤${SEUIL_CORRIGEE_MM}mm) : ${buckets.exact}`}
              />
              <div
                className="bg-emerald-500"
                style={{ width: `${(buckets.vert / global.n) * 100}%` }}
                title={`< ${SEUIL_VERT_MM} mm : ${buckets.vert}`}
              />
              <div
                className="bg-amber-500"
                style={{ width: `${(buckets.ambre / global.n) * 100}%` }}
                title={`${SEUIL_VERT_MM}-${SEUIL_AMBRE_MM} mm : ${buckets.ambre}`}
              />
              <div
                className="bg-red-500"
                style={{ width: `${(buckets.rouge / global.n) * 100}%` }}
                title={`> ${SEUIL_AMBRE_MM} mm : ${buckets.rouge}`}
              />
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-slate-400">
          <span>⬜ Sans écart ≤{SEUIL_CORRIGEE_MM}mm : {buckets.exact}</span>
          <span className="text-emerald-600 dark:text-emerald-400">
            🟩 &lt; {SEUIL_VERT_MM} mm : {buckets.vert}
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            🟨 {SEUIL_VERT_MM}-{SEUIL_AMBRE_MM} mm : {buckets.ambre}
          </span>
          <span className="text-red-600 dark:text-red-400">
            🟥 &gt; {SEUIL_AMBRE_MM} mm : {buckets.rouge}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-slate-500">
          ⚠ Les champs VT sont préremplis avec la cote provisoire : une cote non corrigée par
          le poseur compte comme « sans écart » — impossible de distinguer « confirmée juste »
          de « non vérifiée ».
        </p>
      </Card>

      {/* Par catégorie */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4 space-y-1.5">
          <h4 className="text-sm font-medium dark:text-slate-200">Par type de zone</h4>
          <table className="w-full text-xs">
            <tbody className="dark:text-slate-300">
              <tr>
                <td className="py-1">Vitrages</td>
                <td className="text-right font-mono">{vitrage.n} cotes</td>
                <td className={`text-right font-mono ${mmColor(vitrage.meanAbsMm)}`}>
                  {vitrage.nCorrected > 0 ? `${vitrage.meanAbsMm.toFixed(0)} mm` : "—"}
                </td>
              </tr>
              <tr>
                <td className="py-1">Autres (bandeaux, façade...)</td>
                <td className="text-right font-mono">{autres.n} cotes</td>
                <td className={`text-right font-mono ${mmColor(autres.meanAbsMm)}`}>
                  {autres.nCorrected > 0 ? `${autres.meanAbsMm.toFixed(0)} mm` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
        <Card className="p-4 space-y-1.5">
          <h4 className="text-sm font-medium dark:text-slate-200">Par axe</h4>
          <table className="w-full text-xs">
            <tbody className="dark:text-slate-300">
              <tr>
                <td className="py-1">Largeurs</td>
                <td className="text-right font-mono">{largeurs.n} cotes</td>
                <td className={`text-right font-mono ${mmColor(largeurs.meanAbsMm)}`}>
                  {largeurs.nCorrected > 0 ? `${largeurs.meanAbsMm.toFixed(0)} mm` : "—"}
                </td>
              </tr>
              <tr>
                <td className="py-1">Hauteurs</td>
                <td className="text-right font-mono">{hauteurs.n} cotes</td>
                <td className={`text-right font-mono ${mmColor(hauteurs.meanAbsMm)}`}>
                  {hauteurs.nCorrected > 0 ? `${hauteurs.meanAbsMm.toFixed(0)} mm` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      {/* Pires écarts */}
      <Card className="p-4 space-y-2">
        <h4 className="text-sm font-medium dark:text-slate-200">
          Plus gros écarts (à étudier : photo de biais, mauvaise référence...)
        </h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 dark:text-slate-500">
              <th className="py-1 font-medium">Projet</th>
              <th className="font-medium">Zone</th>
              <th className="font-medium">Axe</th>
              <th className="text-right font-medium">Provisoire</th>
              <th className="text-right font-medium">VT</th>
              <th className="text-right font-medium">Écart</th>
            </tr>
          </thead>
          <tbody className="dark:text-slate-300">
            {worst.map((d, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1 truncate max-w-[180px]">{d.projet}</td>
                <td>{d.zone}</td>
                <td>{d.axe}</td>
                <td className="text-right font-mono">{d.prov} mm</td>
                <td className="text-right font-mono">{d.vt} mm</td>
                <td className={`text-right font-mono ${mmColor(Math.abs(d.deltaMm))}`}>
                  {d.deltaMm > 0 ? "+" : ""}
                  {d.deltaMm} mm ({d.pct.toFixed(1)} %)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Par projet */}
      <Card className="p-4 space-y-2">
        <h4 className="text-sm font-medium dark:text-slate-200">Par projet</h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 dark:text-slate-500">
              <th className="py-1 font-medium">Projet</th>
              <th className="font-medium">Date</th>
              <th className="text-right font-medium">Cotes</th>
              <th className="text-right font-medium">Corrigées</th>
              <th className="text-right font-medium">Écart moyen</th>
            </tr>
          </thead>
          <tbody className="dark:text-slate-300">
            {perProject.map((p) => (
              <tr key={p.nom} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1 truncate max-w-[220px]">{p.nom}</td>
                <td>{formatDate(p.date)}</td>
                <td className="text-right font-mono">{p.n}</td>
                <td className="text-right font-mono">{p.corrected}</td>
                <td className={`text-right font-mono ${mmColor(p.meanAbsMm)}`}>
                  {p.corrected > 0 ? `${p.meanAbsMm.toFixed(0)} mm` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
