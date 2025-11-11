import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { books } = await request.json();

    const enrichedBooks = await Promise.all(
      books.map(async (book: { title: string; author: string }) => {
        try {
          // Search Open Library
          const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(
            book.title + ' ' + book.author
          )}&limit=1`;

          const searchResponse = await fetch(searchUrl);
          const searchData = await searchResponse.json();

          if (!searchData.docs || searchData.docs.length === 0) {
            return {
              title: book.title,
              author: book.author,
              isbn: null,
              coverUrl: null,
              description: null,
            };
          }

          const doc = searchData.docs[0];

          // Extract ISBN
          const isbn = doc.isbn?.[0] || doc.isbn?.[1] || null;

          // Determine cover URL (priority: ISBN > cover_edition_key > cover_i)
          let coverUrl = null;
          if (isbn) {
            coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
          } else if (doc.cover_edition_key) {
            coverUrl = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
          } else if (doc.cover_i) {
            coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          }

          // Fetch description from work endpoint
          let description = null;
          if (doc.key) {
            try {
              const workUrl = `https://openlibrary.org${doc.key}.json`;
              const workResponse = await fetch(workUrl);
              const workData = await workResponse.json();

              if (workData.description) {
                description =
                  typeof workData.description === 'string'
                    ? workData.description
                    : workData.description.value;

                // Truncate to 300 characters
                if (description && description.length > 300) {
                  description = description.substring(0, 300) + '...';
                }
              }
            } catch (e) {
              // Description fetch failed, continue without it
            }
          }

          return {
            title: doc.title || book.title,
            author: doc.author_name?.[0] || book.author,
            isbn,
            coverUrl,
            description,
          };
        } catch (error) {
          console.error(`Error fetching metadata for ${book.title}:`, error);
          return {
            title: book.title,
            author: book.author,
            isbn: null,
            coverUrl: null,
            description: null,
          };
        }
      })
    );

    return NextResponse.json({ books: enrichedBooks });
  } catch (error: any) {
    console.error('Error in books API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch book metadata' },
      { status: 500 }
    );
  }
}
