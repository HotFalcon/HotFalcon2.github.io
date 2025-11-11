import Image from 'next/image';

interface Source {
  available: boolean;
  link: string;
  waitTime?: string;
  price?: string;
}

interface AvailabilityCardProps {
  book: {
    title: string;
    author: string;
    isbn?: string | null;
    coverUrl?: string | null;
  };
  sources: {
    libby?: Source;
    hoopla?: Source;
    audible?: Source;
  };
}

export default function AvailabilityCard({ book, sources }: AvailabilityCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-4 mb-4">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Book Cover */}
        <div className="relative w-32 h-48 flex-shrink-0">
          {book.coverUrl ? (
            <Image
              src={book.coverUrl}
              alt={`Cover of ${book.title}`}
              fill
              className="object-cover rounded"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 rounded flex items-center justify-center">
              <span className="text-4xl">📚</span>
            </div>
          )}
        </div>

        {/* Book Info and Availability */}
        <div className="flex-grow">
          <h3 className="font-bold text-lg mb-1">{book.title}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">{book.author}</p>

          <div className="space-y-2">
            {/* Libby */}
            {sources.libby && (
              <a
                href={sources.libby.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <span className="text-xl">📚</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">Libby</span>
                {sources.libby.available && (
                  <span className="ml-auto text-green-600 dark:text-green-400">✓ Available</span>
                )}
                {sources.libby.waitTime && (
                  <span className="ml-auto text-orange-600 dark:text-orange-400">
                    {sources.libby.waitTime}
                  </span>
                )}
              </a>
            )}

            {/* Hoopla */}
            {sources.hoopla && (
              <a
                href={sources.hoopla.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <span className="text-xl">🎧</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">Hoopla</span>
                {sources.hoopla.available && (
                  <span className="ml-auto text-green-600 dark:text-green-400">✓ Available</span>
                )}
              </a>
            )}

            {/* Audible */}
            {sources.audible && (
              <a
                href={sources.audible.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              >
                <span className="text-xl">🔊</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">Audible</span>
                {sources.audible.available && (
                  <span className="ml-auto text-green-600 dark:text-green-400">✓ Available</span>
                )}
                {sources.audible.price && (
                  <span className="ml-auto text-zinc-600 dark:text-zinc-400">
                    {sources.audible.price}
                  </span>
                )}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
