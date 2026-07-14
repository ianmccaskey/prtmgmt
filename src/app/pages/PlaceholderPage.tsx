import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-1">{title}</h1>
      <p className="text-sm text-muted-foreground mb-6">{description || 'This page is coming soon.'}</p>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <Construction className="w-8 h-8 opacity-40" />
          <p className="text-sm">Under construction</p>
        </CardContent>
      </Card>
    </div>
  );
}
