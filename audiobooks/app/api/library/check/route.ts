import { NextRequest, NextResponse } from 'next/server';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const { books, formats } = await request.json();

    const results = await Promise.all(
      books.map(async (book: { title: string; author: string }, index: number) => {
        // Add delay to appear more natural
        await delay(200 * index);

        const sources: any = {};

        // Check Libby
        try {
          let libbyUrl = `https://dekalb.overdrive.com/search?query=${encodeURIComponent(
            book.title + ' ' + book.author
          )}`;

          if (formats.includes('audiobooks')) {
            libbyUrl += '&mediaType=audiobook';
          } else if (formats.includes('ebooks')) {
            libbyUrl += '&mediaType=ebook';
          }

          await delay(2000);

          const libbyResponse = await fetch(libbyUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
          });

          const libbyHtml = await libbyResponse.text();

          const hasResults =
            libbyHtml.includes('title-container') ||
            libbyHtml.includes('js-titleCard') ||
            libbyHtml.includes('search-results') ||
            libbyHtml.includes('result-item');

          const noResults =
            libbyHtml.toLowerCase().includes('no results') ||
            libbyHtml.toLowerCase().includes("we didn't find");

          const titleWords = book.title.toLowerCase().split(' ');
          const hasTitleWords = titleWords.some(word =>
            word.length > 3 && libbyHtml.toLowerCase().includes(word)
          );

          sources.libby = {
            available: hasResults || (hasTitleWords && !noResults),
            link: libbyUrl,
          };
        } catch (error) {
          console.error(`Error checking Libby for ${book.title}:`, error);
          sources.libby = {
            available: false,
            link: `https://dekalb.overdrive.com/search?query=${encodeURIComponent(
              book.title + ' ' + book.author
            )}`,
          };
        }

        // Check Hoopla (only for audiobooks and ebooks)
        if (formats.includes('audiobooks') || formats.includes('ebooks')) {
          try {
            const kindId = formats.includes('audiobooks') ? '8' : '5';
            const hooplaUrl = `https://www.hoopladigital.com/search?title=${encodeURIComponent(
              book.title
            ).replace(/%20/g, '+')}&artistName=${encodeURIComponent(book.author).replace(
              /%20/g,
              '+'
            )}&kindId=${kindId}`;

            await delay(4000);

            const hooplaResponse = await fetch(hooplaUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                Referer: 'https://www.hoopladigital.com/',
              },
            });

            const hooplaHtml = await hooplaResponse.text();

            const hasResults =
              hooplaHtml.includes('hoopla-title') ||
              hooplaHtml.includes('title-card') ||
              hooplaHtml.includes('search-results') ||
              hooplaHtml.includes('product-card');

            const noResults =
              hooplaHtml.toLowerCase().includes('no results') ||
              hooplaHtml.toLowerCase().includes('no titles found');

            const titleWords = book.title.toLowerCase().split(' ');
            const hasTitleWords = titleWords.some(word =>
              word.length > 3 && hooplaHtml.toLowerCase().includes(word)
            );

            sources.hoopla = {
              available: hasResults || (hasTitleWords && !noResults),
              link: hooplaUrl,
            };
          } catch (error) {
            console.error(`Error checking Hoopla for ${book.title}:`, error);
            const kindId = formats.includes('audiobooks') ? '8' : '5';
            sources.hoopla = {
              available: false,
              link: `https://www.hoopladigital.com/search?title=${encodeURIComponent(
                book.title
              ).replace(/%20/g, '+')}&artistName=${encodeURIComponent(book.author).replace(
                /%20/g,
                '+'
              )}&kindId=${kindId}`,
            };
          }
        }

        // Check Audible (only for audiobooks)
        if (formats.includes('audiobooks') || formats.length === 0) {
          const audibleUrl = `https://www.audible.com/search?keywords=${encodeURIComponent(
            book.title + ' ' + book.author
          )}`;

          sources.audible = {
            available: true,
            link: audibleUrl,
          };
        }

        // Get book cover from Open Library
        let coverUrl = null;
        let isbn = null;
        try {
          const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(
            book.title + ' ' + book.author
          )}&limit=1`;

          const searchResponse = await fetch(searchUrl);
          const searchData = await searchResponse.json();

          if (searchData.docs && searchData.docs.length > 0) {
            const doc = searchData.docs[0];
            isbn = doc.isbn?.[0] || doc.isbn?.[1] || null;

            if (isbn) {
              coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
            } else if (doc.cover_edition_key) {
              coverUrl = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
            } else if (doc.cover_i) {
              coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
            }
          }
        } catch (error) {
          console.error(`Error fetching cover for ${book.title}:`, error);
        }

        return {
          book: {
            title: book.title,
            author: book.author,
            isbn,
            coverUrl,
          },
          sources,
        };
      })
    );

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Error in library check API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check library availability' },
      { status: 500 }
    );
  }
}
