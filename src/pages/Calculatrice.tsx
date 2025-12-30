import { useState } from "react";
import { Calculator, RotateCcw, Square, Building2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Unit = "mm" | "cm" | "m";

interface Enseigne {
  id: number;
  nom: string;
  largeur: string;
  hauteur: string;
  uniteLargeur: Unit;
  uniteHauteur: Unit;
}

const unitOptions = [
  { value: "mm", label: "mm" },
  { value: "cm", label: "cm" },
  { value: "m", label: "m" },
];

// Convertir une valeur vers des metres
function toMeters(value: number, unit: Unit): number {
  switch (unit) {
    case "mm":
      return value / 1000;
    case "cm":
      return value / 100;
    case "m":
      return value;
    default:
      return value;
  }
}

export default function Calculatrice() {
  // Calculateur de m²
  const [largeur, setLargeur] = useState<string>("");
  const [hauteur, setHauteur] = useState<string>("");
  const [uniteLargeur, setUniteLargeur] = useState<Unit>("mm");
  const [uniteHauteur, setUniteHauteur] = useState<Unit>("mm");
  const [limiteM2, setLimiteM2] = useState<string>("");

  // Calcul du m²
  const calculerSurface = (): number | null => {
    const l = parseFloat(largeur);
    const h = parseFloat(hauteur);
    if (isNaN(l) || isNaN(h) || l <= 0 || h <= 0) return null;

    const largeurM = toMeters(l, uniteLargeur);
    const hauteurM = toMeters(h, uniteHauteur);
    return largeurM * hauteurM;
  };

  const surfaceM2 = calculerSurface();

  // Verification de la limite
  const limite = parseFloat(limiteM2);
  const depasseLimite = surfaceM2 !== null && !isNaN(limite) && limite > 0 && surfaceM2 > limite;
  const sousLimite = surfaceM2 !== null && !isNaN(limite) && limite > 0 && surfaceM2 <= limite;

  const resetCalculM2 = () => {
    setLargeur("");
    setHauteur("");
    setLimiteM2("");
  };

  // Calculateur de façade
  const [surfaceFacade, setSurfaceFacade] = useState<string>("");
  const [pourcentageAutorise, setPourcentageAutorise] = useState<string>("");
  const [enseignes, setEnseignes] = useState<Enseigne[]>([
    { id: 1, nom: "Enseigne 1", largeur: "", hauteur: "", uniteLargeur: "mm", uniteHauteur: "mm" }
  ]);

  const ajouterEnseigne = () => {
    const newId = enseignes.length > 0 ? Math.max(...enseignes.map(e => e.id)) + 1 : 1;
    setEnseignes([...enseignes, {
      id: newId,
      nom: `Enseigne ${newId}`,
      largeur: "",
      hauteur: "",
      uniteLargeur: "mm",
      uniteHauteur: "mm"
    }]);
  };

  const supprimerEnseigne = (id: number) => {
    if (enseignes.length > 1) {
      setEnseignes(enseignes.filter(e => e.id !== id));
    }
  };

  const updateEnseigne = (id: number, field: keyof Enseigne, value: string) => {
    setEnseignes(enseignes.map(e =>
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const calculerSurfaceEnseigne = (enseigne: Enseigne): number | null => {
    const l = parseFloat(enseigne.largeur);
    const h = parseFloat(enseigne.hauteur);
    if (isNaN(l) || isNaN(h) || l <= 0 || h <= 0) return null;
    return toMeters(l, enseigne.uniteLargeur) * toMeters(h, enseigne.uniteHauteur);
  };

  const surfaceFacadeNum = parseFloat(surfaceFacade);
  const pourcentageNum = parseFloat(pourcentageAutorise);
  const surfaceAutorisee = !isNaN(surfaceFacadeNum) && !isNaN(pourcentageNum) && surfaceFacadeNum > 0 && pourcentageNum > 0
    ? (surfaceFacadeNum * pourcentageNum) / 100
    : null;

  const surfaceTotaleEnseignes = enseignes.reduce((total, ens) => {
    const surface = calculerSurfaceEnseigne(ens);
    return total + (surface || 0);
  }, 0);

  const depasseFacade = surfaceAutorisee !== null && surfaceTotaleEnseignes > surfaceAutorisee;
  const restantM2 = surfaceAutorisee !== null ? surfaceAutorisee - surfaceTotaleEnseignes : null;

  const resetFacade = () => {
    setSurfaceFacade("");
    setPourcentageAutorise("");
    setEnseignes([{ id: 1, nom: "Enseigne 1", largeur: "", hauteur: "", uniteLargeur: "mm", uniteHauteur: "mm" }]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="h-7 w-7 text-blue-600" />
            Calculatrice
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Outils de calcul pour le quotidien
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Calculateur de m² */}
        <Card className="border-blue-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Square className="h-5 w-5 text-blue-600" />
              Calcul de surface (m²)
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Calculer la surface en m² et vérifier les limites mairie
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Largeur */}
            <div className="space-y-2">
              <Label htmlFor="largeur">Largeur</Label>
              <div className="flex gap-2">
                <Input
                  id="largeur"
                  type="number"
                  placeholder="Ex: 1500"
                  value={largeur}
                  onChange={(e) => setLargeur(e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={uniteLargeur}
                  onChange={(e) => setUniteLargeur(e.target.value as Unit)}
                  options={unitOptions}
                  className="w-20"
                />
              </div>
            </div>

            {/* Hauteur */}
            <div className="space-y-2">
              <Label htmlFor="hauteur">Hauteur</Label>
              <div className="flex gap-2">
                <Input
                  id="hauteur"
                  type="number"
                  placeholder="Ex: 500"
                  value={hauteur}
                  onChange={(e) => setHauteur(e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={uniteHauteur}
                  onChange={(e) => setUniteHauteur(e.target.value as Unit)}
                  options={unitOptions}
                  className="w-20"
                />
              </div>
            </div>

            {/* Limite mairie (optionnel) */}
            <div className="space-y-2">
              <Label htmlFor="limite" className="text-gray-500">
                Limite mairie (optionnel)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="limite"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 0.75"
                  value={limiteM2}
                  onChange={(e) => setLimiteM2(e.target.value)}
                  className="flex-1"
                />
                <span className="flex items-center px-3 text-sm text-gray-500 bg-gray-100 rounded-md border">
                  m²
                </span>
              </div>
            </div>

            {/* Resultat */}
            {surfaceM2 !== null && (
              <div
                className={cn(
                  "p-4 rounded-lg border-2 text-center",
                  depasseLimite
                    ? "bg-red-50 border-red-300"
                    : sousLimite
                    ? "bg-green-50 border-green-300"
                    : "bg-blue-50 border-blue-300"
                )}
              >
                <p className="text-sm text-gray-600 mb-1">Surface totale</p>
                <p
                  className={cn(
                    "text-3xl font-bold",
                    depasseLimite
                      ? "text-red-600"
                      : sousLimite
                      ? "text-green-600"
                      : "text-blue-600"
                  )}
                >
                  {surfaceM2.toFixed(4)} m²
                </p>
                {depasseLimite && (
                  <p className="text-sm text-red-600 mt-2 font-medium">
                    Dépasse la limite de {limite} m² !
                  </p>
                )}
                {sousLimite && (
                  <p className="text-sm text-green-600 mt-2 font-medium">
                    OK - Dans la limite de {limite} m²
                  </p>
                )}
              </div>
            )}

            {/* Reset */}
            <Button
              variant="outline"
              size="sm"
              onClick={resetCalculM2}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser
            </Button>
          </CardContent>
        </Card>

        {/* Calculateur de façade */}
        <Card className="border-orange-200 md:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-orange-600" />
              Calcul façade mairie
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Vérifier si vos enseignes respectent le % autorisé sur la façade
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Infos façade */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="surfaceFacade">Surface façade (m²)</Label>
                <Input
                  id="surfaceFacade"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 45"
                  value={surfaceFacade}
                  onChange={(e) => setSurfaceFacade(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pourcentage">% autorisé</Label>
                <div className="flex gap-2">
                  <Input
                    id="pourcentage"
                    type="number"
                    step="0.1"
                    placeholder="Ex: 15"
                    value={pourcentageAutorise}
                    onChange={(e) => setPourcentageAutorise(e.target.value)}
                    className="flex-1"
                  />
                  <span className="flex items-center px-3 text-sm text-gray-500 bg-gray-100 rounded-md border">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Surface autorisée */}
            {surfaceAutorisee !== null && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-gray-600">
                  Surface autorisée : <span className="font-bold text-orange-600">{surfaceAutorisee.toFixed(2)} m²</span>
                </p>
              </div>
            )}

            {/* Liste des enseignes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Enseignes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={ajouterEnseigne}
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>

              {enseignes.map((enseigne) => {
                const surface = calculerSurfaceEnseigne(enseigne);
                return (
                  <div
                    key={enseigne.id}
                    className="p-3 border rounded-lg bg-gray-50 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={enseigne.nom}
                        onChange={(e) => updateEnseigne(enseigne.id, "nom", e.target.value)}
                        className="flex-1 font-medium bg-white"
                        placeholder="Nom de l'enseigne"
                      />
                      {enseignes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => supprimerEnseigne(enseigne.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          placeholder="Largeur"
                          value={enseigne.largeur}
                          onChange={(e) => updateEnseigne(enseigne.id, "largeur", e.target.value)}
                          className="flex-1 bg-white"
                        />
                        <Select
                          value={enseigne.uniteLargeur}
                          onChange={(e) => updateEnseigne(enseigne.id, "uniteLargeur", e.target.value)}
                          options={unitOptions}
                          className="w-16"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          placeholder="Hauteur"
                          value={enseigne.hauteur}
                          onChange={(e) => updateEnseigne(enseigne.id, "hauteur", e.target.value)}
                          className="flex-1 bg-white"
                        />
                        <Select
                          value={enseigne.uniteHauteur}
                          onChange={(e) => updateEnseigne(enseigne.id, "uniteHauteur", e.target.value)}
                          options={unitOptions}
                          className="w-16"
                        />
                      </div>
                    </div>
                    {surface !== null && (
                      <p className="text-sm text-gray-600">
                        Surface : <span className="font-medium">{surface.toFixed(4)} m²</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Résultat global */}
            {surfaceAutorisee !== null && surfaceTotaleEnseignes > 0 && (
              <div
                className={cn(
                  "p-4 rounded-lg border-2 text-center",
                  depasseFacade
                    ? "bg-red-50 border-red-300"
                    : "bg-green-50 border-green-300"
                )}
              >
                <p className="text-sm text-gray-600 mb-1">Total enseignes</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    depasseFacade ? "text-red-600" : "text-green-600"
                  )}
                >
                  {surfaceTotaleEnseignes.toFixed(4)} m²
                </p>
                {restantM2 !== null && (
                  <p
                    className={cn(
                      "text-sm mt-2 font-medium",
                      depasseFacade ? "text-red-600" : "text-green-600"
                    )}
                  >
                    {depasseFacade
                      ? `Dépassement de ${Math.abs(restantM2).toFixed(4)} m² !`
                      : `Reste disponible : ${restantM2.toFixed(4)} m²`}
                  </p>
                )}
              </div>
            )}

            {/* Reset */}
            <Button
              variant="outline"
              size="sm"
              onClick={resetFacade}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
