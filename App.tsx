import { useState, useEffect, useCallback, useMemo } from "react";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BackgroundParticles } from "@/components/background-particles";
import { BottomNav } from "@/components/bottom-nav";
import { HomePage } from "@/pages/home";
import { AuthPage } from "@/pages/auth";
import { SmartHomePage } from "@/pages/smart-home";
import { FinancePage } from "@/pages/finance";
import { CalendarPage } from "@/pages/calendar";
import { SettingsPage } from "@/pages/settings";
import { WeatherPage } from "@/pages/weather";
import { TranslatePage } from "@/pages/translate";
import { RemindersPage } from "@/pages/reminders";
import { NewsPage } from "@/pages/news";
import { MoodPage } from "@/pages/mood";
import { VoiceSettingsPage } from "@/pages/voice-settings";
import { DirectivesPage } from "@/pages/directives";
import { UsersPage } from "@/pages/users";
import { MusicPage } from "@/pages/music";
import { HealthPage } from "@/pages/health";
import { TipsPage } from "@/pages/tips";
import { BackupPage } from "@/pages/backup";
import { ThemesPage, loadSavedTheme } from "@/pages/themes";
import { VoiceNotesPage } from "@/pages/voice-notes";
import { IdePage } from "@/pages/ide";
import { SecurityPage } from "@/pages/security";
import { SubscriptionPage } from "@/pages/subscription";
import { FamilyPage } from "@/pages/family";

loadSavedTheme();

interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  gender?: string;
  twoFactorEnabled?: boolean;
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [activeSection, setActiveSection] = useState("home");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/user`);
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch {
      console.log("Not authenticated");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
    setActiveSection("home");
  };

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/logout`, { method: "POST" });
    } catch {
      console.log("Logout error");
    }
    setUser(null);
    setActiveSection("home");
  };

  const handleNavigate = useCallback((section: string) => {
    setActiveSection(section);
  }, []);

  const PageLoader = useMemo(() => (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground mt-2 text-sm">Загрузка...</p>
      </div>
    </div>
  ), []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-4xl font-black text-gradient animate-pulse">
            JARVOICE
          </h1>
          <p className="text-muted-foreground mt-2">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <BackgroundParticles />
        <AuthPage onLogin={handleLogin} />
      </>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case "home":
        return <HomePage user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
      case "smarthome":
        return <SmartHomePage />;
      case "finance":
        return <FinancePage />;
      case "calendar":
        return <CalendarPage />;
      case "settings":
        return <SettingsPage user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
      case "weather":
        return <WeatherPage />;
      case "translate":
        return <TranslatePage />;
      case "reminders":
        return <RemindersPage />;
      case "news":
        return <NewsPage />;
      case "mood":
        return <MoodPage />;
      case "voicesettings":
        return <VoiceSettingsPage />;
      case "directives":
        return <DirectivesPage />;
      case "users":
        return <UsersPage />;
      case "music":
        return <MusicPage />;
      case "health":
        return <HealthPage />;
      case "tips":
        return <TipsPage />;
      case "backup":
        return <BackupPage />;
      case "themes":
        return <ThemesPage />;
      case "voicenotes":
        return <VoiceNotesPage />;
      case "ide":
        return user.role === "owner" ? <IdePage /> : <HomePage user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
      case "security":
        return <SecurityPage user={user} onNavigate={handleNavigate} />;
      case "subscription":
        return <SubscriptionPage onNavigate={handleNavigate} />;
      case "family":
        return <FamilyPage user={user} onNavigate={handleNavigate} />;
      case "notifications":
        // Уведомления в разработке - перенаправляем на напоминания
        return <RemindersPage />;
      default:
        return <HomePage user={user} onNavigate={handleNavigate} onLogout={handleLogout} />;
    }
  };

  return (
    <>
      <BackgroundParticles />
      <div className="min-h-screen pb-20" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="max-w-lg mx-auto p-4">
          <div key={activeSection} className="page-transition">
            {renderSection()}
          </div>
        </div>
      </div>
      <BottomNav activeSection={activeSection} onNavigate={handleNavigate} />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
