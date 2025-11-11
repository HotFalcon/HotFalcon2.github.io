import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { pastReads, currentReads, wantToReads, additionalPrompt, csvData, previouslySuggested } = await request.json();

    // Build exclusion list
    const exclusionSet = new Set<string>();

    // Add CSV data to exclusion list
    if (csvData) {
      csvData.pastReads?.forEach((book: any) => {
        exclusionSet.add(book.title.toLowerCase().trim());
      });
      csvData.currentReads?.forEach((book: any) => {
        exclusionSet.add(book.title.toLowerCase().trim());
      });
      csvData.wantToReads?.forEach((book: any) => {
        exclusionSet.add(book.title.toLowerCase().trim());
      });
    }

    // Add manual entries to exclusion list
    const parseManualEntry = (entry: string) => {
      const byIndex = entry.toLowerCase().indexOf(' by ');
      return byIndex > 0 ? entry.substring(0, byIndex).trim() : entry.trim();
    };

    [pastReads, currentReads, wantToReads].forEach((list: string) => {
      if (list) {
        list.split('\n').forEach(line => {
          const title = parseManualEntry(line);
          if (title) exclusionSet.add(title.toLowerCase());
        });
      }
    });

    // Add previously suggested books
    if (previouslySuggested && Array.isArray(previouslySuggested)) {
      previouslySuggested.forEach((title: string) => {
        exclusionSet.add(title.toLowerCase().trim());
      });
    }

    const exclusionList = Array.from(exclusionSet);

    // Build prompt
    let prompt = 'You are an expert audiobook recommendation assistant. Based on the following reading history and preferences, suggest 5 audiobooks that the user would enjoy.\n\n';

    if (csvData?.pastReads?.length) {
      prompt += 'Past Books from Library (CSV):\n';
      csvData.pastReads.forEach((book: any) => {
        prompt += `- ${book.title} by ${book.authors}`;
        if (book.starRating) prompt += ` (${book.starRating} stars)`;
        prompt += '\n';
      });
      prompt += '\n';
    }

    if (csvData?.currentReads?.length) {
      prompt += 'Currently Reading from Library (CSV):\n';
      csvData.currentReads.forEach((book: any) => {
        prompt += `- ${book.title} by ${book.authors}\n`;
      });
      prompt += '\n';
    }

    if (csvData?.wantToReads?.length) {
      prompt += 'Want to Read from Library (CSV):\n';
      csvData.wantToReads.forEach((book: any) => {
        prompt += `- ${book.title} by ${book.authors}\n`;
      });
      prompt += '\n';
    }

    if (pastReads) {
      prompt += 'Past Audiobooks (Manual Entry):\n';
      pastReads.split('\n').forEach((line: string) => {
        if (line.trim()) prompt += `- ${line.trim()}\n`;
      });
      prompt += '\n';
    }

    if (currentReads) {
      prompt += 'Currently Reading (Manual Entry):\n';
      currentReads.split('\n').forEach((line: string) => {
        if (line.trim()) prompt += `- ${line.trim()}\n`;
      });
      prompt += '\n';
    }

    if (wantToReads) {
      prompt += 'Want to Read (Manual Entry):\n';
      wantToReads.split('\n').forEach((line: string) => {
        if (line.trim()) prompt += `- ${line.trim()}\n`;
      });
      prompt += '\n';
    }

    if (additionalPrompt) {
      prompt += `Additional Preferences:\n${additionalPrompt}\n\n`;
    }

    prompt += `CRITICAL: You MUST NOT suggest any of these ${exclusionList.length} books (they are already read, currently reading, want to read, or previously suggested):\n`;
    const displayList = exclusionList.slice(0, 50);
    displayList.forEach(title => {
      prompt += `- ${title}\n`;
    });
    if (exclusionList.length > 50) {
      prompt += `... and ${exclusionList.length - 50} more books\n`;
    }
    prompt += '\n';

    prompt += 'Please suggest EXACTLY 5 NEW audiobooks that match the user\'s reading preferences.\n\n';
    prompt += 'Format your response as a JSON object with a "suggestions" array containing EXACTLY 5 objects with the following structure:\n';
    prompt += '{\n';
    prompt += '  "suggestions": [\n';
    prompt += '    {\n';
    prompt += '      "title": "Book Title",\n';
    prompt += '      "author": "Author Name",\n';
    prompt += '      "reason": "Brief explanation of why this book matches their preferences"\n';
    prompt += '    },\n';
    prompt += '    ... (exactly 5 total)\n';
    prompt += '  ]\n';
    prompt += '}';

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful audiobook recommendation assistant. Always respond with valid JSON objects containing a "suggestions" array.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    let suggestions = [];
    try {
      const parsed = JSON.parse(content);
      suggestions = parsed.suggestions || parsed;
      if (!Array.isArray(suggestions)) {
        suggestions = [parsed];
      }
    } catch (e) {
      throw new Error('Failed to parse OpenAI response');
    }

    // Server-side filtering
    const filteredSuggestions = suggestions.filter((suggestion: any) => {
      const suggestionTitle = suggestion.title.toLowerCase().trim();

      // Check exact match
      if (exclusionSet.has(suggestionTitle)) return false;

      // Check partial match
      for (const excludedTitle of exclusionList) {
        if (suggestionTitle.includes(excludedTitle) || excludedTitle.includes(suggestionTitle)) {
          return false;
        }
      }

      return true;
    });

    // If we have fewer than 5 suggestions after filtering, make another call
    if (filteredSuggestions.length < 5) {
      const additionalNeeded = 5 - filteredSuggestions.length;
      const additionalResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful audiobook recommendation assistant. Always respond with valid JSON objects containing a "suggestions" array.',
          },
          {
            role: 'user',
            content: prompt + `\n\nNote: I need ${additionalNeeded} more suggestions. Please provide different books than before.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const additionalContent = additionalResponse.choices[0].message.content;
      if (additionalContent) {
        try {
          const additionalParsed = JSON.parse(additionalContent);
          const additionalSuggestions = additionalParsed.suggestions || additionalParsed;
          if (Array.isArray(additionalSuggestions)) {
            const additionalFiltered = additionalSuggestions.filter((suggestion: any) => {
              const suggestionTitle = suggestion.title.toLowerCase().trim();
              if (exclusionSet.has(suggestionTitle)) return false;
              for (const excludedTitle of exclusionList) {
                if (suggestionTitle.includes(excludedTitle) || excludedTitle.includes(suggestionTitle)) {
                  return false;
                }
              }
              return true;
            });
            filteredSuggestions.push(...additionalFiltered);
          }
        } catch (e) {
          // Ignore parsing errors for additional suggestions
        }
      }
    }

    // Return up to 5 suggestions
    const finalSuggestions = filteredSuggestions.slice(0, 5);

    return NextResponse.json({ suggestions: finalSuggestions });
  } catch (error: any) {
    console.error('Error in suggest API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
