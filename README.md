# Miniflux Connector for Tapestry

A Tapestry connector that integrates Miniflux (minimalist RSS reader) into your Tapestry timeline.

## ⚠️ Heads Up

This project is still in development. We don't guarantee anything yet and you use 
it at your own risk. No guaranteed support, but feel free to report any bugs you find!

## About

This connector allows you to read your unread articles from any Miniflux instance directly in the Tapestry app. It supports category filtering, customizable article limits, and the ability to mark articles as read without leaving Tapestry.

## Features

- 📰 Display unread articles from Miniflux in Tapestry
- 🏷️ Filter by specific categories
- ✅ Mark articles as read/unread from Tapestry
- ⭐ Star/unstar articles
- 🖼️ Media attachments support (images, audio, video from enclosures)
- 🌐 Works with any Miniflux instance (self-hosted or cloud)
- 🔒 Secure authentication with API Token
- ⚙️ Customizable fetch limit

## Installation

### Option 1: Direct Installation (Recommended)

1. Download the latest `ch.alienlebarge.miniflux.tapestry` file from the [Releases page](../../releases)
2. Save the file to your iPhone/iPad (e.g., in the Files app)
3. Open **Tapestry** on your device
4. Go to **Settings** → **Connectors**
5. Tap **Add a Connector**
6. Select the `ch.alienlebarge.miniflux.tapestry` file you downloaded
7. Configure your Miniflux instance details

### Option 2: Manual Installation (For Developers)

1. Clone or download this repository
2. Copy the `ch.alienlebarge.miniflux` folder to your Tapestry Connectors directory
3. In Tapestry, add a new connector and select "Miniflux"
4. Configure your Miniflux instance details

## Quick Start

You'll need:
- Your Miniflux instance URL (e.g., `https://your-instance.miniflux.app`)
- Your Miniflux API token (generate in Miniflux: Settings → API Keys)

See the [full documentation](ch.alienlebarge.miniflux/README.md) in the connector folder for detailed setup instructions.

## Project Structure

```
tapestry-miniflux-connector/
├── .github/
│   └── workflows/
│       └── release.yml        # Automated release workflow
├── ch.alienlebarge.miniflux/
│   ├── plugin-config.json    # Connector metadata
│   ├── ui-config.json         # User configuration interface
│   ├── plugin.js              # Main connector logic
│   ├── actions.json           # Available actions (mark as read)
│   └── README.md              # Detailed documentation
├── LICENSE                    # MIT License
└── README.md                  # This file
```

**Note:** The `ch.alienlebarge.miniflux.tapestry` package file is automatically generated during releases and is not tracked in the repository.

## Resources

- [Tapestry](https://github.com/TheIconfactory/Tapestry) - The timeline app
- [Miniflux](https://miniflux.app/) - Minimalist RSS reader
- [Tapestry API Documentation](https://github.com/TheIconfactory/Tapestry/blob/main/Documentation/API.md)
- [Miniflux API Documentation](https://miniflux.app/docs/api.html)

## License

MIT License - See LICENSE file for details

## Development

### Release Process

This project uses GitHub Actions to automatically build and publish the `.tapestry` package file when a new release is created.

**To create a new release:**

1. Create and push a new tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. Create a release on GitHub using the tag

3. The workflow will automatically:
   - Build the `ch.alienlebarge.miniflux.tapestry` package
   - Attach it to the release as a downloadable asset

**Manual package creation (if needed):**

```bash
cd ch.alienlebarge.miniflux
zip -r ../ch.alienlebarge.miniflux.tapestry .
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues or questions, please open an issue on GitHub.

## 🤖 Development Note

This project was created as an experiment: **writing minimal code using AI as the primary assistant**. The goal was to explore the possibilities offered by artificial intelligence in software development and test how far we can go by delegating most of the coding work to AI.
