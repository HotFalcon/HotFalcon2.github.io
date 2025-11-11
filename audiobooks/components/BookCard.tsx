import Image from 'next/image';

interface BookCardProps {
  title: string;
  author: string;
  coverUrl?: string | null;
  description?: string | null;
  reason?: string;
}

export default function BookCard({ title, author, coverUrl, description, reason }: BookCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg hover:shadow-xl transition-shadow p-4 flex flex-col h-full">
      <div className="relative w-full aspect-[2/3] mb-4">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={`Cover of ${title}`}
            fill
            className="object-cover rounded"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 rounded flex items-center justify-center">
            <span className="text-6xl">📚</span>
          </div>
        )}
      </div>
      <h3 className="font-bold text-lg mb-1 line-clamp-2">{title}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{author}</p>
      {reason && (
        <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2 italic line-clamp-3">
          {reason}
        </p>
      )}
      {description && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 flex-grow">
          {description}
        </p>
      )}
    </div>
  );
}
