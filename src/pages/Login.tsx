import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading } from "@/components/ui/loading";
import { APP_CONFIG, ROUTES } from "@/lib/constants";
import { getCurrentVersion } from "@/hooks/useAppUpdate";
import { Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react";

// Composant pour le fond animé
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Gradient de base */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />

      {/* Grandes formes animées avec mouvement */}
      <div
        className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-3xl"
        style={{
          animation: 'float 15s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-3xl"
        style={{
          animation: 'float 18s ease-in-out infinite reverse',
        }}
      />
      <div
        className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-3xl"
        style={{
          animation: 'float 12s ease-in-out infinite',
          animationDelay: '-5s',
        }}
      />

      {/* Petites particules flottantes */}
      <div className="absolute top-20 right-1/4 w-2 h-2 bg-blue-400/40 rounded-full"
           style={{ animation: 'floatSmall 8s ease-in-out infinite' }} />
      <div className="absolute top-1/3 left-20 w-3 h-3 bg-indigo-400/30 rounded-full"
           style={{ animation: 'floatSmall 10s ease-in-out infinite', animationDelay: '-3s' }} />
      <div className="absolute bottom-1/4 right-20 w-2 h-2 bg-purple-400/40 rounded-full"
           style={{ animation: 'floatSmall 7s ease-in-out infinite', animationDelay: '-2s' }} />
      <div className="absolute top-2/3 left-1/4 w-1.5 h-1.5 bg-blue-300/50 rounded-full"
           style={{ animation: 'floatSmall 9s ease-in-out infinite', animationDelay: '-4s' }} />

      {/* Grille subtile */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* CSS pour les animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -30px) scale(1.05); }
          50% { transform: translate(-20px, 20px) scale(0.95); }
          75% { transform: translate(20px, 10px) scale(1.02); }
        }
        @keyframes floatSmall {
          0%, 100% { transform: translateY(0) opacity(0.4); }
          50% { transform: translateY(-20px); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { signIn, resetPassword, loading, error } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signIn(email, password);
    if (!error) {
      navigate(ROUTES.DASHBOARD);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!email) {
      setResetError("Veuillez entrer votre adresse email");
      return;
    }

    const { error } = await resetPassword(email);
    if (error) {
      setResetError(error);
    } else {
      setResetSent(true);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <AnimatedBackground />
        <Card className="relative z-10 w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">
              Mot de passe oublié
            </CardTitle>
            <CardDescription>
              Entrez votre email pour recevoir un lien de réinitialisation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resetSent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm text-gray-600">
                  Si un compte existe avec cet email, vous recevrez un lien de
                  réinitialisation dans quelques minutes.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetSent(false);
                  }}
                  className="w-full"
                >
                  Retour à la connexion
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {resetError && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {resetError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-email">Adresse email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="vous@les-enseignistes.fr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loading size="sm" />
                  ) : (
                    "Envoyer le lien"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full"
                >
                  Retour à la connexion
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <AnimatedBackground />
      <Card className="relative z-10 w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 h-16 w-16">
            <img src="/icon.svg" alt="GraphiDesk" className="h-full w-full" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {APP_CONFIG.name}
          </CardTitle>
          <CardDescription>
            Connectez-vous à votre espace {APP_CONFIG.company}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@les-enseignistes.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Se souvenir de moi
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loading size="sm" />
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            Version {getCurrentVersion()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
