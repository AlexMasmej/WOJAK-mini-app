'use client';

import { useState, useCallback, useRef } from 'react';

type InputMode = 'tweet' | 'image';

interface TweetImageInputProps {
  onImageReady: (file: File, preview: string) => void;
  disabled?: boolean;
}

export default function TweetImageInput({
  onImageReady,
  disabled = false,
}: TweetImageInputProps) {
  const [mode, setMode] = useState<InputMode>('tweet');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFallbackHint, setShowFallbackHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text.trim());
      setError(null);
      setShowFallbackHint(false);
    } catch {
      // Clipboard API might not be available or permission denied
      inputRef.current?.focus();
    }
  }, []);

  const handleModeChange = useCallback((newMode: InputMode) => {
    setMode(newMode);
    setError(null);
    setShowFallbackHint(false);
  }, []);

  const fetchImageAsFile = useCallback(
    async (imageUrl: string): Promise<{ file: File; preview: string }> => {
      // Fetch through our proxy to handle CORS
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch image (HTTP ${response.status})`);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const blob = await response.blob();

      // Create File object
      const extension = contentType.split('/')[1] || 'jpg';
      const fileName = `tweet-image.${extension}`;
      const file = new File([blob], fileName, { type: contentType });

      // Create preview URL
      const preview = URL.createObjectURL(blob);

      return { file, preview };
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!url.trim() || isLoading || disabled) return;

    setIsLoading(true);
    setError(null);
    setShowFallbackHint(false);

    try {
      // Step 1: Extract/validate image URL
      const extractResponse = await fetch('/api/extract-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), mode }),
      });

      const extractData = await extractResponse.json();

      if (!extractResponse.ok || !extractData.success) {
        // Show fallback hint for tweet extraction failures
        if (mode === 'tweet') {
          setShowFallbackHint(true);
        }
        throw new Error(extractData.error || 'Failed to extract image');
      }

      const imageUrl = extractData.imageUrl;

      // Step 2: Fetch the image through proxy and create File
      const { file, preview } = await fetchImageAsFile(imageUrl);

      // Step 3: Pass to parent
      onImageReady(file, preview);
    } catch (err) {
      console.error('Tweet image extraction error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [url, mode, isLoading, disabled, fetchImageAsFile, onImageReady]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleSwitchToImageMode = useCallback(() => {
    setMode('image');
    setUrl('');
    setError(null);
    setShowFallbackHint(false);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="w-full space-y-3">
      {/* Segmented Toggle */}
      <div className="flex rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => handleModeChange('tweet')}
          disabled={disabled || isLoading}
          className={`
            flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all
            ${
              mode === 'tweet'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }
            ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          Tweet URL <span className="text-xs text-gray-400">(beta)</span>
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('image')}
          disabled={disabled || isLoading}
          className={`
            flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all
            ${
              mode === 'image'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }
            ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          Image URL
        </button>
      </div>

      {/* URL Input with Paste button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
              setShowFallbackHint(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'tweet'
                ? 'https://x.com/user/status/123...'
                : 'https://pbs.twimg.com/media/...'
            }
            disabled={disabled || isLoading}
            className={`
              w-full px-4 py-3 pr-16 rounded-xl border bg-white text-sm
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

        {/* Fetch/Use Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || isLoading || !url.trim()}
          className={`
            px-5 py-3 rounded-xl font-medium text-sm
            transition-all
            ${
              disabled || isLoading || !url.trim()
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
          ) : mode === 'tweet' ? (
            'Fetch'
          ) : (
            'Use'
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-sm animate-fade-in">
          <p className="text-red-500">{error}</p>
          {showFallbackHint && (
            <button
              type="button"
              onClick={handleSwitchToImageMode}
              className="mt-2 text-blue-500 hover:text-blue-600 underline underline-offset-2"
            >
              Paste the image link instead (pbs.twimg.com/...) or upload below
            </button>
          )}
        </div>
      )}

      {/* Mode-specific hints */}
      <p className="text-xs text-gray-400 text-center">
        {mode === 'tweet' ? (
          <>
            Extracts the first image from a tweet.{' '}
            <span className="text-gray-300">Works best with public tweets.</span>
          </>
        ) : (
          <>
            Right-click a tweet image, copy image address, and paste above.
          </>
        )}
      </p>
    </div>
  );
}
