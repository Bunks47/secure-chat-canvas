import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Shield, 
  Send, 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle,
  Lock,
  MoreVertical,
  Phone,
  Video,
  Info
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return format(date, 'HH:mm');
  } else if (isYesterday(date)) {
    return 'Yesterday ' + format(date, 'HH:mm');
  } else {
    return format(date, 'MMM d, HH:mm');
  }
}

function MessageStatus({ status }: { status: string }) {
  switch (status) {
    case 'sending':
      return <Clock className="w-3 h-3 text-muted-foreground animate-pulse" />;
    case 'sent':
      return <Check className="w-3 h-3 text-muted-foreground" />;
    case 'delivered':
      return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
    case 'read':
      return <CheckCheck className="w-3 h-3 text-primary" />;
    case 'failed':
      return <AlertCircle className="w-3 h-3 text-destructive" />;
    default:
      return null;
  }
}

export function MessageView() {
  const { activeConversation, messages, sendMessage, setTyping } = useChat();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset message input when conversation changes
  useEffect(() => {
    setNewMessage('');
  }, [activeConversation?.id]);

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(newMessage.trim());
      setNewMessage('');
      textareaRef.current?.focus();
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    setTyping(e.target.value.length > 0);
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
            <Lock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold">Chit-Chat</h2>
          <p className="text-muted-foreground">
            Select a conversation or start a new one to begin messaging securely.
          </p>
          <div className="encryption-badge mx-auto">
            <Shield className="w-3.5 h-3.5" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {activeConversation.contact.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                'absolute -bottom-0.5 -right-0.5',
                activeConversation.contact.isOnline ? 'online-indicator' : 'offline-indicator'
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold">{activeConversation.contact.displayName}</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {activeConversation.contact.isOnline 
                  ? 'Online' 
                  : activeConversation.contact.lastSeen 
                    ? `Last seen ${formatDistanceToNow(activeConversation.contact.lastSeen, { addSuffix: true })}`
                    : 'Offline'
                }
              </span>
              {activeConversation.isEncrypted && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="encryption-badge cursor-help">
                      <Shield className="w-3 h-3" />
                      <span>E2EE</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-medium">End-to-end encrypted</p>
                      <p className="text-xs text-muted-foreground">
                        Fingerprint: {activeConversation.contact.fingerprint}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Phone className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Video className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Info className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Encryption Notice */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 text-xs text-muted-foreground">
              <Lock className="w-3 h-3 text-primary" />
              <span>Messages are end-to-end encrypted</span>
            </div>
          </div>

          {messages.map((message, index) => {
            const isOwn = message.senderId === 'current-user';
            const showAvatar = !isOwn && (
              index === 0 || 
              messages[index - 1].senderId !== message.senderId
            );

            return (
              <div
                key={message.id}
                className={cn(
                  'flex gap-2 animate-fade-in',
                  isOwn ? 'justify-end' : 'justify-start'
                )}
              >
                {!isOwn && (
                  <div className="w-8 shrink-0">
                    {showAvatar && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {activeConversation.contact.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}
                
                <div
                  className={cn(
                    'max-w-[70%] group',
                    isOwn ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'px-4 py-2 rounded-2xl',
                      isOwn
                        ? 'bg-chat-bubble-sent text-chat-bubble-sent-foreground rounded-br-md'
                        : 'bg-chat-bubble-received text-chat-bubble-received-foreground rounded-bl-md'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-1.5 mt-1 px-1',
                      isOwn ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.isEncrypted && (
                      <Shield className="w-3 h-3 text-primary opacity-50" />
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatMessageTime(message.timestamp)}
                    </span>
                    {isOwn && <MessageStatus status={message.status} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              placeholder="Type a message..."
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="min-h-[44px] max-h-32 resize-none pr-12 bg-background"
              rows={1}
            />
          </div>
          <Button 
            onClick={handleSend} 
            disabled={!newMessage.trim() || isSending}
            className="h-11 w-11 shrink-0 rounded-xl"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
