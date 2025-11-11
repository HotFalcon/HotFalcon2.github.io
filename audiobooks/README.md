# Audiobook Recommender

A personalized audiobook recommendation system powered by OpenAI that analyzes your reading history and suggests new audiobooks you'll love. Also includes a library availability checker for Libby, Hoopla, and Audible.

## Features

- **CSV Import**: Import your reading history from Goodreads or StoryGraph
- **Manual Input**: Manually add books you've read, are reading, or want to read
- **AI-Powered Recommendations**: Get personalized audiobook suggestions using OpenAI's GPT-4
- **Library Availability**: Check if recommended books are available at your local library (Libby, Hoopla, Audible)
- **Smart Duplicate Prevention**: Never get the same recommendation twice
- **Dark Mode**: Automatic dark mode support based on system preferences
- **Persistent Storage**: All your inputs and preferences are saved locally

## Prerequisites

- Node.js 18 or later
- npm or yarn
- OpenAI API key

## Installation

1. Navigate to the audiobooks directory:
   ```bash
   cd audiobooks
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. The OpenAI API key is already configured in `.env.local` (this file is gitignored for security)

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

### Getting Recommendations

1. **Import your reading history** (optional):
   - Export your library from Goodreads or StoryGraph as a CSV file
   - Click "Choose File" and select your CSV file
   - The app will automatically categorize your books

2. **Add manual entries** (optional):
   - Enter books in the format "Title by Author" (one per line)
   - Fill in Past Audiobooks, Currently Reading, and Want to Read sections
   - Add any additional preferences

3. **Generate recommendations**:
   - Click "Get Recommendations"
   - The app will suggest 5 audiobooks tailored to your reading preferences
   - Click "Refresh Recommendations" to get new suggestions (won't repeat previous suggestions)

### Checking Library Availability

1. Click "Check Library Availability" in the header
2. Select the formats you want to check (Audiobooks, eBooks, Physical Books)
3. Click "Search Availability"
4. View results for Libby, Hoopla, and Audible

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)

2. Go to [Vercel](https://vercel.com) and sign in

3. Click "New Project" and import your repository

4. Configure your project:
   - Framework Preset: Next.js
   - Root Directory: `audiobooks`
   - Build Command: `npm run build`
   - Output Directory: `.next`

5. Add environment variable:
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

6. Click "Deploy"

7. Once deployed, update the link in `index.html` to point to your Vercel URL

### Deploy to Netlify

1. Build the project:
   ```bash
   npm run build
   ```

2. Go to [Netlify](https://www.netlify.com) and sign in

3. Drag and drop the `.next` folder or connect your Git repository

4. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`

5. Add environment variables in Netlify dashboard:
   - `OPENAI_API_KEY`: Your OpenAI API key

### Other Hosting Options

This is a Next.js application with API routes, so it requires a Node.js server. You can deploy to:
- Railway
- Render
- DigitalOcean App Platform
- Heroku
- AWS Amplify

## Project Structure

```
audiobooks/
├── app/
│   ├── api/
│   │   ├── books/          # Fetch book metadata from Open Library
│   │   ├── library/check/  # Check library availability
│   │   └── suggest/        # Generate AI recommendations
│   ├── library-check/      # Library availability checker page
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main recommendation page
├── components/
│   ├── AvailabilityCard.tsx  # Library availability display
│   └── BookCard.tsx          # Book recommendation display
├── lib/
│   ├── csvParser.ts        # CSV parsing utilities
│   └── storage.ts          # LocalStorage management
├── .env.local              # Environment variables (gitignored)
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required for generating recommendations)

## Security Notes

- The `.env.local` file is gitignored to keep your API key safe
- Never commit your API key to version control
- When deploying, add the API key as an environment variable in your hosting platform
- The API key is only used server-side and is never exposed to the client

## Technologies Used

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- OpenAI API
- Open Library API
- PapaParse (CSV parsing)

## License

This project inherits the license from the parent repository (Creative Commons Attribution 4.0 International License).
