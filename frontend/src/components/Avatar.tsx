import { useEffect, useMemo, useState } from 'react';
import { API_URL, useAuth } from '../context/AuthContext';

type Props = {
  src?: string;
  name: string;
  className?: string;
};

const isPrivateHostname = (host: string) => {
  const hostname = host.trim().toLowerCase();
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  const parts = hostname.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

const guessScheme = (rawWithoutScheme: string) => {
  const hostPort = rawWithoutScheme.trim().split('/')[0] ?? '';
  const host = hostPort.split(':')[0] ?? '';
  return isPrivateHostname(host) ? 'http://' : 'https://';
};

const rewriteKnownImageUrl = (url: URL) => {
  const host = url.hostname.toLowerCase();

  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const fileMatch = url.pathname.match(/^\/file\/d\/([^/]+)/);
    const idFromPath = fileMatch?.[1] ?? '';
    const idFromSearch = url.searchParams.get('id') ?? '';
    const id = idFromPath || idFromSearch;
    if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w400`;
  }

  if (host === 'dropbox.com' || host === 'www.dropbox.com') {
    url.searchParams.delete('dl');
    url.searchParams.set('raw', '1');
    return url.toString();
  }

  if (host === 'github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const blobIndex = parts.indexOf('blob');
    if (parts.length >= 5 && blobIndex === 2) {
      const owner = parts[0];
      const repo = parts[1];
      const ref = parts[3];
      const rest = parts.slice(4).join('/');
      return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest}`;
    }
  }

  return url.toString();
};

const normalizeUrl = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('//')) return `${window.location.protocol}${trimmed}`;
  if (trimmed.startsWith('/')) return new URL(trimmed, window.location.origin).toString();
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) return new URL(trimmed, window.location.href).toString();

  try {
    return rewriteKnownImageUrl(new URL(trimmed));
  } catch {
    try {
      return rewriteKnownImageUrl(new URL(`${guessScheme(trimmed)}${trimmed}`));
    } catch {
      return '';
    }
  }
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
};

const isInlineSrc = (value: string) => value.startsWith('data:') || value.startsWith('blob:');
const isRemoteSrc = (value: string) => /^https?:\/\//i.test(value);

const Avatar = ({ src, name, className }: Props) => {
  const { token } = useAuth();
  const normalizedSrc = useMemo(() => normalizeUrl(src ?? ''), [src]);
  const initials = useMemo(() => getInitials(name), [name]);
  const [displaySrc, setDisplaySrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    let cancelled = false;
    let objectUrl = '';

    const load = async () => {
      if (!normalizedSrc) {
        if (!cancelled) setDisplaySrc('');
        return;
      }

      if (isInlineSrc(normalizedSrc)) {
        if (!cancelled) setDisplaySrc(normalizedSrc);
        return;
      }

      if (isRemoteSrc(normalizedSrc) && token) {
        try {
          const response = await fetch(`${API_URL}/avatar?url=${encodeURIComponent(normalizedSrc)}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok) {
            const blob = await response.blob();
            const type = blob.type || '';
            const typeOk = !type || type.startsWith('image/') || type === 'application/octet-stream';
            if (blob.size > 32 && typeOk) {
              objectUrl = URL.createObjectURL(blob);
              if (cancelled) {
                URL.revokeObjectURL(objectUrl);
                return;
              }
              setDisplaySrc(objectUrl);
              return;
            }
          }
        } catch {
          // cai no fallback da URL original
        }
      }

      if (!cancelled) setDisplaySrc(normalizedSrc);
    };

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [normalizedSrc, token]);

  if (failed || !displaySrc) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-black/40 text-white/80 font-black ${className ?? ''}`}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={name}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

export default Avatar;
