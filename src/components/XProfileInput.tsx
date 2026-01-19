'use client';

import { useState, useCallback, useRef } from 'react';

interface XProfileInputProps {
  onImageReady: (file: File, preview: string) => void;
  disabled?: boolean;
}

export default function XProfileInput({
  onImageReady,
  disabled = false,
}: XProfileInputProps) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUsername(text.trim());
      setError(null);
    } catch {
      // Clipboard API might not be available or permission denied
      inputRef.current?.focus();
    }
  }, []);

  const fetchImageAsFile = useCallback(
    async (imageUrl: string, handle: string): Promise<{ file: File; preview: string }> => {
      // For unavatar.io URLs, fetch directly (they have CORS enabled)
      // For Twitter URLs, use our proxy
      let fetchUrl = imageUrl;

      if (imageUrl.includes('pbs.twimg.com') || imageUrl.includes('abs.twimg.com')) {
        fetchUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      }

      const response = await fetch(fetchUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch profile picture');
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const blob = await response.blob();

      // Create File object
      const extension = contentType.split('/')[1]?.split(';')[0] || 'jpg';
      const fileName = `${handle}-profile.${extension}`;
      const file = new File([blob], fileName, { type: contentType });

      // Create preview URL
      const preview = URL.createObjectURL(blob);

      return { file, preview };
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!username.trim() || isLoading || disabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get profile picture URL from username
      const response = await fetch('/api/get-profile-pic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get profile picture');
      }

      const imageUrl = data.imageUrl;
      const handle = data.username || username.trim().replace('@', '');

      // Step 2: Fetch the image and create File
      const { file, preview } = await fetchImageAsFile(imageUrl, handle);

      // Step 3: Pass to parent
      onImageReady(file, preview);
    } catch (err) {
      console.error('Profile picture fetch error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [username, isLoading, disabled, fetchImageAsFile, onImageReady]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="w-full space-y-3">
      {/* Username label */}
      <label className="block text-sm font-medium text-gray-700">
        X Username
      </label>

      {/* Username Input with Paste button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium select-none">
            @
          </span>
          <input
            ref={inputRef}
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="username"
            disabled={disabled || isLoading}
            className={`
              w-full pl-8 pr-16 py-3 rounded-xl border bg-white text-sm
              placeholder:text-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              ${error ? 'border-red-300' : 'border-gray-200'}
            `}
          />
          <button
            type="button"
            onClick={handlePaste}
            disabled={disabled || isLoading}
            className={`
              absolute right-2 top-1/2 -translate-y-1/2
              px-3 py-1.5 text-xs font-medium rounded-lg
              bg-gray-100 text-gray-600 hover:bg-gray-200
              transition-colors
              ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            Paste
          </button>
        </div>

        {/* Wojakify Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || isLoading || !username.trim()}
          className={`
            px-5 py-3 rounded-xl font-medium text-sm
            transition-all
            ${
              disabled || isLoading || !username.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
            }
          `}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </span>
          ) : (
            'Wojakify'
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-500 animate-fade-in">{error}</p>
      )}

      {/* Hint */}
      <p className="text-xs text-gray-400 text-center">
        Enter an X/Twitter username to use their profile picture
      </p>
    </div>
  );
}
