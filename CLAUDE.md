# Tapestry Miniflux Connector

## Project Overview

This is a Tapestry connector that integrates Miniflux RSS reader into the Tapestry timeline app. It allows users to view unread articles from their Miniflux instance and mark them as read directly from Tapestry.

## Architecture

### Connector Structure
```
io.davlin.news/
├── plugin-config.json    # Connector metadata (id, display_name, check_interval, item_style)
├── ui-config.json         # User configuration inputs (apiToken, limit)
├── plugin.js              # Main connector logic with required functions
├── actions.json           # Available user actions (mark_as_read)
└── README.md              # Detailed user documentation
```

**Important**: The folder name (`io.davlin.news`) MUST match the `id` field in `plugin-config.json`.

### Configuration Variables

The connector uses these configuration variables (defined in `ui-config.json`):

- **`site`** - Miniflux instance URL (configured via `site_prompt` in plugin-config.json)
- **`apiToken`** - Miniflux API token for authentication
- **`limit`** - Number of articles to fetch (default: 500)

These variables are automatically available as global variables in `plugin.js`.

### Required Tapestry Functions

The connector implements three mandatory functions:

1. **`verify()`** - Validates configuration and authenticates with Miniflux API (`/v1/me` endpoint)
   - Skips verification if `site` or `apiToken` are not yet provided (iOS behavior during typing)
   - Returns user info and sets `displayName` via `processVerification()`

2. **`load()`** - Fetches unread entries from Miniflux API (`/v1/entries`) and converts them to Tapestry Items
   - Uses adaptive time window: 7 days on first load, 4 hours on subsequent loads
   - Uses the user-configured `limit` (default 500)
   - Stores fetch timestamp with `setItem()` for multi-device sync
   - Calls `processResults()` with array of items

3. **`performAction(actionId, actionValue, item)`** - Handles user actions via Miniflux API
   - `mark_as_read` / `mark_as_unread`: Updates entry status via `PUT /v1/entries`
   - `star` / `unstar`: Toggles bookmark via `PUT /v1/entries/{id}/bookmark`
   - Uses `raiseCondition("authorize")` on 401 errors to trigger re-authentication

### Item Creation Pattern

```javascript
// Create item with unique URI and date
var uri = entry.url + "#" + entry.id;
var date = new Date(entry.published_at);
var item = Item.createWithUriDate(uri, date);

// Set basic properties
item.title = entry.title;
item.body = entry.content;  // Full HTML content

// Use Identity API for author (feed name with favicon)
if (entry.feed && entry.feed.title) {
    var author = Identity.createWithName(entry.feed.title);

    // Add favicon using DuckDuckGo icon service
    if (entry.feed.site_url) {
        var domain = entry.feed.site_url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        author.avatar = "https://icons.duckduckgo.com/ip3/" + domain + ".ico";
    }

    item.author = author;
}

// Use Identity API for source
if (entry.feed && entry.feed.title) {
    var source = Identity.createWithName(entry.feed.title);

    if (entry.feed.site_url) {
        source.uri = entry.feed.site_url;
    }

    item.source = source;
}

// Add actions using actions dictionary
var actions = {};
var entryId = entry.id.toString();

if (entry.status === "unread") {
    actions["mark_as_read"] = entryId;
} else {
    actions["mark_as_unread"] = entryId;
}

if (entry.starred) {
    actions["unstar"] = entryId;
} else {
    actions["star"] = entryId;
}

item.actions = actions;

// Add media attachments from enclosures
if (entry.enclosures && entry.enclosures.length > 0) {
    var attachments = [];
    for (var j = 0; j < entry.enclosures.length; j++) {
        var enclosure = entry.enclosures[j];
        if (enclosure.url && enclosure.mime_type) {
            var attachment = MediaAttachment.createWithUrl(enclosure.url);
            attachment.mimeType = enclosure.mime_type;
            attachments.push(attachment);
        }
    }
    if (attachments.length > 0) {
        item.attachments = attachments;
    }
}
```

**Critical Guidelines**:
- Never assign `undefined` to item properties. JavaScript will convert it to the string `"undefined"`. Use conditional logic instead.
- Always use `Identity.createWithName()` for `author` and `source` - never use plain objects
- Always convert actionValue to string: `entry.id.toString()`
- Use DuckDuckGo icon service for favicons: `https://icons.duckduckgo.com/ip3/{domain}.ico`

