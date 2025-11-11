export interface Book {
  title: string;
  authors: string;
  isbn?: string;
  format: string;
  readStatus: string;
  starRating?: string;
}

export interface ParsedBooks {
  pastReads: Book[];
  currentReads: Book[];
  wantToReads: Book[];
}

export interface UserInputs {
  pastReads: string;
  currentReads: string;
  wantToReads: string;
  additionalPrompt: string;
}

export interface BookSuggestion {
  title: string;
  author: string;
  reason: string;
  isbn?: string;
  coverUrl?: string;
  description?: string;
}

const STORAGE_KEYS = {
  PAST_READS: 'audiobook_suggester_past_reads',
  CURRENT_READS: 'audiobook_suggester_current_reads',
  WANT_TO_READS: 'audiobook_suggester_want_to_reads',
  ADDITIONAL_PROMPT: 'audiobook_suggester_additional_prompt',
  SUGGESTIONS: 'audiobook_suggester_suggestions',
  PARSED_BOOKS: 'audiobook_suggester_parsed_books',
  PREVIOUSLY_SUGGESTED: 'audiobook_suggester_previously_suggested',
};

export function saveParsedBooks(parsedBooks: ParsedBooks): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.PARSED_BOOKS, JSON.stringify(parsedBooks));
  }
}

export function getParsedBooks(): ParsedBooks | null {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(STORAGE_KEYS.PARSED_BOOKS);
    return data ? JSON.parse(data) : null;
  }
  return null;
}

export function saveUserInputs(inputs: UserInputs): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.PAST_READS, inputs.pastReads);
    localStorage.setItem(STORAGE_KEYS.CURRENT_READS, inputs.currentReads);
    localStorage.setItem(STORAGE_KEYS.WANT_TO_READS, inputs.wantToReads);
    localStorage.setItem(STORAGE_KEYS.ADDITIONAL_PROMPT, inputs.additionalPrompt);
  }
}

export function getUserInputs(): UserInputs {
  if (typeof window !== 'undefined') {
    return {
      pastReads: localStorage.getItem(STORAGE_KEYS.PAST_READS) || '',
      currentReads: localStorage.getItem(STORAGE_KEYS.CURRENT_READS) || '',
      wantToReads: localStorage.getItem(STORAGE_KEYS.WANT_TO_READS) || '',
      additionalPrompt: localStorage.getItem(STORAGE_KEYS.ADDITIONAL_PROMPT) || '',
    };
  }
  return {
    pastReads: '',
    currentReads: '',
    wantToReads: '',
    additionalPrompt: '',
  };
}

export function saveSuggestions(suggestions: BookSuggestion[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(suggestions));
  }
}

export function getSuggestions(): BookSuggestion[] {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS);
    return data ? JSON.parse(data) : [];
  }
  return [];
}

export function savePreviouslySuggested(suggestions: BookSuggestion[]): void {
  if (typeof window !== 'undefined') {
    const existing = getPreviouslySuggested();
    const newTitles = suggestions.map(s => s.title.toLowerCase());
    const merged = Array.from(new Set([...existing, ...newTitles]));
    localStorage.setItem(STORAGE_KEYS.PREVIOUSLY_SUGGESTED, JSON.stringify(merged));
  }
}

export function getPreviouslySuggested(): string[] {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(STORAGE_KEYS.PREVIOUSLY_SUGGESTED);
    return data ? JSON.parse(data) : [];
  }
  return [];
}

export function clearPreviouslySuggested(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.PREVIOUSLY_SUGGESTED);
  }
}

export function clearAllData(): void {
  if (typeof window !== 'undefined') {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}
