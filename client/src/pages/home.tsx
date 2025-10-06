import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { DocumentUpload } from "@/components/document-upload";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsDialog } from "@/components/settings-dialog";
import type { Document } from "@shared/schema";
import { Menu } from "lucide-react";

export default function Home() {
  const [activeDocumentId, setActiveDocumentId] = useState<string | undefined>();
  const [showUpload, setShowUpload] = useState(false);

  const handleDocumentSelect = (documentId: string) => {
    setActiveDocumentId(documentId);
  };

  const handleUploadComplete = (document: Document) => {
    setActiveDocumentId(document.id);
    setShowUpload(false);
  };

  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          activeDocumentId={activeDocumentId}
          onDocumentSelect={handleDocumentSelect}
          onUploadClick={() => setShowUpload(true)}
        />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger data-testid="button-sidebar-toggle">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <h1 className="text-lg sm:text-xl font-semibold truncate">DocuChat</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <SettingsDialog />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            {activeDocumentId ? (
              <ChatInterface documentId={activeDocumentId} />
            ) : (
              <div className="h-full flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                  <div className="bg-primary/10 rounded-full p-4 sm:p-6 w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 flex items-center justify-center">
                    <svg
                      className="h-8 w-8 sm:h-10 sm:w-10 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">Welcome to DocuChat</h2>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
                    Upload a document to start having intelligent conversations about its content.
                    Ask questions and get AI-powered answers with streaming responses.
                  </p>
                  <div className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2">
                    <p>✓ Support for PDF, TXT, and DOCX files</p>
                    <p>✓ Real-time streaming responses</p>
                    <p>✓ Conversation history and memory</p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {showUpload && (
        <DocumentUpload
          onUploadComplete={handleUploadComplete}
          onClose={() => setShowUpload(false)}
        />
      )}
    </SidebarProvider>
  );
}
