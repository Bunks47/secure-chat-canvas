import { formatDistanceToNow } from 'date-fns';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Lock, LogOut, Settings, Shield } from 'lucide-react';
import { useState } from 'react';

export function ConversationSidebar() {
  const { conversations, activeConversation, selectConversation, contacts, startConversation } = useChat();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  const filteredConversations = conversations.filter(conv =>
    conv.contact.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contact.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableContacts = contacts.filter(
    contact => !conversations.some(conv => conv.contact.id === contact.id)
  );

  return (
    <div className="w-80 h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg secure-gradient flex items-center justify-center">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sidebar-foreground">Chit-Chat</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="w-4 h-4 text-sidebar-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout}>
              <LogOut className="w-4 h-4 text-sidebar-foreground" />
            </Button>
          </div>
        </div>
        
        {/* User info */}
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50 mb-4">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {user.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.displayName}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">{user.fingerprint}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-sidebar-accent/50 border-sidebar-border"
          />
        </div>
      </div>

      {/* New Chat Button */}
      <div className="px-4 py-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-dashed"
          onClick={() => setShowNewChat(!showNewChat)}
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </Button>
      </div>

      {/* New Chat List */}
      {showNewChat && availableContacts.length > 0 && (
        <div className="px-4 py-2 border-b border-sidebar-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Start chat with:</p>
          <div className="space-y-1">
            {availableContacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => {
                  startConversation(contact);
                  setShowNewChat(false);
                }}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {contact.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{contact.displayName}</p>
                  <p className="text-xs text-muted-foreground">@{contact.username}</p>
                </div>
                {contact.isOnline && <div className="online-indicator" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl transition-all',
                activeConversation?.id === conv.id
                  ? 'bg-sidebar-accent shadow-sm'
                  : 'hover:bg-sidebar-accent/50'
              )}
            >
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {conv.contact.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5',
                    conv.contact.isOnline ? 'online-indicator' : 'offline-indicator'
                  )}
                />
              </div>
              
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate text-sidebar-foreground">
                    {conv.contact.displayName}
                  </span>
                  {conv.lastMessage && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(conv.lastMessage.timestamp, { addSuffix: false })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {conv.isEncrypted && (
                    <Shield className="w-3 h-3 text-primary shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage?.content || 'No messages yet'}
                  </span>
                  {conv.unreadCount > 0 && (
                    <Badge className="ml-auto shrink-0 h-5 min-w-5 px-1.5 bg-primary text-primary-foreground">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}

          {filteredConversations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to begin</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="w-3 h-3 text-primary" />
          <span>End-to-end encrypted</span>
        </div>
      </div>
    </div>
  );
}
