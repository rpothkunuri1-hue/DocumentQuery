import { Upload, FileText, File, X, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Document } from "@shared/schema";

interface DocumentUploadProps {
  onUploadComplete: (document: Document) => void;
  onClose: () => void;
}

export function DocumentUpload({ onUploadComplete, onClose }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      return response.json();
    },
    onSuccess: (data: Document) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document uploaded",
        description: `${data.name} is ready for questions`,
      });
      onUploadComplete(data);
      setFile(null);
      setUploadProgress(0);
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF, TXT, or DOCX files",
        variant: "destructive",
      });
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = () => {
    if (!file) return;
    
    setUploadProgress(30);
    setTimeout(() => setUploadProgress(60), 300);
    setTimeout(() => setUploadProgress(90), 600);
    
    uploadMutation.mutate(file);
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="h-12 w-12" />;
    if (file.type.includes("pdf")) return <FileText className="h-12 w-12" />;
    return <File className="h-12 w-12" />;
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-card border border-card-border rounded-xl shadow-lg max-w-lg w-full p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold">Upload Document</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-upload"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-6 sm:p-12 text-center transition-all
            ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
          `}
          data-testid="dropzone-upload"
        >
          <div className={`mb-3 sm:mb-4 flex justify-center ${file ? "text-accent" : "text-muted-foreground"}`}>
            {getFileIcon()}
          </div>
          
          {file ? (
            <div className="space-y-2">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              {uploadMutation.isPending && (
                <div className="mt-4">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Processing document...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Drop your document here</p>
              <p className="text-xs text-muted-foreground">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-4">
                Supports PDF, TXT, DOCX (max 10MB)
              </p>
            </div>
          )}
          
          <input
            type="file"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            accept=".pdf,.txt,.docx"
            className="hidden"
            id="file-upload"
            data-testid="input-file-upload"
          />
          <label htmlFor="file-upload">
            <Button
              variant="outline"
              className="mt-4"
              asChild
              disabled={uploadMutation.isPending}
            >
              <span>Choose File</span>
            </Button>
          </label>
        </div>

        {file && !uploadMutation.isPending && (
          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setFile(null)}
              data-testid="button-cancel-file"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleUpload}
              data-testid="button-upload-file"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
