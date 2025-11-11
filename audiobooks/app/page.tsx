'use client';

import { useState, useEffect, useRef } from 'react';
import { parseCSV } from '@/lib/csvParser';
import {
  saveParsedBooks,
  getParsedBooks,
  saveUserInputs,
  getUserInputs,
  saveSuggestions,
  getSuggestions,
  savePreviouslySuggested,
  getPreviouslySuggested,
  type ParsedBooks,
  type BookSuggestion,
} from '@/lib/storage';
import BookCard from '@/components/BookCard';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [pastReads, setPastReads] = useState('');
  const [currentReads, setCurrentReads] = useState('');
  const [wantToReads, setWantToReads] = useState('');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [parsedBooks, setParsedBooks] = useState<ParsedBooks | null>(null);
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImportedBooks, setShowImportedBooks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    // Load saved data
    const inputs = getUserInputs();
    setPastReads(inputs.pastReads);
    setCurrentReads(inputs.currentReads);
    setWantToReads(inputs.wantToReads);
    setAdditionalPrompt(inputs.additionalPrompt);

    const savedParsedBooks = getParsedBooks();
    if (savedParsedBooks) {
      setParsedBooks(savedParsedBooks);
    }

    const savedSuggestions = getSuggestions();
    if (savedSuggestions.length > 0) {
      setSuggestions(savedSuggestions);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      saveUserInputs({
        pastReads,
        currentReads,
        wantToReads,
        additionalPrompt,
      });
    }
  }, [pastReads, currentReads, wantToReads, additionalPrompt, mounted]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const parsed = await parseCSV(file);
      setParsedBooks(parsed);
      saveParsedBooks(parsed);

      const totalBooks =
        parsed.pastReads.length + parsed.currentReads.length + parsed.wantToReads.length;
      setSuccess(`Successfully imported ${totalBooks} books from CSV!`);
    } catch (err: any) {
      setError(`Failed to parse CSV: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Validate inputs
      const hasManualInput = pastReads || currentReads || wantToReads;
      const hasCsvData = parsedBooks && (
        parsedBooks.pastReads.length > 0 ||
        parsedBooks.currentReads.length > 0 ||
        parsedBooks.wantToReads.length > 0
      );

      if (!hasManualInput && !hasCsvData) {
        setError('Please provide at least some reading history (manual input or CSV import)');
        return;
      }

      const previouslySuggested = getPreviouslySuggested();

      // Call suggest API
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pastReads,
          currentReads,
          wantToReads,
          additionalPrompt,
          csvData: parsedBooks,
          previouslySuggested,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate suggestions');
      }

      const data = await response.json();
      let newSuggestions = data.suggestions;

      // Fetch book metadata
      const booksResponse = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          books: newSuggestions.map((s: any) => ({ title: s.title, author: s.author })),
        }),
      });

      if (booksResponse.ok) {
        const booksData = await booksResponse.json();
        newSuggestions = newSuggestions.map((suggestion: any, index: number) => ({
          ...suggestion,
          ...booksData.books[index],
        }));
      }

      setSuggestions(newSuggestions);
      saveSuggestions(newSuggestions);
      savePreviouslySuggested(newSuggestions);

      setSuccess(`Generated ${newSuggestions.length} new audiobook recommendations!`);
    } catch (err: any) {
      setError(err.message || 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mb-8"></div>
          </div>
        </div>
      </div>
    );
  }

  const totalImported = parsedBooks
    ? parsedBooks.pastReads.length + parsedBooks.currentReads.length + parsedBooks.wantToReads.length
    : 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Audiobook Suggester</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Get personalized audiobook recommendations based on your reading history
          </p>
          <div className="mt-4">
            <a
              href="/library-check"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Check Library Availability →
            </a>
          </div>
        </header>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-400 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Inputs */}
          <div>
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Your Reading History</h2>

              {/* CSV Import */}
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">
                  Import from Goodreads/StoryGraph
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-zinc-900 dark:text-zinc-100 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
                />
                {totalImported > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {totalImported} books imported
                    </p>
                    <button
                      onClick={() => setShowImportedBooks(!showImportedBooks)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {showImportedBooks ? 'Hide' : 'Show'} imported books
                    </button>
                    {showImportedBooks && parsedBooks && (
                      <div className="mt-4 max-h-96 overflow-y-auto">
                        {parsedBooks.pastReads.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold mb-2">Read ({parsedBooks.pastReads.length})</h4>
                            <ul className="text-sm space-y-1">
                              {parsedBooks.pastReads.map((book, i) => (
                                <li key={i} className="text-zinc-600 dark:text-zinc-400">
                                  {book.title} by {book.authors}
                                  {book.starRating && ` (${book.starRating} stars)`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {parsedBooks.currentReads.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold mb-2">Currently Reading ({parsedBooks.currentReads.length})</h4>
                            <ul className="text-sm space-y-1">
                              {parsedBooks.currentReads.map((book, i) => (
                                <li key={i} className="text-zinc-600 dark:text-zinc-400">
                                  {book.title} by {book.authors}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {parsedBooks.wantToReads.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold mb-2">Want to Read ({parsedBooks.wantToReads.length})</h4>
                            <ul className="text-sm space-y-1">
                              {parsedBooks.wantToReads.map((book, i) => (
                                <li key={i} className="text-zinc-600 dark:text-zinc-400">
                                  {book.title} by {book.authors}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Manual Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Past Audiobooks (one per line)
                  </label>
                  <textarea
                    value={pastReads}
                    onChange={(e) => setPastReads(e.target.value)}
                    placeholder="Example: The Hobbit by J.R.R. Tolkien"
                    rows={5}
                    className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Currently Reading
                  </label>
                  <textarea
                    value={currentReads}
                    onChange={(e) => setCurrentReads(e.target.value)}
                    placeholder="Example: Dune by Frank Herbert"
                    rows={3}
                    className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Want to Read
                  </label>
                  <textarea
                    value={wantToReads}
                    onChange={(e) => setWantToReads(e.target.value)}
                    placeholder="Example: Project Hail Mary by Andy Weir"
                    rows={3}
                    className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Additional Preferences
                  </label>
                  <textarea
                    value={additionalPrompt}
                    onChange={(e) => setAdditionalPrompt(e.target.value)}
                    placeholder="Example: I prefer sci-fi and fantasy with strong character development"
                    rows={3}
                    className="w-full p-3 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <button
                onClick={generateSuggestions}
                disabled={loading}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded transition-colors"
              >
                {loading ? 'Generating...' : 'Get Recommendations'}
              </button>

              {suggestions.length > 0 && (
                <button
                  onClick={generateSuggestions}
                  disabled={loading}
                  className="w-full mt-3 bg-zinc-600 hover:bg-zinc-700 disabled:bg-zinc-400 text-white font-semibold py-3 px-6 rounded transition-colors"
                >
                  {loading ? 'Generating...' : 'Refresh Recommendations'}
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Suggestions */}
          <div>
            {suggestions.length > 0 ? (
              <>
                <h2 className="text-2xl font-bold mb-4">Recommended for You</h2>
                <div className="grid grid-cols-1 gap-4">
                  {suggestions.map((suggestion, index) => (
                    <BookCard
                      key={index}
                      title={suggestion.title}
                      author={suggestion.author}
                      coverUrl={suggestion.coverUrl}
                      description={suggestion.description}
                      reason={suggestion.reason}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <span className="text-6xl mb-4">📚</span>
                <h2 className="text-2xl font-bold mb-2">No Recommendations Yet</h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Add your reading history and click &quot;Get Recommendations&quot; to get started!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
