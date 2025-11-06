import requests
from datetime import datetime
import json

# Your SeatGeek API credentials
CLIENT_ID = "NDE5MzI5MzV8MTc0NTM1NDIzMi44OTk5Mzk"
CLIENT_SECRET = "e0bb3fac0c0e9446e7da8a53d795d673330205153e212c3ba6d95bfbcca9ba78"

# SeatGeek API endpoint for events
url = "https://api.seatgeek.com/2/events"

# Parameters to filter for Atlanta Braves games on/near April 22, 2025
params = {
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "performers.slug": "atlanta-braves",
    "datetime_local.gte": "2025-04-22",
    "datetime_local.lte": "2025-04-23",
    "per_page": 10,
    "sort": "datetime_local.asc"
}

try:
    # Make the API request
    response = requests.get(url, params=params)
    response.raise_for_status()

    # Parse the JSON response
    data = response.json()

    # Print the full raw JSON response in a formatted way
    print("=== Full API Response ===")
    print(json.dumps(data, indent=2))  # Pretty-print the entire response
    print("=== End of Full API Response ===")

    # Extract and print basic event details for reference
    events = data.get("events", [])
    if not events:
        print("\nNo Atlanta Braves games found for April 22-23, 2025.")
    else:
        print("\n=== Summary of Atlanta Braves Games ===")
        for event in events:
            event_title = event["title"]
            event_date = event["datetime_local"]
            venue = event["venue"]["name"]
            stats = event.get("stats", {})
            lowest_price = stats.get("lowest_price", "N/A")
            average_price = stats.get("average_price", "N/A")
            listing_count = stats.get("listing_count", "N/A")
            event_id = event.get("id", "N/A")

            # Convert date to a readable format
            event_date_formatted = datetime.strptime(event_date, "%Y-%m-%dT%H:%M:%S").strftime("%B %d, %Y %I:%M %p")

            # Print event summary
            print(f"Game: {event_title}")
            print(f"Event ID: {event_id}")
            print(f"Date: {event_date_formatted}")
            print(f"Venue: {venue}")
            print(f"Lowest Ticket Price: ${lowest_price if lowest_price != 'N/A' else 'N/A'}")
            print(f"Average Ticket Price: ${average_price if average_price != 'N/A' else 'N/A'}")
            print(f"Number of Tickets Listed: {listing_count}")
            print("-" * 50)

except requests.exceptions.RequestException as e:
    print(f"Error fetching data from SeatGeek API: {e}")