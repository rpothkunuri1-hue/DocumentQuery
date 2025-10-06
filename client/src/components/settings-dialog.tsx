import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const OLLAMA_MODELS = [
  { value: "llama2", label: "Llama 2" },
  { value: "llama3", label: "Llama 3" },
  { value: "mistral", label: "Mistral" },
  { value: "phi", label: "Phi" },
  { value: "gemma", label: "Gemma" },
  { value: "codellama", label: "Code Llama" },
  { value: "neural-chat", label: "Neural Chat" },
  { value: "starling-lm", label: "Starling" },
];

export function SettingsDialog() {
  const [selectedModel, setSelectedModel] = useState<string>("llama2");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const savedModel = localStorage.getItem("ollama_model");
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    localStorage.setItem("ollama_model", value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your DocuChat preferences
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="model">Ollama Model</Label>
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger id="model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {OLLAMA_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose which Ollama model to use for document Q&A. Make sure the model is installed locally.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function getSelectedModel(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("ollama_model") || "llama2";
  }
  return "llama2";
}