## API Integrations

### Miniflux API
- **Base URL**: User-configured instance URL (e.g., `https://your-instance.miniflux.app`)
- **Authentication**: X-Auth-Token header with API token
  ```javascript
  {
      "X-Auth-Token": apiToken,
      "Content-Type": "application/json"
  }
  ```
- **Key Endpoints**:
  - `GET /v1/me` - Verify authentication and get user info
  - `GET /v1/entries?status=unread&order=published_at&direction=desc&{timeParam}={timestamp}&limit={limit}` - Fetch entries
    - First load uses `published_after` (7 days back), subsequent loads use `changed_after` (4 hours back) for better multi-device sync
    - `limit`: Maximum number of entries to fetch (default: 500)
  - `PUT /v1/entries` - Update entry status
    - Body (JSON): `{ "entry_ids": [id], "status": "read" }` or `{ "entry_ids": [id], "status": "unread" }`
    - **Must be passed to `sendRequest` as a string** via `JSON.stringify(...)` — Tapestry does NOT serialize objects for you (see Tapestry API note below).
  - `PUT /v1/entries/{id}/bookmark` - Toggle star/bookmark status (no body)

### Tapestry API
- Follow ECMA-262 specification (standard JavaScript only)
- No DOM or browser APIs available
- Use `sendRequest(url, method, parameters, extraHeaders, fullResponse)` for HTTP calls
  - Official signature: `parameters` is the request body and **must be a `String`** (e.g. `JSON.stringify(obj)` for a JSON body, or a form-encoded string like `"foo=1&bar=2"`). Passing a raw JS object does NOT work — Tapestry will not serialize it, so the server receives a malformed/empty body. This is the classic reason a `PUT`/`POST` action silently fails.
  - Returns a Promise that resolves with the response body as a string
  - Parse JSON with `JSON.parse(response)`
- Variables from `ui-config.json` are pre-populated as global variables
- Use `Item.createWithUriDate(uri, date)` to create timeline items
- Use `Identity.createWithName(name)` to create author/source objects
- Call `processResults(items)` to return items from `load()`
- Call `processVerification(config)` to signal successful verification
- Call `processError(message)` to signal errors
- In `performAction()`, you **must** call `actionComplete(results, error)` on every path:
  - Success: `actionComplete(item, null)` (pass the updated item)
  - Failure: `actionComplete(null, error)`
  - Only one action per feed runs at a time — skipping `actionComplete` leaves the queue stuck and blocks all later actions.

## Development Workflow

### Local Testing
1. Use **Tapestry Loom** on Mac for development
2. Edit files in `io.davlin.news/`
3. Press **Cmd-R** to reload connector
4. Press **Load** button to test execution

### Release Process

**Automated via GitHub Actions** - DO NOT commit `.tapestry` files to the repository.

1. Create and push a git tag:
   ```bash
   git tag v1.x.x
   git push origin v1.x.x
   ```
2. Create a GitHub release using the tag
3. Workflow automatically builds `io.davlin.news.tapestry` and attaches it to the release

Manual package creation (if needed):
```bash
cd io.davlin.news
zip -r ../io.davlin.news.tapestry .
```

## Code Conventions

- Use clear function documentation with JSDoc comments
- Handle errors gracefully with user-friendly messages
- Log operations with `console.log()` for debugging
- Keep JavaScript ES5-compatible (no arrow functions, const/let, etc.)
- Use `var` for variable declarations
- Use traditional `function` declarations

## Git Workflow

### Branch Naming
- Branch names must start with `claude/` and end with the session ID
- Format: `claude/<description>-<session-id>`
- Example: `claude/add-favicon-support-abc123`

### Commits and Pushes
- Write clear, descriptive commit messages following conventional commits style
- Use prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- Always push with `-u` flag: `git push -u origin <branch-name>`
- If push fails with 403, verify branch name starts with `claude/` and ends with session ID

### Current Branch
Check your current branch with `git branch --show-current` before making changes.

## Essential Resources

