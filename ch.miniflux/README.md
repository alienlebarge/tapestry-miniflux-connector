# Miniflux Connector for Tapestry

Read your unread articles from Miniflux directly in your Tapestry timeline.

## About Miniflux

[Miniflux](https://miniflux.app/) is a minimalist and opinionated RSS/Atom feed reader. This connector allows you to integrate your Miniflux instance with Tapestry, bringing your unread articles into a unified timeline.

## Features

- ✅ Connect to any Miniflux instance (self-hosted or cloud)
- ✅ Display unread articles in chronological order
- ✅ Filter by specific categories (optional)
- ✅ Customize the number of articles to fetch
- ✅ Mark articles as read directly from Tapestry
- ✅ View article metadata (author, feed, category)
- ✅ Full HTML content support

## Installation

1. Download or clone this repository
2. Copy the `ch.miniflux` folder to your Tapestry Connectors directory
3. In Tapestry, go to Settings > Connectors
4. Add a new "Miniflux" connector
5. Configure your Miniflux instance details

## Configuration

### Required Settings

- **Miniflux Instance URL**: The full URL of your Miniflux instance
  - Example: `https://your-instance.miniflux.app`
  - Example: `https://splendid-ladybug.pikapod.net`
  - Make sure to include `https://` and remove any trailing slash

- **Username**: Your Miniflux username

- **Password or API Token**: Your Miniflux password or API token
  - You can use either your regular password or generate an API token in Miniflux settings
  - API tokens are more secure and recommended for production use

### Optional Settings

- **Category IDs**: Comma-separated list of category IDs to display
  - Example: `1,5,8`
  - Leave empty to show articles from all categories
  - To find category IDs, visit: `https://your-instance/v1/categories` (while logged in)

- **Number of articles to fetch**: Maximum number of unread articles to retrieve
  - Default: 50
  - Maximum: 100 (Miniflux API limit)

## How It Works

### Authentication

The connector uses HTTP Basic Authentication to connect to your Miniflux instance. Your credentials are encoded in Base64 and sent with each API request. Tapestry securely stores your credentials.

### Loading Articles

When you refresh your Tapestry timeline, the connector:

1. Connects to your Miniflux instance using your credentials
2. Fetches unread articles based on your configuration
3. Converts each article to a Tapestry timeline item
4. Displays them in chronological order (newest first)

### Article Information

Each article displays:

- **Title**: The article headline
- **Date**: Publication date
- **Author**: Article author (if available)
- **Content**: Full HTML content from the feed
- **Source**: The RSS feed name and website
- **Category**: The Miniflux category (if assigned)

### Marking as Read

You can mark articles as read directly from Tapestry:

1. Open the article actions menu
2. Select "Mark as Read"
3. The article will be marked as read in your Miniflux instance
4. On next refresh, the article will no longer appear in your timeline

## Finding Your Category IDs

To find the category IDs you want to filter:

1. Open your Miniflux instance in a browser
2. Log in with your credentials
3. Navigate to: `https://your-instance/v1/categories`
4. You'll see a JSON response with all your categories
5. Note the `id` field for each category you want to include

Example response:
```json
[
  {
    "id": 1,
    "title": "Tech",
    "user_id": 1
  },
  {
    "id": 5,
    "title": "News",
    "user_id": 1
  }
]
```

In this example, to show only Tech and News articles, enter: `1,5`

## Troubleshooting

### "Authentication failed" error

- Double-check your username and password
- Ensure your Miniflux account is active
- Try generating an API token in Miniflux settings and use that instead of your password

### "Miniflux instance not found" error

- Verify your instance URL is correct
- Make sure to include `https://`
- Remove any trailing slashes from the URL
- Check that your instance is accessible from your device

### No articles appearing

- Make sure you have unread articles in Miniflux
- Check if you're filtering by categories that have no unread articles
- Try increasing the article limit
- Check the Tapestry console for error messages

### Articles not marked as read

- Ensure you have write permissions in Miniflux
- Check your internet connection
- Try manually marking the article as read in Miniflux to verify it's not a permissions issue

## API Reference

This connector uses the following Miniflux API endpoints:

- `GET /v1/me` - Verify authentication
- `GET /v1/entries` - Fetch unread articles
- `PUT /v1/entries` - Mark articles as read

For more information, see the [Miniflux API Documentation](https://miniflux.app/docs/api.html).

## Privacy & Security

- Your Miniflux credentials are stored securely by Tapestry
- All communication with Miniflux uses HTTPS encryption
- No data is sent to third parties
- The connector only reads and updates article read status

## Development

This connector is written in JavaScript following the [Tapestry Connector API](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/API.md).

### Files

- `plugin-config.json` - Connector metadata
- `ui-config.json` - User input configuration
- `plugin.js` - Main connector code
- `actions.json` - Available user actions
- `README.md` - This documentation

### Testing

You can test this connector using [Tapestry Loom](https://github.com/TheIconfactory/Tapestry), the official development tool for Tapestry connectors.

## License

This connector is open source and available under the MIT License.

## Credits

Created for the Tapestry app by The Iconfactory.

Miniflux is created by Frédéric Guillot.

## Support

For issues or questions:

- [Tapestry Documentation](https://github.com/TheIconfactory/Tapestry)
- [Miniflux Documentation](https://miniflux.app/docs/)
- [GitHub Issues](https://github.com/alienlebarge/tapestry-miniflux-connector/issues)

## Version History

### 1.0.0 (2026-01-14)

- Initial release
- Support for authentication
- Fetch unread articles
- Category filtering
- Mark as read action
