import { useState, useMemo } from "react";
import { Palette, Search, ArrowRightLeft, Copy, Check } from "lucide-react";
import {
  ralColors,
  findRalByCode,
  searchRalByName,
  type RalColor,
} from "@/data/ralColors";

// Conversion CMYK vers RGB
function cmykToRgb(c: number, m: number, y: number, k: number) {
  const r = Math.round(255 * (1 - c / 100) * (1 - k / 100));
  const g = Math.round(255 * (1 - m / 100) * (1 - k / 100));
  const b = Math.round(255 * (1 - y / 100) * (1 - k / 100));
  return { r, g, b };
}

// Conversion RGB vers Lab (pour calcul Delta E)
function rgbToLab(r: number, g: number, b: number) {
  // Convertir RGB en XYZ
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;

  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

  const x = (rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375) / 0.95047;
  const y = (rr * 0.2126729 + gg * 0.7151522 + bb * 0.072175) / 1.0;
  const z = (rr * 0.0193339 + gg * 0.119192 + bb * 0.9503041) / 1.08883;

  const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bLab = 200 * (fy - fz);

  return { L, a, b: bLab };
}

// Calcul Delta E (CIE76) - différence perceptuelle entre deux couleurs
function calculateDeltaE(
  rgb1: { r: number; g: number; b: number },
  rgb2: { r: number; g: number; b: number }
): number {
  const lab1 = rgbToLab(rgb1.r, rgb1.g, rgb1.b);
  const lab2 = rgbToLab(rgb2.r, rgb2.g, rgb2.b);

  const deltaL = lab1.L - lab2.L;
  const deltaA = lab1.a - lab2.a;
  const deltaB = lab1.b - lab2.b;

  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

// Trouver les couleurs RAL les plus proches avec Delta E
function findClosestRalWithDeltaE(
  targetRgb: { r: number; g: number; b: number },
  limit = 10
): Array<{ color: RalColor; deltaE: number }> {
  const results = ralColors.map((color) => ({
    color,
    deltaE: calculateDeltaE(targetRgb, color.rgb),
  }));

  return results.sort((a, b) => a.deltaE - b.deltaE).slice(0, limit);
}

// Obtenir la couleur du badge Delta E
function getDeltaEColor(deltaE: number): string {
  if (deltaE < 1) return "bg-green-500";
  if (deltaE < 2) return "bg-green-400";
  if (deltaE < 3.5) return "bg-lime-500";
  if (deltaE < 5) return "bg-yellow-500";
  if (deltaE < 10) return "bg-orange-500";
  return "bg-red-500";
}

// Obtenir le texte descriptif du Delta E
function getDeltaEDescription(deltaE: number): string {
  if (deltaE < 1) return "Imperceptible";
  if (deltaE < 2) return "Très proche";
  if (deltaE < 3.5) return "Proche";
  if (deltaE < 5) return "Perceptible";
  if (deltaE < 10) return "Visible";
  return "Différent";
}

// Composant pour la comparaison côte à côte
function ColorComparison({
  sourceColor,
  sourceLabel,
  targetColor,
  deltaE,
  ralCode,
  ralName,
  onCopy,
}: {
  sourceColor: string;
  sourceLabel: string;
  targetColor: RalColor;
  deltaE: number;
  ralCode: string;
  ralName: string;
  onCopy: (value: string, type: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (value: string, type: string) => {
    navigator.clipboard.writeText(value);
    setCopied(type);
    onCopy(value, type);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Comparaison visuelle côte à côte */}
      <div className="flex">
        {/* Couleur source (CMJN) */}
        <div
          className="flex-1 h-32 flex items-center justify-center"
          style={{ backgroundColor: sourceColor }}
        >
          <span className="text-xs font-medium px-2 py-1 bg-black/20 text-white rounded">
            {sourceLabel}
          </span>
        </div>
        {/* Couleur RAL */}
        <div
          className="flex-1 h-32 flex items-center justify-center"
          style={{ backgroundColor: targetColor.hex }}
        >
          <span className="text-xs font-medium px-2 py-1 bg-black/20 text-white rounded">
            {ralCode}
          </span>
        </div>
      </div>

      {/* Badge Delta E */}
      <div className="flex justify-center -mt-4 relative z-10">
        <div
          className={`${getDeltaEColor(
            deltaE
          )} text-white px-3 py-1.5 rounded-full shadow-lg`}
        >
          <span className="font-bold">ΔE</span>{" "}
          <span className="font-mono">{deltaE.toFixed(1)}</span>
        </div>
      </div>

      {/* Informations */}
      <div className="p-4 pt-2">
        <div className="text-center mb-3">
          <p className="font-bold text-gray-900">{ralCode}</p>
          <p className="text-sm text-gray-600">{ralName}</p>
          <p className="text-xs text-gray-400 mt-1">
            {getDeltaEDescription(deltaE)}
          </p>
        </div>

        {/* Valeurs copiables */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            onClick={() => handleCopy(targetColor.hex, `hex-${ralCode}`)}
            className="flex flex-col items-center gap-1 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
          >
            <span className="text-gray-500">HEX</span>
            <span className="font-mono font-medium flex items-center gap-1">
              {targetColor.hex}
              {copied === `hex-${ralCode}` ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400" />
              )}
            </span>
          </button>
          <button
            onClick={() =>
              handleCopy(
                `${targetColor.rgb.r}, ${targetColor.rgb.g}, ${targetColor.rgb.b}`,
                `rgb-${ralCode}`
              )
            }
            className="flex flex-col items-center gap-1 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
          >
            <span className="text-gray-500">RGB</span>
            <span className="font-mono font-medium flex items-center gap-1">
              {targetColor.rgb.r},{targetColor.rgb.g},{targetColor.rgb.b}
              {copied === `rgb-${ralCode}` ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400" />
              )}
            </span>
          </button>
          <button
            onClick={() =>
              handleCopy(
                `${targetColor.cmyk.c}% ${targetColor.cmyk.m}% ${targetColor.cmyk.y}% ${targetColor.cmyk.k}%`,
                `cmyk-${ralCode}`
              )
            }
            className="flex flex-col items-center gap-1 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
          >
            <span className="text-gray-500">CMJN</span>
            <span className="font-mono font-medium flex items-center gap-1">
              {targetColor.cmyk.c}/{targetColor.cmyk.m}/{targetColor.cmyk.y}/
              {targetColor.cmyk.k}
              {copied === `cmyk-${ralCode}` ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400" />
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Composant pour afficher une carte couleur (catalogue)
function ColorCard({
  color,
  selected,
  onClick,
}: {
  color: RalColor;
  selected?: boolean;
  onClick?: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (value: string, type: string) => {
    navigator.clipboard.writeText(value);
    setCopied(type);
    setTimeout(() => setCopied(null), 1500);
  };

  const isLightColor = useMemo(() => {
    const { r, g, b } = color.rgb;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }, [color.rgb]);

  return (
    <div
      className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all hover:shadow-md ${
        selected ? "ring-2 ring-blue-500" : ""
      } ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div
        className="h-24 flex items-center justify-center"
        style={{ backgroundColor: color.hex }}
      >
        <span
          className={`text-lg font-bold ${
            isLightColor ? "text-gray-800" : "text-white"
          }`}
        >
          {color.code}
        </span>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <p className="font-medium text-gray-900 text-sm">{color.nameFr}</p>
          <p className="text-xs text-gray-500">{color.name}</p>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
            <span className="text-gray-600">HEX</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(color.hex, "hex");
              }}
              className="flex items-center gap-1 font-mono text-gray-800 hover:text-blue-600"
            >
              {color.hex}
              {copied === "hex" ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
            <span className="text-gray-600">RGB</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(
                  `${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}`,
                  "rgb"
                );
              }}
              className="flex items-center gap-1 font-mono text-gray-800 hover:text-blue-600"
            >
              {color.rgb.r}, {color.rgb.g}, {color.rgb.b}
              {copied === "rgb" ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
            <span className="text-gray-600">CMJN</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(
                  `${color.cmyk.c}% ${color.cmyk.m}% ${color.cmyk.y}% ${color.cmyk.k}%`,
                  "cmyk"
                );
              }}
              className="flex items-center gap-1 font-mono text-gray-800 hover:text-blue-600"
            >
              {color.cmyk.c}% {color.cmyk.m}% {color.cmyk.y}% {color.cmyk.k}%
              {copied === "cmyk" ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant pour l'input CMYK (sans slider)
function CmykInput({
  label,
  shortLabel,
  value,
  onChange,
  accentColor,
}: {
  label: string;
  shortLabel: string;
  value: number;
  onChange: (value: number) => void;
  accentColor: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-3 h-8 rounded-full flex-shrink-0"
        style={{ backgroundColor: accentColor }}
      />
      <label className="text-sm font-medium text-gray-700 min-w-0">
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel}</span>
      </label>
      <div className="flex items-center gap-1 ml-auto">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) =>
            onChange(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))
          }
          className="w-16 px-2 py-2 text-sm border rounded-lg text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>
    </div>
  );
}

