import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wojakify - Transform Photos into Wojak Art',
  description: 'Turn any photo into a Wojak-style meme illustration. Fast, private, and fun.',
  keywords: ['wojak', 'meme', 'image filter', 'art style', 'photo transformation'],
  authors: [{ name: 'Wojakify' }],
  openGraph: {
    title: 'Wojakify - Transform Photos into Wojak Art',
    description: 'Turn any photo into a Wojak-style meme illustration',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wojakify',
    description: 'Turn any photo into a Wojak-style meme illustration',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="min-h-screen min-h-[100dvh] flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
