import React, { useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import getAppSetting from '@/actions/settings/getAppSetting';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';

/**
 * S3-backed file upload.
 *
 * Flow: reads the `s3_presign_endpoint` app setting (Settings → Users &
 * Planning → Integrations). That endpoint (a tiny AWS Lambda/API Gateway —
 * see docs/S3_SETUP.md) receives {filename, contentType} and returns
 * {uploadUrl, publicUrl}; the browser PUTs the file to uploadUrl and the
 * publicUrl is handed to onUploaded for storage in the *_file column.
 *
 * Fallback: when no endpoint is configured, small files (< 300 KB) are
 * inlined as data URLs so avatars/thumbnails still work out of the box;
 * larger files prompt the user to configure S3.
 */
const INLINE_LIMIT_BYTES = 300 * 1024;

export function FileUpload({ accept, label, onUploaded, disabled }: {
  accept?: string;
  label?: string;
  onUploaded: (url: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [setting] = useLoadAction(getAppSetting, [], { key: 's3_presign_endpoint' });
  const endpoint = (((setting as { value: string }[]) || [])[0]?.value || '').trim();

  const handleFile = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      if (endpoint) {
        const presignRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        if (!presignRes.ok) throw new Error(`Presign failed (${presignRes.status})`);
        const { uploadUrl, publicUrl } = await presignRes.json() as { uploadUrl: string; publicUrl: string };
        if (!uploadUrl || !publicUrl) throw new Error('Presign endpoint returned no URLs');
        const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
        onUploaded(publicUrl);
      } else if (file.size <= INLINE_LIMIT_BYTES) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        onUploaded(dataUrl);
      } else {
        setError('File too large for inline storage — configure the S3 upload endpoint under Settings → Integrations (see docs/S3_SETUP.md).');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
        {busy ? 'Uploading…' : (label || 'Upload file')}
      </Button>
      {!endpoint && <p className="text-xs text-slate-400">No S3 endpoint configured — small files stored inline.</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
