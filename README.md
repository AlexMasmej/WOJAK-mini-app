# Wojakify

Transform your photos into Wojak-style meme illustrations. A mobile-first web app powered by Google Vertex AI Imagen.

![Wojakify Demo](https://via.placeholder.com/800x400?text=Wojakify+Demo)

## Features

- **Instant Transformation**: Upload a photo and get a Wojak-style illustration in seconds
- **Tweet Image Extraction**: Paste a tweet URL to extract and wojakify the image (beta)
- **4 Archetypes**: Choose from Neutral Wojak, Doomer, NPC, or Chad styles
- **Customizable**: Adjust identity preservation and background simplification
- **Mobile-First**: Optimized for mobile browsers with touch-friendly UI
- **Privacy-Focused**: Images processed in memory, never stored
- **Download & Share**: Save your creation as WebP or share directly

> **Note:** Tweet URL extraction is best-effort without the X API. If extraction fails, paste the image URL directly (right-click the image on X, copy image address) or upload the image manually.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Provider**: Google Vertex AI (Imagen / Gemini)
- **Image Processing**: Sharp

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Cloud account with Vertex AI enabled

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd wojak-mini-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:
   ```env
   # Required: Google Cloud Configuration
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_CLOUD_LOCATION=us-central1

   # Option A: Service Account (recommended for production)
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

   # Option B: API Key (simpler for development)
   # GOOGLE_API_KEY=your-api-key

   # Optional: Rate limiting
   RATE_LIMIT_MAX_REQUESTS=10
   RATE_LIMIT_WINDOW_MS=60000

   # Optional: Cache TTL
   CACHE_TTL_SECONDS=300
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLOUD_PROJECT_ID` | Yes* | - | Your GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | No | `us-central1` | Vertex AI region |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | - | Path to service account JSON |
| `GOOGLE_API_KEY` | Yes* | - | Alternative: API key auth |
| `RATE_LIMIT_MAX_REQUESTS` | No | `10` | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window (ms) |
| `CACHE_TTL_SECONDS` | No | `300` | Image cache TTL |
| `IMAGE_PROVIDER` | No | `gemini` | AI provider (extensible) |

*Either `GOOGLE_CLOUD_PROJECT_ID` + `GOOGLE_APPLICATION_CREDENTIALS` OR `GOOGLE_API_KEY` is required.

## Google Cloud Setup

### 1. Create a Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

### 2. Enable APIs
Enable the following APIs:
- Vertex AI API
- Cloud AI Platform API

```bash
gcloud services enable aiplatform.googleapis.com
```

### 3. Create Service Account (Recommended)
```bash
# Create service account
gcloud iam service-accounts create wojakify-sa \
  --display-name="Wojakify Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:wojakify-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Create key
gcloud iam service-accounts keys create ./service-account-key.json \
  --iam-account=wojakify-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 4. Set Environment Variable
```bash
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-key.json"
```

## Deploy to Vercel

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Deploy
```bash
vercel
```

### 3. Set Environment Variables
In your Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add your Google Cloud credentials:
   - For `GOOGLE_APPLICATION_CREDENTIALS`: Use the **contents** of your JSON file as `GOOGLE_APPLICATION_CREDENTIALS_JSON`
   - Or use `GOOGLE_API_KEY` for simpler setup

### 4. Production Deployment
```bash
vercel --prod
```

### Custom Domain Setup

1. In Vercel dashboard, go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records:
   - **A Record**: `76.76.21.21`
   - **CNAME**: `cname.vercel-dns.com`
4. Wait for SSL certificate provisioning (automatic)

## API Reference

### POST /api/wojakify

Transform an image to Wojak style.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `image` (File, required): Image file (JPG, PNG, WebP, max 10MB)
  - `archetype` (string): `neutral` | `doomer` | `npc` | `chad`
  - `simplifyBackground` (string): `true` | `false`
  - `identityStrength` (string): `0-100`

**Response:**
```json
{
  "success": true,
  "imageBase64": "...",
  "cached": false
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

**Rate Limiting:**
- Default: 10 requests per minute per IP
- Headers: `X-RateLimit-Remaining`, `Retry-After`

### POST /api/extract-image

Extract image URL from a tweet or validate a direct image URL.

**Request:**
- Content-Type: `application/json`
- Body:
  ```json
  {
    "url": "https://x.com/user/status/123...",
    "mode": "tweet"
  }
  ```
  - `mode`: `"tweet"` to extract from tweet HTML, or `"image"` to validate a direct image URL

**Response:**
```json
{
  "success": true,
  "imageUrl": "https://pbs.twimg.com/media/..."
}
```

**Notes:**
- Tweet extraction parses `og:image` and `twitter:image` meta tags from the tweet page
- Direct image URLs must be from `pbs.twimg.com` or `abs.twimg.com`
- Images are normalized to original quality when possible

### GET /api/image-proxy

Proxy images from Twitter's CDN to handle CORS.

**Request:**
- Query: `?url=https://pbs.twimg.com/media/...`

**Response:**
- Streams the image bytes with appropriate content-type
- Maximum size: 10MB

**Allowed hosts:** `pbs.twimg.com` only

## Cost Considerations

### Vertex AI Pricing (Approximate)
- Image generation: ~$0.02-0.04 per image
- Varies by model and region

### Optimization Tips
1. **Caching**: Results are cached for 5 minutes by default
2. **Rate Limiting**: Prevents abuse and runaway costs
3. **Image Resizing**: Input images are resized to 1024px before processing

### Monthly Estimates
| Usage | Approx. Cost |
|-------|--------------|
| 1,000 images/month | $20-40 |
| 10,000 images/month | $200-400 |
| 100,000 images/month | $2,000-4,000 |

*Set up [billing alerts](https://cloud.google.com/billing/docs/how-to/budgets) in Google Cloud!*

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── wojakify/
│   │   │   └── route.ts      # Image transformation API
│   │   ├── extract-image/
│   │   │   └── route.ts      # Tweet/image URL extraction API
│   │   └── image-proxy/
│   │       └── route.ts      # Image proxy for CORS
│   ├── about/
│   │   └── page.tsx          # About page
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main page
├── components/
│   ├── ImageUploader.tsx     # Drag-drop upload
│   ├── TweetImageInput.tsx   # Tweet/image URL input
│   ├── SettingsPanel.tsx     # Archetype & settings
│   ├── ResultViewer.tsx      # Before/after view
│   └── LoadingState.tsx      # Loading animation
├── lib/
│   ├── stylizers/
│   │   ├── base.ts           # Abstract stylizer
│   │   ├── gemini-imagen.ts  # Vertex AI implementation
│   │   └── index.ts          # Factory
│   ├── cache.ts              # In-memory cache
│   └── rate-limit.ts         # Rate limiter
└── types/
    └── index.ts              # TypeScript types
```

## Extending the AI Provider

The architecture supports swapping AI providers. To add a new provider:

1. Create a new file in `src/lib/stylizers/`:
   ```typescript
   // src/lib/stylizers/replicate.ts
   import { BaseImageStylizer } from './base';

   export class ReplicateStylizer extends BaseImageStylizer {
     async stylize(input) {
       // Your implementation
     }
   }
   ```

2. Update the factory in `src/lib/stylizers/index.ts`:
   ```typescript
   case 'replicate':
     return new ReplicateStylizer();
   ```

3. Set `IMAGE_PROVIDER=replicate` in your environment.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Acknowledgments

- Wojak meme community for the iconic art style
- [Wojak Database](https://wojakdb.com/) for reference material
- Google Cloud for AI infrastructure
