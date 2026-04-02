import { useEffect, useMemo, useState } from 'react';

type Props = {
  src?: string;
  name: string;
  className?: string;
};

const normalizeUrl = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed;
  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
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

const Avatar = ({ src, name, className }: Props) => {
  const [errored, setErrored] = useState(false);
  const [attempt, setAttempt] = useState<0 | 1 | 2>(0);

  const normalizedSrc = useMemo(() => normalizeUrl(src ?? ''), [src]);
  const proxiedSrc = useMemo(() => (normalizedSrc ? `/api/avatar?url=${encodeURIComponent(normalizedSrc)}` : ''), [normalizedSrc]);
  const initials = useMemo(() => getInitials(name), [name]);

  const effectiveSrc = attempt === 2 ? proxiedSrc : normalizedSrc;

  useEffect(() => {
    setErrored(false);
    setAttempt(0);
  }, [normalizedSrc]);

  if (!effectiveSrc || errored) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-black/40 text-white/80 font-black ${className ?? ''}`}>
        {initials}
      </div>
    );
  }

  return (
    <img
      key={`${effectiveSrc}:${attempt}`}
      src={effectiveSrc}
      alt={name}
      className={className}
      loading="lazy"
      {...(attempt === 1 ? { referrerPolicy: 'no-referrer' as const } : {})}
      onError={() => {
        if (attempt === 0) return setAttempt(1);
        if (attempt === 1) return setAttempt(2);
        return setErrored(true);
      }}
    />
  );
};

export default Avatar;
