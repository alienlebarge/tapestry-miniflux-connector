# Tapestry Miniflux Connector

## Project Overview

This is a Tapestry connector that integrates Miniflux RSS reader into the Tapestry timeline app. It allows users to view unread articles and mark them as read directly from Tapestry.

## Architecture

### Connector Structure
```
ch.alienlebarge.miniflux/
├── plugin-config.json    # Connector metadata (id, display_name, check_interval)
├── ui-config.json         # User configuration inputs (site, username, password, etc.)
├── plugin.js              # Main connector logic with required functions
├── actions.json           # Available user actions (mark_as_read)
└── README.md              # Detailed user documentation
```

**Important**: The folder name (`ch.alienlebarge.miniflux`) MUST match the `id` field in `plugin-config.json`.

### Required Tapestry Functions

The connector implements three mandatory functions:

1. **`verify()`** - Validates configuration and authenticates with Miniflux API (`/v1/me` endpoint)
2. **`load()`** - Fetches unread entries from Miniflux API (`/v1/entries`) and converts them to Tapestry Items
3. **`performAction(actionId, actionValue, item)`** - Handles "mark_as_read" action via Miniflux API (`PUT /v1/entries`)

### Item Creation Pattern

```javascript
const item = Item.createWithUriDate(uri, date);
item.title = "...";
item.body = "...";  // HTML content
item.author = { name: "..." };
item.source = { name: "...", uri: "..." };
item.action = "mark_as_read";
item.actionValue = entryId.toString();
```

**Critical**: Never assign `undefined` to item properties. JavaScript will convert it to the string `"undefined"`. Use conditional logic instead.

## API Integrations

### Miniflux API
- **Base URL**: User-configured instance URL (e.g., `https://your-instance.miniflux.app`)
- **Authentication**: HTTP Basic Auth (username:password in Base64)
- **Key Endpoints**:
  - `GET /v1/me` - Verify authentication
  - `GET /v1/entries?status=unread&order=published_at&direction=desc` - Fetch entries
  - `PUT /v1/entries` - Update entry status

### Tapestry API
- Follow ECMA-262 specification (standard JavaScript only)
- No DOM or browser APIs available
- Use `sendRequest()` for HTTP calls
- Variables from `ui-config.json` are pre-populated globally

## Development Workflow

### Local Testing
1. Use **Tapestry Loom** on Mac for development
2. Edit files in `ch.alienlebarge.miniflux/`
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
3. Workflow automatically builds `ch.alienlebarge.miniflux.tapestry` and attaches it to the release

Manual package creation (if needed):
```bash
cd ch.alienlebarge.miniflux
zip -r ../ch.alienlebarge.miniflux.tapestry .
```

## Code Conventions

- Use clear function documentation with JSDoc comments
- Handle errors gracefully with user-friendly messages
- Log operations with `console.log()` for debugging
- Keep JavaScript ES5-compatible (no arrow functions, const/let, etc.)
- Use `var` for variable declarations
- Use traditional `function` declarations

## Git Workflow

- **Development branch**: `claude/init-project-SiFXn`
- Commit messages should be clear and descriptive
- Push with: `git push -u origin <branch-name>`
- Branch names must start with `claude/` and end with session ID

## Essential Resources

- [Tapestry API Documentation](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/API.md) - Complete API reference
- [Tapestry Getting Started](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/GettingStarted.md) - Development setup and workflow
- [Miniflux API Documentation](https://miniflux.app/docs/api.html) - Miniflux API reference

## Critical Guardrails

1. **Never commit `.tapestry` package files** - They are build artifacts
2. **Folder name must match plugin ID** - `ch.alienlebarge.miniflux` everywhere
3. **Test authentication in `verify()`** - Always check credentials before fetching data
4. **Use reverse domain notation** - Follow `ch.alienlebarge.miniflux` pattern
5. **No ES6+ syntax** - Stick to ES5 for Tapestry compatibility
