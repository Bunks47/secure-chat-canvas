import { useAuth } from '@/contexts/AuthContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { AuthPage } from '@/components/auth/AuthPage';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { MessageView } from '@/components/chat/MessageView';

export function ChatLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl secure-gradient animate-pulse-subtle" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <ChatProvider>
      <div className="h-screen flex bg-background">
        <ConversationSidebar />
        <MessageView />
      </div>
    </ChatProvider>
  );
}
