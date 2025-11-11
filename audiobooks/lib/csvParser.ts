import Papa from 'papaparse';
import { Book, ParsedBooks } from './storage';

export function parseCSV(file: File): Promise<ParsedBooks> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const parsedBooks: ParsedBooks = {
          pastReads: [],
          currentReads: [],
          wantToReads: [],
        };

        results.data.forEach((row: any) => {
          if (!row.Title) return;

          const book: Book = {
            title: row.Title || '',
            authors: row.Authors || row.Author || '',
            isbn: row['ISBN/UID'] || row.ISBN || row.ISBN13 || '',
            format: row.Format || '',
            readStatus: row['Read Status'] || row['Exclusive Shelf'] || '',
            starRating: row['Star Rating'] || row['My Rating'] || '',
          };

          const status = book.readStatus.toLowerCase();
          if (status === 'read') {
            parsedBooks.pastReads.push(book);
          } else if (status === 'currently-reading' || status === 'currently reading') {
            parsedBooks.currentReads.push(book);
          } else if (status === 'to-read' || status === 'want to read') {
            parsedBooks.wantToReads.push(book);
          }
        });

        resolve(parsedBooks);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
