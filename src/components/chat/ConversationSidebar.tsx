import { formatDistanceToNow } from 'date-fns';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Plus, 
  Lock, 
  LogOut, 
  Settings, 
  Shield, 
  KeyRound,
  UserPlus,
  X,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useState } from 'react';
import { KeyBackupRecovery } from '@/components/crypto/KeyBackupRecovery';
import { KeyFingerprintDisplay } from '@/components/crypto/KeyFingerprintDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ConversationSidebar() {
  const { 
    conversations, 
    activeConversation, 
    selectConversation, 
    contacts, 
    startConversation,
    addContact,
    connectionState,
    presenceMap,
  } = useChat();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactUsername, setNewContactUsername] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const filteredConversations = conversations.filter(conv =>
    conv.contact.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contact.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableContacts = contacts.filter(
    contact => !conversations.some(conv => conv.contact.id === contact.id)
  );

  const handleAddContact = async () => {
    if (!newContactUsername.trim()) return;
    
    try {
      const contact = await addContact(newContactUsername.trim());
      setNewContactUsername('');
      setShowAddContact(false);
      startConversation(contact);
    } catch (err) {
      console.error('Failed to add contact:', err);
    }
  };

  // Get real-time presence for contacts
  const getContactPresence = (contactId: string) => {
    return presenceMap.get(contactId);
  };

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
            {/* Connection Status */}
            <div className="mr-1">
              {connectionState === 'connected' ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
            </div>
            
            {/* Settings Menu */}
            <DropdownMenu open={showSettings} onOpenChange={setShowSettings}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="w-4 h-4 text-sidebar-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Key Management
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Your Identity Key</DialogTitle>
                      <DialogDescription>
                        This is your cryptographic identity for secure messaging
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      {user && (
                        <KeyFingerprintDisplay
                          fingerprint={user.fingerprint}
                          label="Your Public Key Fingerprint"
                          showQrButton
                        />
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
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
              <p className="text-xs text-muted-foreground font-mono truncate">{user.fingerprint.slice(0, 16)}...</p>
            </div>
            <KeyBackupRecovery />
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
      <div className="px-4 py-2 flex gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-start gap-2 border-dashed"
          onClick={() => setShowNewChat(!showNewChat)}
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </Button>
        
        {/* Add Contact Dialog */}
        <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <UserPlus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Contact</DialogTitle>
              <DialogDescription>
                Enter a username to add them to your contacts
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 py-4">
              <Input
                placeholder="Enter username..."
                value={newContactUsername}
                onChange={(e) => setNewContactUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddContact()}
              />
              <Button onClick={handleAddContact} disabled={!newContactUsername.trim()}>
                Add
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* New Chat List */}
      {showNewChat && (
        <div className="px-4 py-2 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Start chat with:</p>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => setShowNewChat(false)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          
          {availableContacts.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-auto">
              {availableContacts.map(contact => {
                const presence = getContactPresence(contact.id);
                const isOnline = presence?.isOnline ?? contact.isOnline;
                
                return (
                  <button
                    key={contact.id}
                    onClick={() => {
                      startConversation(contact);
                      setShowNewChat(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {contact.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar',
                          isOnline ? 'bg-green-500' : 'bg-gray-400'
                        )}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">{contact.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{contact.username}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              All contacts have active conversations
            </p>
          )}
        </div>
      )}

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredConversations.map((conv) => {
            const presence = getContactPresence(conv.contact.id);
            const isOnline = presence?.isOnline ?? conv.contact.isOnline;
            const lastSeen = presence?.lastSeen ?? conv.contact.lastSeen;

            return (
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
                      'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sidebar',
                      isOnline ? 'bg-green-500' : 'bg-gray-400'
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
            );
          })}

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
