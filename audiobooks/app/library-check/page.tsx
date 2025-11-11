'use client';

import { useState, useEffect } from 'react';
import { getParsedBooks, getUserInputs } from '@/lib/storage';
import AvailabilityCard from '@/components/AvailabilityCard';

export default function LibraryCheck() {
  const [mounted, setMounted] = useState(false);
  const [books, setBooks] = useState<{ title: string; author: string }[]>([]);
  const [formats, setFormats] = useState<string[]>(['audiobooks']);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    loadBooks();
  }, []);

  const loadBooks = () => {
    const booksToCheck: { title: string; author: string }[] = [];
    const seenTitles = new Set<string>();

    // Load from CSV
    const parsedBooks = getParsedBooks();
    if (parsedBooks) {
      parsedBooks.wantToReads.forEach((book) => {
        const titleLower = book.title.toLowerCase();
        if (!seenTitles.has(titleLower)) {
          booksToCheck.push({ title: book.title, author: book.authors });
          seenTitles.add(titleLower);
        }
      });
    }

    // Load from manual "Want to Read" entries
    const inputs = getUserInputs();
    if (inputs.wantToReads) {
      inputs.wantToReads.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const byIndex = trimmed.indexOf(' by ');
        let title: string;
        let author: string;

        if (byIndex > 0) {
          title = trimmed.substring(0, byIndex).trim();
          author = trimmed.substring(byIndex + 4).trim();
        } else {
          title = trimmed;
          author = '';
        }

        const titleLower = title.toLowerCase();
        if (!seenTitles.has(titleLower)) {
          booksToCheck.push({ title, author });
          seenTitles.add(titleLower);
        }
      });
    }

    setBooks(booksToCheck);
  };

  const checkAvailability = async () => {
    if (books.length === 0) {
      setError('No books to check. Add books to your "Want to Read" list first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/library/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          books,
          formats,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check library availability');
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err: any) {
      setError(err.message || 'Failed to check library availability');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mb-8"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Library Availability Checker</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Check if your &quot;Want to Read&quot; books are available at your library
          </p>
          <div className="mt-4">
            <a
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back to Audiobook Suggester
            </a>
          </div>
        </header>

        {/* Error Messages */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Check Settings</h2>

          <div className="mb-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
              {books.length} book{books.length !== 1 ? 's' : ''} found in your &quot;Want to Read&quot; list
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2">
              Format Selection
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formats.includes('audiobooks')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormats([...formats, 'audiobooks']);
                    } else {
                      setFormats(formats.filter((f) => f !== 'audiobooks'));
                    }
                  }}
                  className="mr-2"
                />
                <span>Audiobooks</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formats.includes('ebooks')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormats([...formats, 'ebooks']);
                    } else {
                      setFormats(formats.filter((f) => f !== 'ebooks'));
                    }
                  }}
                  className="mr-2"
                />
                <span>eBooks</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formats.includes('books')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormats([...formats, 'books']);
                    } else {
                      setFormats(formats.filter((f) => f !== 'books'));
                    }
                  }}
                  className="mr-2"
                />
                <span>Books (Physical)</span>
              </label>
            </div>
          </div>

          <button
            onClick={checkAvailability}
            disabled={loading || books.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking Availability...
              </span>
            ) : (
              'Search Availability'
            )}
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Availability Results</h2>
            <div className="space-y-4">
              {results.map((result, index) => (
                <AvailabilityCard
                  key={index}
                  book={result.book}
                  sources={result.sources}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && books.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-zinc-800 rounded-lg shadow-lg">
            <span className="text-6xl mb-4">📚</span>
            <h2 className="text-2xl font-bold mb-2">No Books to Check</h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              Add books to your &quot;Want to Read&quot; list on the main page to check their availability.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
