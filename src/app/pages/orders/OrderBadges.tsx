import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const STATUS_STYLES: Record<string, string> = {
  quote: 'bg-slate-100 text-slate-700 border-slate-200',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  partially_shipped: 'bg-orange-100 text-orange-700 border-orange-200',
  shipped: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700 border-red-200',
  partial_paid: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  refunded: 'bg-purple-100 text-purple-700 border-purple-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`text-xs px-1.5 py-0 font-medium border capitalize ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'}`} variant="outline">
      {status.replace('_', ' ')}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  return (
    <Badge className={`text-xs px-1.5 py-0 font-medium border ${PAYMENT_STYLES[status] || 'bg-gray-100 text-gray-700'}`} variant="outline">
      {status.replace('_', ' ')}
    </Badge>
  );
}

export function SourceBadges({ hasWarehouse, hasChina }: { hasWarehouse: boolean; hasChina: boolean }) {
  return (
    <div className="flex gap-1">
      {hasWarehouse && (
        <Badge className="text-xs px-1 py-0 bg-blue-50 text-blue-600 border-blue-200" variant="outline">WH</Badge>
      )}
      {hasChina && (
        <Badge className="text-xs px-1 py-0 bg-purple-50 text-purple-600 border-purple-200" variant="outline">CN</Badge>
      )}
    </div>
  );
}

export function FreeBadge({ reason }: { reason?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="text-xs px-1 py-0 bg-yellow-50 text-yellow-700 border-yellow-200 cursor-help" variant="outline">
            FREE
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{reason || 'Free order'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ChannelBadge({ channel }: { channel?: string }) {
  const colors: Record<string, string> = {
    telegram: 'bg-sky-50 text-sky-700 border-sky-200',
    signal: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    discord: 'bg-violet-50 text-violet-700 border-violet-200',
    whatsapp: 'bg-green-50 text-green-700 border-green-200',
    root: 'bg-amber-50 text-amber-700 border-amber-200',
    other: 'bg-gray-50 text-gray-600 border-gray-200',
  };
  if (!channel) return null;
  return (
    <Badge className={`text-xs px-1.5 py-0 border capitalize ${colors[channel] || colors.other}`} variant="outline">
      {channel}
    </Badge>
  );
}
