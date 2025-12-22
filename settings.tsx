import { useState, useEffect } from "react";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
import { 
  Calendar, Heart, Music, Languages, Home, Bell, Cloud, 
  Mic, Scroll, Users, LogOut, User, Mail, Shield, Activity,
  Lightbulb, Download, Palette, Newspaper, AudioLines, Code, BellRing, ShieldCheck,
  ExternalLink, RefreshCw, Loader2, Unlink, CheckCircle2, XCircle, Crown
} from "lucide-react";
import { SiTelegram } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { 
  isPushSupported, 
  getNotificationPermission, 
  subscribeToPush, 
  unsubscribeFromPush,
  isCurrentlySubscribed
} from "@/lib/push-notifications";

interface SettingsPageProps {
  user: { username: string; email?: string; role: string } | null;
  onNavigate: (section: string) => void;
  onLogout: () => void;
}

const menuItems = [
  { id: "subscription", label: "Подписка", icon: Crown },
  { id: "calendar", label: "Календарь", icon: Calendar },
  { id: "mood", label: "Настроение", icon: Heart },
  // { id: "music", label: "Музыка", icon: Music }, // Скрыто - нет реального воспроизведения
  { id: "health", label: "Здоровье", icon: Activity },
  { id: "translate", label: "Перевод", icon: Languages },
  { id: "smarthome", label: "Умный дом", icon: Home },
  { id: "reminders", label: "Напоминания", icon: Bell },
  { id: "weather", label: "Погода", icon: Cloud },
  { id: "voicenotes", label: "Заметки", icon: AudioLines },
  { id: "voicesettings", label: "Голос", icon: Mic },
  { id: "news", label: "Новости", icon: Newspaper },
  { id: "tips", label: "Советы", icon: Lightbulb },
  { id: "themes", label: "Оформление", icon: Palette },
  { id: "backup", label: "Бэкап", icon: Download },
];

const ownerItems = [
  { id: "directives", label: "Директивы", icon: Scroll },
  { id: "users", label: "Пользователи", icon: Users },
  { id: "ide", label: "IDE Разработка", icon: Code },
];

const roleNames: Record<string, string> = {
  owner: "Владелец",
  family: "Семья",
  user: "Пользователь",
};

