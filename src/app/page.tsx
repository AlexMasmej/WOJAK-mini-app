'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ImageUploader, SettingsPanel, ResultViewer, LoadingState } from '@/components';
import { WojakifySettings, WojakifyResponse } from '@/types';

type AppState = 'upload' | 'ready' | 'processing' | 'result' | 'error';

const DEFAULT_SETTINGS: WojakifySettings = {
  archetype: 'neutral',
  simplifyBackground: true,
  identityStrength: 70,
};

export default function Home() {
  const [state, setState] = useState<AppState>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<WojakifySettings>(DEFAULT_SETTINGS);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = useCallback((file: File, preview: string) => {
    setSelectedFile(file);
    setPreviewUrl(preview);
    setState('ready');
    setError(null);
  }, []);

  const handleWojakify = useCallback(async () => {
    if (!selectedFile) return;

    setState('processing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('archetype', settings.archetype);
      formData.append('simplifyBackground', String(settings.simplifyBackground));
      formData.append('identityStrength', String(settings.identityStrength));

      const response = await fetch('/api/wojakify', {
        method: 'POST',
        body: formData,
      });

      const data: WojakifyResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process image');
      }

      if (data.imageBase64) {
        setResultImage(data.imageBase64);
        setState('result');
      } else {
        throw new Error('No image returned');
      }
    } catch (err) {
      console.error('Wojakify error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setState('error');
    }
  }, [selectedFile, settings]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResultImage(null);
    setError(null);
    setSettings(DEFAULT_SETTINGS);
    setState('upload');
  }, []);

  const handleTryAgain = useCallback(() => {
    setError(null);
    setState('ready');
  }, []);

  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-4 py-4 sm:py-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Wojakify
          </h1>
          <Link
            href="/about"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            About
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 px-4 pb-8 overflow-y-auto">
        <div className="max-w-lg mx-auto">
          {/* Upload / Ready State */}
          {(state === 'upload' || state === 'ready') && (
            <div className="space-y-6 animate-fade-in">
              <ImageUploader
                onImageSelect={handleImageSelect}
                currentPreview={previewUrl}
                disabled={false}
              />

              {state === 'ready' && (
                <>
                  <div className="bg-white rounded-2xl p-5 border border-gray-200">
                    <SettingsPanel
                      settings={settings}
                      onChange={setSettings}
                      disabled={false}
                    />
                  </div>

                  <button
                    onClick={handleWojakify}
                    className="btn-primary w-full text-lg py-4"
                  >
                    Wojakify
                  </button>
                </>
              )}

              {state === 'upload' && (
                <div className="text-center space-y-3">
                  <p className="text-gray-400 text-sm">
                    Your photos are processed securely and never stored
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                    <a
                      href="https://jup.ag/tokens/8J69rbLTzWWgUJziFY8jeu5tDwEPBwUz4pKBMr5rpump"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-700 font-medium transition-colors"
                    >
                      Buy $WOJAK
                    </a>
                    <span className="text-gray-300">•</span>
                    <a
                      href="https://x.com/wojakonx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Wojak on X
                    </a>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-400">
                      Made by{' '}
                      <a
                        href="https://x.com/alexmasmej"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        @alexmasmej
                      </a>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing State */}
          {state === 'processing' && <LoadingState />}

          {/* Result State */}
          {state === 'result' && previewUrl && resultImage && (
            <ResultViewer
              originalImage={previewUrl}
              resultImage={resultImage}
              onReset={handleReset}
            />
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                Oops, something went wrong
              </h2>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                {error || 'We couldn\'t process your image. Please try again.'}
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={handleTryAgain} className="btn-primary">
                  Try Again
                </button>
                <button onClick={handleReset} className="btn-secondary">
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="shrink-0 px-4 py-4 text-center">
        <p className="text-xs text-gray-400">
          Made for meme enthusiasts everywhere
        </p>
      </footer>
    </main>
  );
}
