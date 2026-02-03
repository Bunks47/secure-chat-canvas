// Key Fingerprint Display Component for Visual Verification

import { Shield, Copy, Check, QrCode } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface KeyFingerprintDisplayProps {
  fingerprint: string;
  label?: string;
  compact?: boolean;
  showCopyButton?: boolean;
  showQrButton?: boolean;
  className?: string;
}

/**
 * Format fingerprint for display (groups of 4 characters)
 */
function formatFingerprint(fingerprint: string): string {
  // Remove any existing formatting
  const clean = fingerprint.replace(/[^a-fA-F0-9]/g, '');
  // Split into groups of 4
  return clean.match(/.{1,4}/g)?.join(' ') || fingerprint;
}

/**
 * Generate a simple visual pattern from fingerprint
 */
function FingerprintPattern({ fingerprint }: { fingerprint: string }) {
  // Create a 4x4 grid based on fingerprint characters
  const clean = fingerprint.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  const cells = clean.slice(0, 16).split('');
  
  return (
    <div className="grid grid-cols-4 gap-0.5 w-12 h-12">
      {cells.map((char, i) => {
        // Convert hex char to intensity value (0-15)
        const value = parseInt(char, 16);
        const hue = (value * 22.5) % 360; // Spread across color wheel
        const saturation = 60 + (value % 4) * 10;
        const lightness = 45 + (value % 3) * 10;
        
        return (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-sm"
            style={{
              backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
            }}
          />
        );
      })}
    </div>
  );
}

export function KeyFingerprintDisplay({
  fingerprint,
  label = 'Key Fingerprint',
  compact = false,
  showCopyButton = true,
  showQrButton = false,
  className,
}: KeyFingerprintDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/5 cursor-help',
              className
            )}
          >
            <Shield className="w-3 h-3 text-primary" />
            <span className="font-mono text-xs text-muted-foreground">
              {fingerprint.slice(0, 8)}...
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="text-xs font-medium">Full Fingerprint:</p>
            <p className="font-mono text-xs break-all">{formatFingerprint(fingerprint)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">{label}</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Compare this with your contact to verify their identity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <FingerprintPattern fingerprint={fingerprint} />
          <div className="flex-1 space-y-2">
            <div className="font-mono text-sm bg-muted rounded-lg p-3 break-all">
              {formatFingerprint(fingerprint)}
            </div>
            <div className="flex gap-2">
              {showCopyButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 mr-1.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1.5" />
                      Copy
                    </>
                  )}
                </Button>
              )}
              {showQrButton && (
                <Button variant="outline" size="sm" className="h-8">
                  <QrCode className="w-3 h-3 mr-1.5" />
                  Show QR
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inline fingerprint for message/conversation headers
 */
export function InlineFingerprint({ fingerprint }: { fingerprint: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
      <Shield className="w-3 h-3 text-primary" />
      {fingerprint.slice(0, 12)}...
    </span>
  );
}
