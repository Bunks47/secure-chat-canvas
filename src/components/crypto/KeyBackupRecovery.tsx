// Key Backup and Recovery UI Component

import { useState, useCallback } from 'react';
import { KeyRound, Upload, Download, Shield, AlertTriangle, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import type { EncryptedKeyBackup } from '@/lib/crypto';

interface KeyBackupRecoveryProps {
  onComplete?: () => void;
}

export function KeyBackupRecovery({ onComplete }: KeyBackupRecoveryProps) {
  const { createKeyBackup, restoreFromBackup } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');

  const handleComplete = () => {
    setIsOpen(false);
    onComplete?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <KeyRound className="w-4 h-4" />
          Key Management
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Key Management
          </DialogTitle>
          <DialogDescription>
            Backup your encryption keys or restore from a previous backup
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'backup' | 'restore')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="backup" className="gap-2">
              <Download className="w-4 h-4" />
              Backup
            </TabsTrigger>
            <TabsTrigger value="restore" className="gap-2">
              <Upload className="w-4 h-4" />
              Restore
            </TabsTrigger>
          </TabsList>

          <TabsContent value="backup" className="mt-4">
            <BackupForm onComplete={handleComplete} createKeyBackup={createKeyBackup} />
          </TabsContent>

          <TabsContent value="restore" className="mt-4">
            <RestoreForm onComplete={handleComplete} restoreFromBackup={restoreFromBackup} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface BackupFormProps {
  onComplete: () => void;
  createKeyBackup: (password: string) => Promise<EncryptedKeyBackup>;
}

function BackupForm({ onComplete, createKeyBackup }: BackupFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [backup, setBackup] = useState<EncryptedKeyBackup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateBackup = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await createKeyBackup(password);
      setBackup(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!backup) return;
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chit-chat-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onComplete();
  };

  if (backup) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
          <Check className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium text-sm">Backup Created</p>
            <p className="text-xs text-muted-foreground">
              Fingerprint: {backup.fingerprint.slice(0, 16)}...
            </p>
          </div>
        </div>

        <div className="bg-muted rounded-lg p-3 max-h-32 overflow-auto">
          <pre className="text-xs font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(backup, null, 2)}
          </pre>
        </div>

        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            Store this backup safely. You'll need both the backup file AND the password to recover your keys.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(backup, null, 2));
            }}
          >
            Copy to Clipboard
          </Button>
          <Button className="flex-1" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Create an encrypted backup of your private keys protected by a password.
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="backup-password">Backup Password</Label>
          <div className="relative">
            <Input
              id="backup-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="backup-confirm-password">Confirm Password</Label>
          <Input
            id="backup-confirm-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-destructive">Passwords don't match</p>
          )}
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleCreateBackup}
        disabled={isLoading || !password || password !== confirmPassword}
      >
        {isLoading ? 'Creating Backup...' : 'Create Encrypted Backup'}
      </Button>
    </div>
  );
}

interface RestoreFormProps {
  onComplete: () => void;
  restoreFromBackup: (backup: EncryptedKeyBackup, password: string) => Promise<void>;
}

function RestoreForm({ onComplete, restoreFromBackup }: RestoreFormProps) {
  const [backupText, setBackupText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setBackupText(content);
    };
    reader.readAsText(file);
  }, []);

  const handleRestore = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const backup = JSON.parse(backupText) as EncryptedKeyBackup;
      await restoreFromBackup(backup, password);
      setSuccess(true);
      setTimeout(onComplete, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-medium">Keys Restored Successfully</p>
          <p className="text-sm text-muted-foreground">
            Your encryption keys have been imported
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Restore your encryption keys from a previous backup file.
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Backup File</Label>
          <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
              id="backup-file-input"
            />
            <label htmlFor="backup-file-input" className="cursor-pointer">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click to upload backup file</p>
              <p className="text-xs text-muted-foreground">or paste backup data below</p>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="restore-backup-text">Or Paste Backup Data</Label>
          <Textarea
            id="restore-backup-text"
            placeholder='{"encryptedPrivateKey": "...", "salt": "...", ...}'
            value={backupText}
            onChange={(e) => setBackupText(e.target.value)}
            className="font-mono text-xs h-24"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="restore-password">Backup Password</Label>
          <div className="relative">
            <Input
              id="restore-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter backup password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleRestore}
        disabled={isLoading || !backupText || !password}
      >
        {isLoading ? 'Restoring...' : 'Restore Keys'}
      </Button>
    </div>
  );
}

/**
 * Standalone Key Backup Prompt Card
 */
export function KeyBackupPrompt({ 
  onBackupComplete,
  onSkip 
}: { 
  onBackupComplete: () => void;
  onSkip?: () => void;
}) {
  const { createKeyBackup } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBackup = async () => {
    if (password !== confirmPassword || password.length < 8) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const backup = await createKeyBackup(password);
      
      // Download backup
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chit-chat-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      onBackupComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>
        <CardTitle>Backup Your Keys</CardTitle>
        <CardDescription>
          Create an encrypted backup to recover your messages on other devices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="prompt-password">Backup Password</Label>
          <Input
            id="prompt-password"
            type="password"
            placeholder="Enter a strong password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-confirm">Confirm Password</Label>
          <Input
            id="prompt-confirm"
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
          <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            This password encrypts your private key. Without it, you cannot recover your messages.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex gap-3">
        {onSkip && (
          <Button variant="outline" className="flex-1" onClick={onSkip}>
            Skip for now
          </Button>
        )}
        <Button
          className="flex-1"
          onClick={handleBackup}
          disabled={isLoading || password.length < 8 || password !== confirmPassword}
        >
          {isLoading ? 'Creating...' : 'Download Backup'}
        </Button>
      </CardFooter>
    </Card>
  );
}