export function SettingsPage({ user, onNavigate, onLogout }: SettingsPageProps) {
  const isOwner = user?.role === "owner";
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string>("default");
  
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramCode, setTelegramCode] = useState("");
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramStatusLoading, setTelegramStatusLoading] = useState(true);
  
  const { toast } = useToast();

  useEffect(() => {
    const checkPushStatus = async () => {
      const supported = isPushSupported();
      setPushSupported(supported);
      
      if (supported) {
        const permission = getNotificationPermission();
        setPermissionStatus(permission);
        
        const subscribed = await isCurrentlySubscribed();
        setPushEnabled(subscribed && permission === "granted");
      }
    };
    
    checkPushStatus();
    checkTelegramStatus();
  }, []);

  const checkTelegramStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/telegram/status`);
      const data = await response.json();
      setTelegramLinked(data.linked);
      // Also set the link code if available
      if (data.linkCode) {
        setTelegramCode(data.linkCode);
      }
    } catch {
      console.error("Failed to check Telegram status");
    } finally {
      setTelegramStatusLoading(false);
    }
  };

  const generateTelegramCode = async () => {
    setTelegramLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/telegram/generate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.linkCode || data.code) {
        setTelegramCode(data.linkCode || data.code);
        toast({
          title: "Код создан",
          description: "Отправьте этот код боту в Telegram",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сгенерировать код",
      });
    } finally {
      setTelegramLoading(false);
    }
  };

  const unlinkTelegram = async () => {
    setTelegramLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/telegram/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.success) {
        setTelegramLinked(false);
        setTelegramCode("");
        toast({
          title: "Telegram отключён",
          description: "Вы больше не будете получать уведомления в Telegram",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось отключить Telegram",
      });
    } finally {
      setTelegramLoading(false);
    }
  };

  const handlePushToggle = async (enabled: boolean) => {
    setPushLoading(true);
    try {
      if (enabled) {
        const success = await subscribeToPush();
        setPushEnabled(success);
        if (success) {
          setPermissionStatus("granted");
        }
      } else {
        await unsubscribeFromPush();
        setPushEnabled(false);
      }
    } catch (error) {
      console.error("Push toggle error:", error);
    } finally {
      setPushLoading(false);
    }
  };

  const getPermissionText = () => {
    if (!pushSupported) return "Не поддерживается";
    if (permissionStatus === "granted") return pushEnabled ? "Включены" : "Отключены";
    if (permissionStatus === "denied") return "Заблокированы";
    return "Не настроены";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-primary" data-testid="text-settings-title">
          Настройки
        </h1>
        <p className="text-muted-foreground text-sm">Профиль и разделы</p>
      </div>

      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Профиль
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-medium" data-testid="text-profile-username">
                {user?.username || "Гость"}
              </div>
              <div className="text-sm text-primary" data-testid="text-profile-role">
                {roleNames[user?.role || "user"]}
              </div>
            </div>
          </div>
          
          {user?.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span data-testid="text-profile-email">{user.email}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Уровень доступа: {roleNames[user?.role || "user"]}</span>
          </div>

          <Button
            variant="outline"
            className="w-full justify-start gap-2 mt-3"
            onClick={() => onNavigate("security")}
            data-testid="button-security-settings"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            Безопасность и 2FA
          </Button>
        </CardContent>
      </Card>

      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" />
            Push-уведомления
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Уведомления о напоминаниях</p>
              <p className="text-xs text-muted-foreground">
                Статус: {getPermissionText()}
              </p>
            </div>
            <Switch
              checked={pushEnabled}
              onCheckedChange={handlePushToggle}
              disabled={!pushSupported || pushLoading || permissionStatus === "denied"}
              data-testid="switch-push-notifications"
            />
          </div>
          {permissionStatus === "denied" && (
            <p className="text-xs text-destructive">
              Уведомления заблокированы в браузере. Разрешите в настройках сайта.
            </p>
          )}
          {!pushSupported && (
            <p className="text-xs text-muted-foreground">
              Ваш браузер не поддерживает push-уведомления.
            </p>
          )}

        </CardContent>
      </Card>

      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <SiTelegram className="w-4 h-4 text-[#0088cc]" />
            Telegram
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramStatusLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : telegramLinked ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium">Подключён</span>
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Активен
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Вы получаете уведомления о напоминаниях и событиях в Telegram
              </p>
              <Button
                variant="outline"
                onClick={unlinkTelegram}
                disabled={telegramLoading}
                className="w-full gap-2"
                data-testid="button-unlink-telegram"
              >
                {telegramLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                Отключить Telegram
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Не подключён</span>
                </div>
                <Badge variant="outline" className="text-muted-foreground">
                  Неактивен
                </Badge>
              </div>
              
              {telegramCode ? (
                <div className="space-y-3">
                  <p className="text-sm text-center">Ваш код привязки:</p>
                  <div 
                    className="text-3xl font-mono font-bold text-center tracking-[0.3em] py-3 px-4 bg-muted rounded-lg border border-primary/30"
                    data-testid="text-telegram-code-settings"
                  >
                    {telegramCode}
                  </div>
                  <a
                    href={`https://t.me/JarvoiceAI_bot?start=${telegramCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2 px-4 bg-[#0088cc] text-white rounded-lg text-sm font-medium"
                    data-testid="link-telegram-bot-settings"
                  >
                    <SiTelegram className="w-4 h-4" />
                    Открыть @JarvoiceAI_bot
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <Button
                    variant="outline"
                    onClick={() => {
                      checkTelegramStatus();
                      toast({
                        title: "Проверка...",
                        description: "Проверяем статус подключения",
                      });
                    }}
                    className="w-full gap-2"
                    data-testid="button-check-telegram-settings"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Проверить подключение
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Подключите Telegram для получения уведомлений о напоминаниях и событиях
                  </p>
                  <Button
                    onClick={generateTelegramCode}
                    disabled={telegramLoading}
                    className="w-full gap-2 bg-[#0088cc]"
                    data-testid="button-generate-telegram-code"
                  >
                    {telegramLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <SiTelegram className="w-4 h-4" />
                    )}
                    Сгенерировать код привязки
                  </Button>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>

      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="text-sm">Разделы</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="outline"
                  className="justify-start gap-2 h-auto py-3"
                  onClick={() => onNavigate(item.id)}
                  data-testid={`button-menu-${item.id}`}
                >
                  <Icon className="w-4 h-4 text-primary" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className={cn("card-cyber", "border-l-4 border-l-yellow-500")}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-500">
              <Shield className="w-4 h-4" />
              Панель владельца
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {ownerItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    className="justify-start gap-2 h-auto py-3 bg-gradient-warning"
                    onClick={() => onNavigate(item.id)}
                    data-testid={`button-owner-${item.id}`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Button 
        variant="outline" 
        className="w-full gap-2"
        onClick={onLogout}
        data-testid="button-logout"
      >
        <LogOut className="w-4 h-4" />
        Выйти из системы
      </Button>
    </div>
  );
}