export default function RalConverter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"ral" | "cmyk">("cmyk");
  const [cmykValues, setCmykValues] = useState({ c: 20, m: 8, y: 5, k: 80 });
  const [selectedColor, setSelectedColor] = useState<RalColor | null>(null);

  // Calcul RGB à partir de CMYK
  const sourceRgb = useMemo(
    () => cmykToRgb(cmykValues.c, cmykValues.m, cmykValues.y, cmykValues.k),
    [cmykValues]
  );

  const sourceColorCss = `rgb(${sourceRgb.r}, ${sourceRgb.g}, ${sourceRgb.b})`;

  // Résultats avec Delta E
  const cmykResultsWithDelta = useMemo(() => {
    if (searchMode === "cmyk") {
      return findClosestRalWithDeltaE(sourceRgb, 12);
    }
    return [];
  }, [sourceRgb, searchMode]);

  // Résultats de recherche RAL
  const searchResults = useMemo(() => {
    if (searchMode === "ral" && searchQuery.trim()) {
      const byCode = findRalByCode(searchQuery);
      if (byCode) return [byCode];
      return searchRalByName(searchQuery).slice(0, 20);
    }
    return [];
  }, [searchQuery, searchMode]);

  // Groupes de couleurs RAL par catégorie
  const colorGroups = useMemo(() => {
    const groups: Record<string, RalColor[]> = {
      "Jaunes (1xxx)": [],
      "Oranges (2xxx)": [],
      "Rouges (3xxx)": [],
      "Violets (4xxx)": [],
      "Bleus (5xxx)": [],
      "Verts (6xxx)": [],
      "Gris (7xxx)": [],
      "Bruns (8xxx)": [],
      "Blancs/Noirs (9xxx)": [],
    };

    ralColors.forEach((color) => {
      const code = parseInt(color.code.replace("RAL ", ""));
      if (code >= 1000 && code < 2000) groups["Jaunes (1xxx)"].push(color);
      else if (code >= 2000 && code < 3000) groups["Oranges (2xxx)"].push(color);
      else if (code >= 3000 && code < 4000) groups["Rouges (3xxx)"].push(color);
      else if (code >= 4000 && code < 5000) groups["Violets (4xxx)"].push(color);
      else if (code >= 5000 && code < 6000) groups["Bleus (5xxx)"].push(color);
      else if (code >= 6000 && code < 7000) groups["Verts (6xxx)"].push(color);
      else if (code >= 7000 && code < 8000) groups["Gris (7xxx)"].push(color);
      else if (code >= 8000 && code < 9000) groups["Bruns (8xxx)"].push(color);
      else groups["Blancs/Noirs (9xxx)"].push(color);
    });

    return groups;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 -m-6">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-pink-500 rounded-lg">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Convertisseur RAL / CMJN
              </h1>
              <p className="text-sm text-gray-500">
                Trouvez les correspondances entre couleurs RAL et valeurs CMJN
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Mode de recherche */}
        <div className="bg-white rounded-lg border shadow-sm p-4 mb-6">
          <div className="flex flex-col gap-4">
            {/* Toggle mode */}
            <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
              <button
                onClick={() => setSearchMode("cmyk")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  searchMode === "cmyk"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                CMJN vers RAL
              </button>
              <button
                onClick={() => setSearchMode("ral")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  searchMode === "ral"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Search className="w-4 h-4" />
                Catalogue RAL
              </button>
            </div>

            {/* Inputs CMYK */}
            {searchMode === "cmyk" && (
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Inputs CMYK */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                  <CmykInput
                    label="Cyan (C)"
                    shortLabel="C"
                    value={cmykValues.c}
                    onChange={(c) => setCmykValues((v) => ({ ...v, c }))}
                    accentColor="#06b6d4"
                  />
                  <CmykInput
                    label="Magenta (M)"
                    shortLabel="M"
                    value={cmykValues.m}
                    onChange={(m) => setCmykValues((v) => ({ ...v, m }))}
                    accentColor="#ec4899"
                  />
                  <CmykInput
                    label="Jaune (Y)"
                    shortLabel="Y"
                    value={cmykValues.y}
                    onChange={(y) => setCmykValues((v) => ({ ...v, y }))}
                    accentColor="#eab308"
                  />
                  <CmykInput
                    label="Noir (K)"
                    shortLabel="K"
                    value={cmykValues.k}
                    onChange={(k) => setCmykValues((v) => ({ ...v, k }))}
                    accentColor="#374151"
                  />
                </div>

                {/* Aperçu de la couleur source */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg lg:ml-4">
                  <div
                    className="w-14 h-14 rounded-lg border-2 border-white shadow-md flex-shrink-0"
                    style={{ backgroundColor: sourceColorCss }}
                  />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">Aperçu</p>
                    <p className="text-gray-500 font-mono text-xs">
                      RGB: {sourceRgb.r}, {sourceRgb.g}, {sourceRgb.b}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recherche RAL */}
            {searchMode === "ral" && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par code (ex: RAL 1015) ou nom (ex: Ivoire)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Résultats CMYK -> RAL avec comparaison */}
        {searchMode === "cmyk" && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Couleurs RAL les plus proches
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  ΔE {"<"} 2
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  ΔE {"<"} 5
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  ΔE {">"} 10
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cmykResultsWithDelta.map(({ color, deltaE }, index) => (
                <div key={color.code} className="relative">
                  {index === 0 && (
                    <div className="absolute -top-2 -left-2 z-10 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                      Meilleur match
                    </div>
                  )}
                  <ColorComparison
                    sourceColor={sourceColorCss}
                    sourceLabel={`C${cmykValues.c}/M${cmykValues.m}/Y${cmykValues.y}/K${cmykValues.k}`}
                    targetColor={color}
                    deltaE={deltaE}
                    ralCode={color.code}
                    ralName={color.nameFr}
                    onCopy={() => {}}
                  />
                </div>
              ))}
            </div>

            {/* Légende Delta E */}
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <h3 className="font-medium text-gray-800 mb-2">
                Comprendre le Delta E (ΔE)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-green-500"></span>
                  <span>{"<"} 1 : Imperceptible</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-green-400"></span>
                  <span>1-2 : Très proche</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-lime-500"></span>
                  <span>2-3.5 : Proche</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-yellow-500"></span>
                  <span>3.5-5 : Perceptible</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-orange-500"></span>
                  <span>5-10 : Visible</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-red-500"></span>
                  <span>{">"} 10 : Très différent</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Résultats de recherche RAL */}
        {searchMode === "ral" && searchQuery && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Résultats de recherche ({searchResults.length})
            </h2>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {searchResults.map((color) => (
                  <ColorCard
                    key={color.code}
                    color={color}
                    selected={selectedColor?.code === color.code}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Aucune couleur RAL trouvée pour "{searchQuery}"
              </p>
            )}
          </div>
        )}

        {/* Catalogue complet */}
        {searchMode === "ral" && !searchQuery && (
          <div className="space-y-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Catalogue RAL Classic ({ralColors.length} couleurs)
            </h2>
            {Object.entries(colorGroups).map(([groupName, colors]) => (
              <div key={groupName}>
                <h3 className="text-md font-medium text-gray-700 mb-3">
                  {groupName} ({colors.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  {colors.map((color) => (
                    <ColorCard
                      key={color.code}
                      color={color}
                      selected={selectedColor?.code === color.code}
                      onClick={() => setSelectedColor(color)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Couleur sélectionnée - détails */}
        {selectedColor && (
          <div className="fixed bottom-4 right-4 bg-white rounded-lg border shadow-lg p-4 w-80 z-20">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{selectedColor.code}</h3>
                <p className="text-sm text-gray-600">{selectedColor.nameFr}</p>
              </div>
              <button
                onClick={() => setSelectedColor(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div
              className="w-full h-16 rounded-lg mb-3"
              style={{ backgroundColor: selectedColor.hex }}
            />
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-gray-500">HEX:</span>{" "}
                <span className="font-mono">{selectedColor.hex}</span>
              </p>
              <p>
                <span className="text-gray-500">RGB:</span>{" "}
                <span className="font-mono">
                  {selectedColor.rgb.r}, {selectedColor.rgb.g},{" "}
                  {selectedColor.rgb.b}
                </span>
              </p>
              <p>
                <span className="text-gray-500">CMJN:</span>{" "}
                <span className="font-mono">
                  {selectedColor.cmyk.c}% {selectedColor.cmyk.m}%{" "}
                  {selectedColor.cmyk.y}% {selectedColor.cmyk.k}%
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
