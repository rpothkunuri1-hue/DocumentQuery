import { FileText, Upload, File, CheckCircle2, Loader2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Document } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface AppSidebarProps {
  activeDocumentId?: string;
  onDocumentSelect: (documentId: string) => void;
  onUploadClick: () => void;
}

export function AppSidebar({ activeDocumentId, onDocumentSelect, onUploadClick }: AppSidebarProps) {
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="px-3 py-2">
            <Button
              onClick={onUploadClick}
              className="w-full"
              data-testid="button-upload-document"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>

          <SidebarGroupLabel className="px-3">Your Documents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <div className="px-3 py-8 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : documents && documents.length > 0 ? (
                documents.map((doc) => (
                  <SidebarMenuItem key={doc.id}>
                    <SidebarMenuButton
                      onClick={() => onDocumentSelect(doc.id)}
                      isActive={activeDocumentId === doc.id}
                      className="group"
                      data-testid={`button-document-${doc.id}`}
                    >
                      <div className="flex items-start gap-3 w-full min-w-0">
                        <div className="mt-0.5 text-muted-foreground group-data-[active=true]:text-primary">
                          {getFileIcon(doc.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate" data-testid={`text-document-name-${doc.id}`}>
                            {doc.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(doc.size)}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-accent/10 text-accent border-accent/20 shrink-0"
                          data-testid={`badge-ready-${doc.id}`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </Badge>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="px-3 py-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
                  <p className="text-sm text-muted-foreground">No documents yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Upload a document to start</p>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
