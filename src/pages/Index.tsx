import { AuthProvider } from '@/contexts/AuthContext';
import { ChatLayout } from '@/components/chat/ChatLayout';

const Index = () => {
  return (
    <AuthProvider>
      <ChatLayout />
    </AuthProvider>
  );
};

export default Index;