- [Tapestry API Documentation](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/API.md) - Complete API reference
- [Tapestry Getting Started](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/GettingStarted.md) - Development setup and workflow
- [Miniflux API Documentation](https://miniflux.app/docs/api.html) - Miniflux API reference

## Current Features

### Display & Styling
- **Item Style**: Uses `"post"` style in `plugin-config.json` for better timeline presentation
- **Feed Favicon**: Displays feed favicons as author avatars using DuckDuckGo icon service
- **Author Display**: Shows feed name as author (not article author) for better feed recognition
- **Category Support**: Displays Miniflux categories when available

### Performance Optimizations
- **Adaptive Time Window**: Uses smart time filtering (7 days on first load, 4 hours on subsequent loads)
- **Multi-Device Sync**: 4-hour window on subsequent loads captures changes made on other devices
- **Default Limit**: 500 articles (configurable by user)
- **Efficient Loading**: Full HTML content with optimized fetching

### User Actions
- **Mark as Read / Mark as Unread**: Toggle read status via Miniflux API
- **Star / Unstar**: Toggle bookmark status via Miniflux API

### Media Attachments
- **Enclosures**: Converts Miniflux enclosures (images, audio, video) to `MediaAttachment` objects
- **`provides_attachments: false`**: Tapestry continues to auto-generate image previews from body HTML

### Error Handling
- **401 errors**: Uses `raiseCondition("authorize")` to trigger Tapestry's re-authentication flow
- **404 errors in `load()`**: Uses `raiseCondition("disable")` to signal an unreachable instance
- **Other errors**: Falls back to `processError()` with descriptive messages

## Documentation Maintenance

### Important: README vs Code Defaults
Be aware that the user-facing README (`io.davlin.news/README.md`) may show different defaults than what's in the code:
- **README currently states**: Default limit is 10 articles
- **Actual default in ui-config.json**: 500 articles

When updating defaults, ALWAYS update BOTH files to maintain consistency.

## Common Development Patterns

### Building API URLs
```javascript
// Always remove trailing slashes
var baseUrl = site.replace(/\/$/, "");

// Build entry URL with parameters
var url = baseUrl + "/v1/entries?status=unread&order=published_at&direction=desc";

// Adaptive time window using getItem/setItem for persistence
var lastFetchTime = getItem("lastFetchTime");
var timestamp;
var timeParam;
if (!lastFetchTime) {
    // First load: 7 days back, use published_after
    timestamp = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    timeParam = "published_after";
} else {
    // Subsequent loads: 4 hours back, use changed_after for multi-device sync
    timestamp = Math.floor(Date.now() / 1000) - (4 * 60 * 60);
    timeParam = "changed_after";
}
url += "&" + timeParam + "=" + timestamp;

// After successful fetch, save timestamp
setItem("lastFetchTime", Math.floor(Date.now() / 1000).toString());

// Add limit
var articleLimit = limit || 500;
url += "&limit=" + articleLimit;
```

### Error Handling
```javascript
// In load() catch handler — use raiseCondition for persistent errors
.catch(function(error) {
    if (error.message && error.message.includes("401")) {
        raiseCondition("authorize",
            "Authentication Failed",
            "Your API token is invalid or expired. Please re-enter your credentials."
        );
    } else if (error.message && error.message.includes("404")) {
        raiseCondition("disable",
            "Instance Not Found",
            "The Miniflux instance URL appears to be incorrect or the server is no longer available."
        );
    } else {
        processError("Failed to load articles: " + error);
    }
});
```

### Processing Responses
```javascript
sendRequest(url, "GET", null, getAuthHeaders())
    .then(function(response) {
        // Response is a string, must parse JSON
        var data = JSON.parse(response);

        // Process data and create items
        var items = [];
        for (var i = 0; i < data.entries.length; i++) {
            items.push(convertEntryToItem(data.entries[i]));
        }

        // Signal completion
        processResults(items);
    })
    .catch(function(error) {
        processError("Failed to load: " + error);
    });
```

## Troubleshooting

### "undefined" appearing in output
- **Cause**: Assigning `undefined` to item properties
- **Fix**: Always use conditional checks before assignment
  ```javascript
  // BAD
  item.title = entry.title;  // If entry.title is undefined, becomes "undefined"

  // GOOD
  if (entry.title) {
      item.title = entry.title;
  }
  ```

### Items not displaying properly
- **Cause**: Not using Identity API for author/source
- **Fix**: Always create Identity objects
  ```javascript
  // BAD
  item.author = { name: "Feed Name" };

  // GOOD
  var author = Identity.createWithName("Feed Name");
  item.author = author;
  ```

### Authentication failures
- **Cause**: Wrong header format or missing authentication
- **Fix**: Ensure `X-Auth-Token` header is set correctly
  ```javascript
  {
      "X-Auth-Token": apiToken,
      "Content-Type": "application/json"
  }
  ```

### Verify function called repeatedly
- **Normal behavior**: On iOS, `verify()` is called as the user types
- **Solution**: Return early if fields are incomplete
  ```javascript
  if (!site || !apiToken) {
      console.log("Skipping verification - fields not yet complete");
      return Promise.resolve();
  }
  ```

## Critical Guardrails

1. **Never commit `.tapestry` package files** - They are build artifacts (see `.gitignore`)
2. **Folder name must match plugin ID** - `io.davlin.news` everywhere
3. **Test authentication in `verify()`** - Always check credentials before fetching data
4. **Use reverse domain notation** - Follow `io.davlin.news` pattern
5. **No ES6+ syntax** - Stick to ES5 for Tapestry compatibility
6. **Identity API required** - Always use `Identity.createWithName()` for author/source
7. **Never assign undefined** - Use conditional checks before assigning properties
8. **Verify behavior** - The `verify()` function returns early if fields are incomplete (iOS typing behavior)
9. **String conversion for IDs** - Always convert numeric IDs to strings: `.toString()`
10. **Promise handling** - Always return Promises from async functions; use `.then()/.catch()` chains

## Repository Structure

```
tapestry-miniflux-connector/
├── .github/
│   └── workflows/
│       └── release.yml           # Automated release workflow (builds .tapestry package)
├── .git/                         # Git repository data
├── .gitignore                    # Excludes .DS_Store, *.tapestry, etc.
├── LICENSE                       # MIT License
├── CLAUDE.md                     # This file - AI assistant instructions
├── README.md                     # User-facing project documentation
└── io.davlin.news/     # Main connector folder
    ├── plugin-config.json        # Connector metadata and settings
    ├── ui-config.json            # User input configuration
    ├── plugin.js                 # Main JavaScript implementation
    ├── actions.json              # User action definitions
    └── README.md                 # User-facing connector documentation
```

### Key Files Explained

**`plugin-config.json`**
- Defines connector ID, display name, icon URL, and check interval
- Sets `item_style: "post"` for timeline presentation
- Configures verification requirements

**`ui-config.json`**
- Defines user input fields: `apiToken`, `limit`
- Sets default values (limit: 500)
- Controls input types and validation

**`plugin.js`**
- Core connector logic with ES5 JavaScript
- Implements `verify()`, `load()`, and `performAction()` functions
- Helper functions for API communication and data conversion

**`actions.json`**
- Defines available user actions: `mark_as_read`, `mark_as_unread`, `star`, `unstar`
- Includes display name and icon for each action

**`.github/workflows/release.yml`**
- Automatically builds `.tapestry` package on release creation
- Triggered when a git tag is created and pushed
- Uploads package as release asset

## Version History Reference

Based on git history, key milestones include:
- Initial implementation with mark_as_read action
- Addition of Identity API for author/source
- Feed name as author display
- Miniflux icon integration
- Adaptive time window (7 days first load, 4 hours subsequent) and increased limits (50 → 500)
- Post-style display with feed favicons

## Working with this Codebase

### Before Making Changes
1. Read the current `plugin.js` to understand existing patterns
2. Check both `ui-config.json` and `plugin-config.json` for configuration
3. Review recent git commits to understand recent changes
4. Test locally with Tapestry Loom if possible

### After Making Changes
1. Update both code and relevant README files
2. Test with actual Miniflux instance if possible
3. Check console output for errors or warnings
4. Commit with clear, descriptive messages
5. Push to the correct branch (must start with `claude/`)

### Creating a Release
1. Ensure all changes are committed and pushed
2. Create and push a version tag: `git tag v1.x.x && git push origin v1.x.x`
3. Create a GitHub release using that tag
4. GitHub Actions will automatically build and attach the `.tapestry` file
5. Users can download the `.tapestry` file from the release page

## Testing Checklist

When making changes, verify:
- [ ] `verify()` returns early if fields are incomplete
- [ ] `verify()` calls `processVerification()` on success
- [ ] `load()` fetches entries with correct parameters
- [ ] `load()` calls `processResults()` with item array
- [ ] `performAction()` correctly marks entries as read
- [ ] No `undefined` strings appear in output
- [ ] All IDs are converted to strings
- [ ] Identity API used for author/source
- [ ] Error messages are user-friendly
- [ ] Console logging helps with debugging
