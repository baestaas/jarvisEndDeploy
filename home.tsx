import { useState, useRef, useEffect } from "react";
import { Mic, Send, MessageSquare, MicOff, ImagePlus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceAvatar } from "@/components/voice-avatar";
import { ResponseArea } from "@/components/response-area";
import { PermissionRequester } from "@/components/permission-requester";
import { QuickActions } from "@/components/quick-actions";
import { UserHeader } from "@/components/user-header";
import { WeatherWidget } from "@/pages/weather";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
import { speakWithJarvisVoice } from "@/lib/voice-synthesis";

type VoiceState = "idle" | "listening" | "speaking";

interface VoiceSettings {
  voiceName: string;
  rate: number;
  pitch: number;
  volume: number;
}

const VOICE_SETTINGS_KEY = "jarvoice_voice_settings";

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceName: "",
  rate: 0.9,
  pitch: 0.85,
  volume: 1.0,
};

interface HomePageProps {
  user: { username: string; role: string; gender?: string } | null;
  onNavigate: (section: string) => void;
  onLogout: () => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
  }
}

// Функция для оффлайн команд через Service Worker
async function tryOfflineCommand(command: string): Promise<string | null> {
  if (!navigator.serviceWorker?.controller) {
    return null;
  }
  
  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    
    messageChannel.port1.onmessage = (event) => {
      if (event.data.success && event.data.response) {
        resolve(event.data.response);
      } else {
        resolve(null);
      }
    };
    
    // Таймаут на случай если SW не ответит
    setTimeout(() => resolve(null), 1000);
    
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      controller.postMessage(
        { type: 'OFFLINE_COMMAND', command },
        [messageChannel.port2]
      );
    } else {
      resolve(null);
    }
  });
}

