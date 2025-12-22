import { useState } from "react";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
import { ArrowRightLeft, Volume2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const languages = [
  { code: "en", name: "English", flag: "GB" },
  { code: "de", name: "Deutsch", flag: "DE" },
  { code: "fr", name: "Français", flag: "FR" },
  { code: "es", name: "Español", flag: "ES" },
  { code: "it", name: "Italiano", flag: "IT" },
  { code: "zh", name: "中文", flag: "CN" },
  { code: "ja", name: "日本語", flag: "JP" },
];

export function TranslatePage() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [selectedLang, setSelectedLang] = useState("en");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, target: selectedLang }),
      });
      
      const data = await response.json();
      setOutputText(data.translated || "Перевод не найден");
    } catch {
      setOutputText("Ошибка перевода");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = selectedLang === "ru" ? "ru-RU" : `${selectedLang}-${selectedLang.toUpperCase()}`;
      speechSynthesis.speak(utterance);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-primary" data-testid="text-translate-title">
          Переводчик
        </h1>
        <p className="text-muted-foreground text-sm">Перевод на 7 языков</p>
      </div>

      <Card className="card-cyber">
        <CardHeader>
          <CardTitle className="text-sm">Текст для перевода</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Введите текст на русском..."
            className="bg-muted border-primary/20 min-h-24 resize-none"
            data-testid="textarea-input"
          />
          
          <div className="flex flex-wrap gap-2">
            {languages.map((lang) => (
              <Button
                key={lang.code}
                variant={selectedLang === lang.code ? "default" : "outline"}
                size="sm"
                className={cn(
                  "text-xs",
                  selectedLang === lang.code && "bg-gradient-primary"
                )}
                onClick={() => setSelectedLang(lang.code)}
                data-testid={`button-lang-${lang.code}`}
              >
                {lang.name}
              </Button>
            ))}
          </div>

          <Button 
            className="w-full bg-gradient-primary gap-2"
            onClick={handleTranslate}
            disabled={isLoading || !inputText.trim()}
            data-testid="button-translate"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {isLoading ? "Перевожу..." : "Перевести"}
          </Button>
        </CardContent>
      </Card>

      {outputText && (
        <Card className="card-cyber">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Результат</CardTitle>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleSpeak(outputText)}
                data-testid="button-speak"
              >
                <Volume2 className="w-4 h-4 text-primary" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCopy}
                data-testid="button-copy"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-primary" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div 
              className="bg-muted rounded-lg p-4 min-h-24 whitespace-pre-wrap"
              data-testid="text-output"
            >
              {outputText}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