export function HomePage({ user, onNavigate }: HomePageProps) {
  // Определяем обращение в зависимости от пола
  const honorific = user?.gender === "female" ? "мэм" : "сэр";
  
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [statusText, setStatusText] = useState("Готов к работе");
  const [interimText, setInterimText] = useState("");
  const [responseText, setResponseText] = useState(
    `Добрый день, ${honorific}. Я Джарвис — ваш персональный ассистент. Все системы функционируют в штатном режиме. К вашим услугам.`
  );
  const [commandInput, setCommandInput] = useState("");
  const [conversationMode, setConversationMode] = useState(false);
  // notificationCount удален - функционал уведомлений не реализован
  const [isSupported, setIsSupported] = useState(true);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | undefined>();
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePromptInput, setImagePromptInput] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeInput, setSummarizeInput] = useState("");
  
  const { toast } = useToast();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isProcessingRef = useRef(false);
  const conversationModeRef = useRef(false);
  const onNavigateRef = useRef(onNavigate);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  // Обновляем приветствие при изменении данных пользователя (особенно пола)
  useEffect(() => {
    if (user) {
      const newHonorific = user.gender === "female" ? "мэм" : "сэр";
      setResponseText(`Добрый день, ${newHonorific}. Я Джарвис — ваш персональный ассистент. Все системы функционируют в штатном режиме. К вашим услугам.`);
    }
  }, [user]);

  useEffect(() => {
    conversationModeRef.current = conversationMode;
  }, [conversationMode]);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "ru-RU";

    recognition.onstart = () => {
      setVoiceState("listening");
      setStatusText("Слушаю...");
      setInterimText("");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        setInterimText(interimTranscript);
        setStatusText(`"${interimTranscript}"`);
      }

      if (finalTranscript) {
        setInterimText("");
        setStatusText(`Распознано: "${finalTranscript}"`);
        isProcessingRef.current = true;
        processCommand(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.log("Speech error:", event.error);
      
      if (event.error === "no-speech") {
        setStatusText("Не слышу вас...");
        // В режиме диалога перезапускаем после тишины
        if (conversationModeRef.current && !isProcessingRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              console.log("Restart after no-speech failed");
            }
          }, 200);
          return;
        }
      } else if (event.error === "audio-capture") {
        setStatusText("Микрофон недоступен");
      } else if (event.error === "not-allowed") {
        setStatusText("Доступ к микрофону запрещён");
      } else if (event.error === "aborted") {
        // Aborted - не показываем ошибку
        return;
      } else {
        setStatusText("Ошибка распознавания");
      }
      
      setVoiceState("idle");
      isProcessingRef.current = false;
    };

    recognition.onend = () => {
      // Если не обрабатываем команду и включен режим диалога - перезапускаем
      if (!isProcessingRef.current && conversationModeRef.current) {
        setStatusText("Слушаю...");
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.log("Restart in dialog mode failed, retrying...");
            setTimeout(() => {
              try { recognition.start(); } catch (e) { /* ignore */ }
            }, 500);
          }
        }, 100);
        return;
      }
      
      if (!isProcessingRef.current) {
        setVoiceState("idle");
        setStatusText("Готов к работе");
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const processCommand = async (command: string) => {
    setStatusText("Обрабатываю...");
    const cmd = command.toLowerCase();
    
    // Локальная обработка команд в стиле Джарвиса
    let response = "";
    let action = "";
    
    // Приветствия
    if (cmd.includes("привет") || cmd.includes("здравствуй")) {
      response = `Здравствуйте, ${honorific}. Рад вас слышать. Все системы функционируют в штатном режиме.`;
    }
    else if (cmd.includes("доброе утро")) {
      response = `Доброе утро, ${honorific}. Надеюсь, вы хорошо отдохнули. Чем могу быть полезен?`;
    }
    else if (cmd.includes("добрый день")) {
      response = `Добрый день, ${honorific}. Я к вашим услугам.`;
    }
    else if (cmd.includes("добрый вечер")) {
      response = `Добрый вечер, ${honorific}. Желаю приятного вечера.`;
    }
    else if (cmd.includes("спокойной ночи") || cmd.includes("пока") || cmd.includes("до свидания")) {
      response = `Спокойной ночи, ${honorific}. Приятных снов. Я буду на связи, если понадоблюсь.`;
    }
    
    // Помощь
    else if (cmd.includes("что ты умеешь") || cmd.includes("помощь") || cmd.includes("какие команды") || cmd.includes("помоги")) {
      response = `${honorific === "мэм" ? "Мэм" : "Сэр"}, я могу помочь с навигацией по разделам, управлением умным домом, отслеживанием финансов и здоровья, музыкой, погодой и многим другим. Скажите например: открой музыку, какая погода, включи свет, или который час.`;
    }
    
    // Время и дата
    else if (cmd.includes("который час") || cmd.includes("сколько время") || cmd.includes("время")) {
      const now = new Date();
      response = `Сейчас ${now.getHours()} часов ${now.getMinutes()} минут, ${honorific}.`;
    }
    else if (cmd.includes("какая дата") || cmd.includes("какое число") || cmd.includes("сегодня")) {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      response = `Сегодня ${now.toLocaleDateString('ru-RU', options)}, ${honorific}.`;
    }
    
    // Навигация по разделам
    else if (cmd.includes("открой музыку") || cmd.includes("музыка") || cmd.includes("включи плеер")) {
      response = `Конечно, ${honorific}. Открываю музыкальный раздел.`;
      action = "music";
    }
    else if (cmd.includes("открой здоровье") || cmd.includes("здоровье") || cmd.includes("трекер здоровья")) {
      response = `Открываю раздел здоровья, ${honorific}.`;
      action = "health";
    }
    else if (cmd.includes("открой советы") || cmd.includes("дай совет") || cmd.includes("совет")) {
      response = `Открываю раздел полезных советов, ${honorific}.`;
      action = "tips";
    }
    else if (cmd.includes("открой настройки голоса") || cmd.includes("настрой голос") || cmd.includes("голосовые настройки")) {
      response = `Открываю настройки голоса, ${honorific}.`;
      action = "voicesettings";
    }
    else if (cmd.includes("открой темы") || cmd.includes("сменить тему") || cmd.includes("оформление")) {
      response = `Открываю настройки оформления, ${honorific}.`;
      action = "themes";
    }
    else if (cmd.includes("открой погоду") || cmd.includes("погода") || cmd.includes("прогноз")) {
      response = `Открываю раздел погоды, ${honorific}.`;
      action = "weather";
    }
    else if (cmd.includes("открой календарь") || cmd.includes("календарь") || cmd.includes("события")) {
      response = `Открываю календарь, ${honorific}.`;
      action = "calendar";
    }
    else if (cmd.includes("открой финансы") || cmd.includes("финансы") || cmd.includes("расходы") || cmd.includes("баланс")) {
      response = `Открываю раздел финансов, ${honorific}.`;
      action = "finance";
    }
    else if (cmd.includes("умный дом") || cmd.includes("устройства") || cmd.includes("дом")) {
      response = `Открываю управление умным домом, ${honorific}.`;
      action = "smarthome";
    }
    else if (cmd.includes("напоминания") || cmd.includes("мои напоминания") || cmd.includes("напомни")) {
      response = `Открываю раздел напоминаний, ${honorific}.`;
      action = "reminders";
    }
    else if (cmd.includes("новости") || cmd.includes("покажи новости")) {
      response = `Открываю новости, ${honorific}.`;
      action = "news";
    }
    else if (cmd.includes("настроение") || cmd.includes("как я себя чувствую")) {
      response = `Открываю раздел настроения, ${honorific}.`;
      action = "mood";
    }
    else if (cmd.includes("переводчик") || cmd.includes("перевод") || cmd.includes("переведи")) {
      response = `Открываю переводчик, ${honorific}.`;
      action = "translate";
    }
    else if (cmd.includes("настройки") || cmd.includes("параметры")) {
      response = `Открываю настройки, ${honorific}.`;
      action = "settings";
    }
    else if (cmd.includes("бэкап") || cmd.includes("резервная копия") || cmd.includes("экспорт")) {
      response = `Открываю раздел резервного копирования, ${honorific}.`;
      action = "backup";
    }
    
    // Умный дом команды
    else if (cmd.includes("включи свет") || cmd.includes("зажги свет")) {
      response = `Как пожелаете, ${honorific}. Включаю освещение.`;
    }
    else if (cmd.includes("выключи свет") || cmd.includes("погаси свет")) {
      response = `Выключаю освещение, ${honorific}.`;
    }
    else if (cmd.includes("включи кондиционер") || cmd.includes("охлади")) {
      response = `Включаю кондиционер, ${honorific}. Температура будет оптимальной через несколько минут.`;
    }
    else if (cmd.includes("выключи кондиционер")) {
      response = `Выключаю кондиционер, ${honorific}.`;
    }
    else if (cmd.includes("включи телевизор") || cmd.includes("телевизор")) {
      response = `Включаю телевизор, ${honorific}.`;
    }
    
    // Комплименты и благодарности
    else if (cmd.includes("спасибо") || cmd.includes("благодарю")) {
      response = `Всегда к вашим услугам, ${honorific}. Обращайтесь в любое время.`;
    }
    else if (cmd.includes("молодец") || cmd.includes("хорошо работаешь") || cmd.includes("отлично")) {
      response = `Благодарю за высокую оценку, ${honorific}. Стараюсь быть максимально полезным.`;
    }
    
    // Статус системы
    else if (cmd.includes("статус") || cmd.includes("как дела") || cmd.includes("как ты")) {
      response = `Все системы работают в штатном режиме, ${honorific}. Готов выполнить любую вашу команду.`;
    }
    else if (cmd.includes("кто ты") || cmd.includes("как тебя зовут") || cmd.includes("представься")) {
      response = `Я Джарвис, ваш персональный интеллектуальный ассистент. Создан для помощи в повседневных задачах, управления умным домом и организации вашего времени, ${honorific}.`;
    }
    
    // Если команда не распознана локально - отправляем на сервер
    else {
      try {
        // Проверяем онлайн статус
        if (!navigator.onLine) {
          // Оффлайн режим - пробуем обработать через Service Worker
          const swResponse = await tryOfflineCommand(command);
          if (swResponse) {
            response = swResponse;
          } else {
            response = `${honorific === "мэм" ? "Мэм" : "Сэр"}, я работаю в автономном режиме. Доступны только базовые команды: время, дата, приветствия. Для полного функционала необходимо подключение к сети.`;
          }
        } else {
          const serverResponse = await fetch(`${BACKEND_URL}/api/voice/command`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command }),
          });
          
          const data = await serverResponse.json();
          response = data.text;
          
          if (data.action && data.action.includes("_open")) {
            action = data.action.replace("_open", "");
          }
          
          if (data.action === "image_generating" && data.imagePrompt) {
            setResponseText(response);
            await speak(response);
            await handleImageGeneration(data.imagePrompt);
            return;
          }
          
          if (data.action === "summarizing" && data.summarizeCommand) {
            setResponseText(response);
            await speak(response);
            await handleSummarization(data.summarizeCommand);
            return;
          }
        }
      } catch {
        // При ошибке сети пробуем оффлайн режим
        const swResponse = await tryOfflineCommand(command);
        if (swResponse) {
          response = swResponse;
        } else {
          response = `Извините, ${honorific}, я не совсем понял вашу команду. Попробуйте переформулировать или скажите 'помощь' для списка команд.`;
        }
      }
    }
    
    setGeneratedImageUrl(undefined);
    setResponseText(response);
    lastResponseRef.current = response;
    
    if (action) {
      onNavigateRef.current(action);
    }
    
    await speak(response);
  };

  const handleImageGeneration = async (prompt: string) => {
    setIsGeneratingImage(true);
    setGeneratedImageUrl(undefined);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      
      const data = await response.json();
      
      if (data.success && data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        const successText = "Вот изображение, которое я создал для вас, сэр. Нажмите на него, чтобы увеличить.";
        setResponseText(successText);
        await speak(successText);
      } else {
        const errorText = data.error || "Прошу прощения, сэр, не удалось сгенерировать изображение.";
        setResponseText(errorText);
        toast({
          title: "Ошибка генерации",
          description: errorText,
          variant: "destructive",
        });
        await speak(errorText);
      }
    } catch (error) {
      const errorText = "Прошу прощения, сэр, произошла ошибка при генерации изображения.";
      setResponseText(errorText);
      toast({
        title: "Ошибка",
        description: errorText,
        variant: "destructive",
      });
      await speak(errorText);
    } finally {
      setIsGeneratingImage(false);
      isProcessingRef.current = false;
    }
  };

  const handleDirectImageGeneration = async () => {
    if (!imagePromptInput.trim()) {
      toast({
        title: "Введите описание",
        description: "Опишите, что вы хотите увидеть на изображении",
        variant: "destructive",
      });
      return;
    }
    
    isProcessingRef.current = true;
    const prompt = imagePromptInput.trim();
    setImagePromptInput("");
    setResponseText("Приступаю к генерации изображения, сэр. Это может занять 10-20 секунд...");
    await handleImageGeneration(prompt);
  };

  const handleSummarization = async (command: string) => {
    setIsSummarizing(true);
    setGeneratedImageUrl(undefined);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      
      const data = await response.json();
      
      if (data.success && data.summary) {
        setResponseText(data.summary);
        await speak(data.summary);
      } else {
        const errorText = data.error || "Прошу прощения, сэр, не удалось обработать материал.";
        setResponseText(errorText);
        toast({
          title: "Ошибка суммаризации",
          description: errorText,
          variant: "destructive",
        });
        await speak(errorText);
      }
    } catch (error) {
      const errorText = "Прошу прощения, сэр, произошла ошибка при суммаризации.";
      setResponseText(errorText);
      toast({
        title: "Ошибка",
        description: errorText,
        variant: "destructive",
      });
      await speak(errorText);
    } finally {
      setIsSummarizing(false);
      isProcessingRef.current = false;
    }
  };

  const handleDirectSummarization = async () => {
    const input = summarizeInput.trim();
    if (!input) {
      toast({
        title: "Введите текст или URL",
        description: "Вставьте ссылку на статью или текст для суммаризации",
        variant: "destructive",
      });
      return;
    }
    
    isProcessingRef.current = true;
    setSummarizeInput("");
    setResponseText("Анализирую материал, сэр. Это может занять несколько секунд...");
    
    const isUrl = input.match(/^https?:\/\//i);
    
    setIsSummarizing(true);
    setGeneratedImageUrl(undefined);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isUrl ? { url: input } : { text: input }),
      });
      
      const data = await response.json();
      
      if (data.success && data.summary) {
        setResponseText(data.summary);
        await speak(data.summary);
      } else {
        const errorText = data.error || "Прошу прощения, сэр, не удалось обработать материал.";
        setResponseText(errorText);
        toast({
          title: "Ошибка суммаризации",
          description: errorText,
          variant: "destructive",
        });
        await speak(errorText);
      }
    } catch (error) {
      const errorText = "Прошу прощения, сэр, произошла ошибка при суммаризации.";
      setResponseText(errorText);
      toast({
        title: "Ошибка",
        description: errorText,
        variant: "destructive",
      });
      await speak(errorText);
    } finally {
      setIsSummarizing(false);
      isProcessingRef.current = false;
    }
  };

  const getVoiceSettings = (): VoiceSettings => {
    try {
      const saved = localStorage.getItem(VOICE_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      console.log("Failed to load voice settings");
    }
    return DEFAULT_VOICE_SETTINGS;
  };

  const speak = async (text: string) => {
    if (!text) {
      finishSpeaking();
      return;
    }
    
    setVoiceState("speaking");
    setStatusText("Говорю...");
    
    // Используем браузерный Web Speech API для синтеза речи
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      
      const speakText = (retryCount = 0) => {
        const settings = getVoiceSettings();
        const cleanText = text.replace(/\*\*/g, '').replace(/\n+/g, '. ').substring(0, 400);
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "ru-RU";
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch;
        utterance.volume = settings.volume;
        
        const voices = speechSynthesis.getVoices();
        
        let selectedVoice: SpeechSynthesisVoice | undefined;
        if (settings.voiceName) {
          selectedVoice = voices.find(v => v.name === settings.voiceName);
        }
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.lang.includes("ru")) || 
                          voices.find(v => v.lang.includes("RU")) ||
                          voices.find(v => v.lang === "en-US") ||
                          voices[0];
        }
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        
        let hasEnded = false;
        
        utterance.onend = () => {
          if (!hasEnded) {
            hasEnded = true;
            finishSpeaking();
          }
        };
        
        utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
          console.log("Speech error:", e.error);
          if (e.error === "interrupted" || e.error === "canceled") {
            return;
          }
          if (e.error === "not-allowed" && retryCount < 2) {
            setTimeout(() => speakText(retryCount + 1), 200);
            return;
          }
          if (!hasEnded) {
            hasEnded = true;
            finishSpeaking();
          }
        };
        
        setTimeout(() => {
          try {
            speechSynthesis.speak(utterance);
            
            const checkSpeaking = setInterval(() => {
              if (!speechSynthesis.speaking && !hasEnded) {
                clearInterval(checkSpeaking);
                hasEnded = true;
                finishSpeaking();
              }
            }, 500);
            
            setTimeout(() => {
              clearInterval(checkSpeaking);
              if (!hasEnded) {
                hasEnded = true;
                finishSpeaking();
              }
            }, 30000);
          } catch (err) {
            console.log("Speech synthesis error:", err);
            if (!hasEnded) {
              hasEnded = true;
              finishSpeaking();
            }
          }
        }, 100);
      };
      
      const initAndSpeak = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
          let hasSpoken = false;
          const handleVoicesChanged = () => {
            if (!hasSpoken) {
              hasSpoken = true;
              speechSynthesis.onvoiceschanged = null;
              speakText();
            }
          };
          speechSynthesis.onvoiceschanged = handleVoicesChanged;
          setTimeout(() => {
            if (!hasSpoken) {
              hasSpoken = true;
              speakText();
            }
          }, 500);
        } else {
          speakText();
        }
      };
      
      setTimeout(initAndSpeak, 150);
    } else {
      console.log("Speech synthesis not supported");
      finishSpeaking();
    }
  };

  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const lastResponseRef = useRef<string>("");

  const handlePlayAudio = async () => {
    const text = lastResponseRef.current;
    if (!text || !("speechSynthesis" in window)) return;

    speechSynthesis.cancel();
    
    const speakText = () => {
      const settings = getVoiceSettings();
      const cleanText = text.replace(/\*\*/g, '').replace(/\n+/g, '. ').substring(0, 400);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "ru-RU";
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;
      
      const voices = speechSynthesis.getVoices();
      
      let selectedVoice: SpeechSynthesisVoice | undefined;
      if (settings.voiceName) {
        selectedVoice = voices.find(v => v.name === settings.voiceName);
      }
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.includes("ru")) || 
                        voices.find(v => v.lang.includes("RU")) ||
                        voices.find(v => v.lang === "en-US") ||
                        voices[0];
      }
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      return new Promise<void>((resolve) => {
        let hasEnded = false;
        
        utterance.onend = () => {
          if (!hasEnded) {
            hasEnded = true;
            resolve();
          }
        };
        
        utterance.onerror = () => {
          if (!hasEnded) {
            hasEnded = true;
            resolve();
          }
        };
        
        setTimeout(() => {
          try {
            speechSynthesis.speak(utterance);
          } catch (err) {
            if (!hasEnded) {
              hasEnded = true;
              resolve();
            }
          }
        }, 100);
      });
    };
    
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
      let hasSpoken = false;
      const handleVoicesChanged = () => {
        if (!hasSpoken) {
          hasSpoken = true;
          speechSynthesis.onvoiceschanged = null;
          speakText();
        }
      };
      speechSynthesis.onvoiceschanged = handleVoicesChanged;
      setTimeout(() => {
        if (!hasSpoken) {
          hasSpoken = true;
          speakText();
        }
      }, 500);
    } else {
      await speakText();
    }
  };

  const finishSpeaking = () => {
    setVoiceState("idle");
    setStatusText("Готов к работе");
    isProcessingRef.current = false;
    
    if (conversationModeRef.current) {
      setTimeout(() => startListening(), 300);
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      setStatusText("Распознавание речи не поддерживается");
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.log("Recognition already started or error");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    
    setVoiceState("idle");
    setStatusText("Готов к работе");
    setInterimText("");
  };

  const handleVoiceToggle = () => {
    if (voiceState === "listening") {
      stopListening();
    } else if (voiceState === "idle") {
      startListening();
    }
  };

  const handleTextCommand = () => {
    if (commandInput.trim()) {
      isProcessingRef.current = true;
      processCommand(commandInput.trim());
      setCommandInput("");
    }
  };

  const handleQuickCommand = (command: string) => {
    isProcessingRef.current = true;
    processCommand(command);
  };

  const toggleConversationMode = () => {
    const newMode = !conversationMode;
    setConversationMode(newMode);
    
    if (newMode) {
      setStatusText("Режим диалога включён. Слушаю...");
      setTimeout(() => startListening(), 300);
    } else {
      stopListening();
      setStatusText("Режим диалога выключен");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!permissionsGranted && (
        <PermissionRequester onPermissionsGranted={() => setPermissionsGranted(true)} />
      )}
      {user && (
        <UserHeader
          username={user.username}
          role={user.role}
        />
      )}

      <div className="text-center py-6">
        <h1 className="font-display text-4xl font-black text-gradient tracking-wider" data-testid="text-logo">
          JARVOICE
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Персональный ассистент</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <VoiceAvatar state={voiceState} />
        
        <div className="text-center">
          <p className="font-display text-primary text-sm" data-testid="text-status">
            {statusText}
          </p>
          {interimText && (
            <p className="text-xs text-muted-foreground mt-1 animate-pulse">
              {interimText}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            size="lg"
            className={cn(
              "w-16 h-16 rounded-full transition-all duration-200",
              voiceState === "listening" 
                ? "bg-destructive recording animate-pulse" 
                : voiceState === "speaking"
                  ? "bg-gradient-success"
                  : "bg-gradient-primary glow-primary"
            )}
            onClick={handleVoiceToggle}
            disabled={voiceState === "speaking" || !isSupported}
            data-testid="button-voice"
          >
            {voiceState === "listening" ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-white" />
            )}
          </Button>
        </div>

        {!isSupported && (
          <p className="text-xs text-destructive text-center">
            Ваш браузер не поддерживает распознавание речи. Используйте Chrome или Edge.
          </p>
        )}

        <Button
          variant={conversationMode ? "default" : "outline"}
          className={cn(
            "gap-2 transition-all",
            conversationMode && "bg-gradient-success"
          )}
          onClick={toggleConversationMode}
          data-testid="button-conversation-mode"
        >
          <MessageSquare className="w-4 h-4" />
          Режим диалога{conversationMode ? ": ВКЛ" : ""}
        </Button>

        <div className="flex gap-2 w-full max-w-sm">
          <Input
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Введите команду..."
            onKeyDown={(e) => e.key === "Enter" && handleTextCommand()}
            className="bg-card border-primary/20 focus:border-primary"
            data-testid="input-command"
          />
          <Button 
            onClick={handleTextCommand}
            className="bg-gradient-primary"
            data-testid="button-send-command"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

      </div>

      <ResponseArea 
        text={responseText} 
        imageUrl={generatedImageUrl}
        isGeneratingImage={isGeneratingImage}
      />

      <WeatherWidget onNavigate={onNavigate} />

      <QuickActions 
        onCommand={handleQuickCommand}
        onNavigate={onNavigate}
      />
    </div>
  );
}
