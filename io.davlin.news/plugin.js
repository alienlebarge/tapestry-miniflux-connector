/**
 * Miniflux Connector for Tapestry
 *
 * This connector allows you to read unread articles from your Miniflux RSS reader
 * directly in your Tapestry timeline.
 *
 * Author: Tapestry Community
 * Version: 1.0.0
 */

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates the authentication header for Miniflux API requests
 * Uses the X-Auth-Token header with the API token
 *
 * @returns {Object} Headers object with Authorization header
 */
function getAuthHeaders() {
    return {
        "X-Auth-Token": apiToken,
        "Content-Type": "application/json"
    };
}

/**
 * Builds the Miniflux API URL for fetching entries
 *
 * @param {number} categoryId - Optional category ID to filter by
 * @param {number} timestamp - Unix timestamp to filter entries after this time
 * @param {string} timeParam - The time parameter name ("published_after" or "changed_after")
 * @returns {string} Complete API URL with query parameters
 */
function buildEntriesUrl(categoryId, timestamp, timeParam) {
    // Remove trailing slash from site URL if present
    var baseUrl = site.replace(/\/$/, "");

    // Start with base endpoint
    var url = baseUrl + "/v1/entries?status=unread&order=published_at&direction=desc";

    // Add time filter using provided parameter name and timestamp
    url += "&" + timeParam + "=" + timestamp;

    // Add limit parameter (default to 500 if not specified)
    var articleLimit = limit || 500;
    url += "&limit=" + articleLimit;

    // Add category filter if specified (0 means all categories)
    if (categoryId && categoryId.toString().trim() !== "" && categoryId.toString().trim() !== "0") {
        url += "&category_id=" + categoryId;
    }

    return url;
}

/**
 * Fetches a feed icon from the Miniflux API
 *
 * @param {string} baseUrl - The Miniflux instance base URL
 * @param {string} feedId - The feed ID
 * @param {number} iconId - The icon ID
 * @returns {Promise<Object|null>} Object with feedId and dataUri, or null on failure
 */
function fetchFeedIcon(baseUrl, feedId, iconId) {
    var iconUrl = baseUrl + "/v1/icons/" + iconId;
    return sendRequest(iconUrl, "GET", null, getAuthHeaders())
        .then(function(response) {
            var iconData = JSON.parse(response);
            if (iconData && iconData.data) {
                // iconData.data is in format "image/png;base64,iVBOR..."
                return {
                    feedId: feedId,
                    dataUri: "data:" + iconData.data
                };
            }
            return null;
        })
        .catch(function(error) {
            console.log("Failed to fetch icon for feed " + feedId + ": " + error.message);
            return null;
        });
}

/**
 * Converts a Miniflux entry to a Tapestry Item
 *
 * @param {Object} entry - A Miniflux entry object
 * @param {Object} iconMap - Map of feed ID to base64 data URI strings
 * @returns {Item} A Tapestry Item object
 */
function convertEntryToItem(entry, iconMap) {
    // Create unique URI for this article (using the article URL and ID)
    var uri = entry.url + "#" + entry.id;

    // Parse the publication date
    var date = new Date(entry.published_at);

    // Create the Tapestry Item
    var item = Item.createWithUriDate(uri, date);

    // Set basic properties
    item.title = entry.title;
    item.body = entry.content; // HTML content from Miniflux

    // Set author to feed name with favicon
    if (entry.feed && entry.feed.title) {
        var author = Identity.createWithName(entry.feed.title);

        // Use native Miniflux icon if available, fall back to DuckDuckGo
        if (iconMap && entry.feed.id && iconMap[entry.feed.id]) {
            author.avatar = iconMap[entry.feed.id];
        } else if (entry.feed.site_url) {
            var domain = entry.feed.site_url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
            author.avatar = "https://icons.duckduckgo.com/ip3/" + domain + ".ico";
        }

        item.author = author;
    }

    // Add source feed information
    if (entry.feed && entry.feed.title) {
        var source = Identity.createWithName(entry.feed.title);

        // Only add URI if it exists and is not undefined
        if (entry.feed.site_url) {
            source.uri = entry.feed.site_url;
        }

        item.source = source;

        // Add category if available
        if (entry.feed.category && entry.feed.category.title) {
            item.category = entry.feed.category.title;
        }
    }

    // Add actions based on entry state
    // Using actions dictionary for multiple actions
    var actions = {};
    var entryId = entry.id.toString();

    // Read/Unread action based on current status
    if (entry.status === "unread") {
        actions["mark_as_read"] = entryId;
    } else {
        actions["mark_as_unread"] = entryId;
    }

    // Star/Unstar action based on current starred status
    // Note: Miniflux entry has "starred" boolean field
    if (entry.starred) {
        actions["unstar"] = entryId;
    } else {
        actions["star"] = entryId;
    }

    // Debug: log actions being set
    console.log("Entry " + entryId + " - status: " + entry.status + ", starred: " + entry.starred);
    console.log("Actions set: " + JSON.stringify(actions));

    item.actions = actions;

    // Add media attachments from enclosures (images, audio, video)
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

    return item;
}

/**
 * Handles errors from API requests
 *
 * @param {Error} error - The error object
 * @throws {Error} Formatted error message
 */
function handleError(error) {
    console.log("Error occurred: " + error.message);

    // Check for specific HTTP error codes
    if (error.message.includes("401")) {
        throw new Error("Authentication failed. Please check your username and password.");
    } else if (error.message.includes("404")) {
        throw new Error("Miniflux instance not found. Please check your instance URL.");
    } else if (error.message.includes("timeout")) {
        throw new Error("Request timeout. Please check your internet connection.");
    } else {
        throw new Error("Failed to connect to Miniflux: " + error.message);
    }
}

// ============================================================================
// TAPESTRY REQUIRED FUNCTIONS
// ============================================================================

/**
 * verify() - Validates the connector configuration and authentication
 *
 * This function is called by Tapestry when the user sets up the connector
 * or when the credentials need to be validated.
 *
 * @returns {Promise} Resolves if authentication is successful, rejects otherwise
 */
function verify() {
    console.log("Verifying Miniflux connection...");
    console.log("Site: " + (site || "(empty)"));
    console.log("API Token: " + (apiToken ? "(provided)" : "(empty)"));

    // Skip verification if critical fields are missing
    // On iOS, verify() may be called as user types, so we return early without signaling
    if (!site || !apiToken) {
        console.log("Skipping verification - fields not yet complete");
        return Promise.resolve();
    }

    // Build the URL to test authentication (using /v1/me endpoint)
    var baseUrl = site.replace(/\/$/, "");
    var verifyUrl = baseUrl + "/v1/me";

    // Make a request to verify credentials
    return sendRequest(verifyUrl, "GET", null, getAuthHeaders())
    .then(function(response) {
        console.log("Authentication successful!");

        // Parse response to get user info (response is the body string directly)
        var userData = JSON.parse(response);
        var displayName = userData.username ? "Miniflux (" + userData.username + ")" : "Miniflux Feed";

        // Signal successful verification to Tapestry
        processVerification({
            displayName: displayName
        });

        return response;
    })
    .catch(function(error) {
        console.log("Verification failed: " + error.message);

        // Provide user-friendly error messages
        var errorMessage = "Failed to connect to Miniflux";

        if (error.message.includes("401")) {
            errorMessage = "Authentication failed. Please check your API token.";
        } else if (error.message.includes("404")) {
            errorMessage = "Miniflux instance not found. Please check your instance URL.";
        } else if (error.message.includes("timeout")) {
            errorMessage = "Request timeout. Please check your internet connection.";
        } else if (error.message) {
            errorMessage = "Connection error: " + error.message;
        }

        // Signal error to Tapestry
        processError(errorMessage);

        return Promise.reject(error);
    });
}

/**
 * load() - Fetches unread articles from Miniflux
 *
 * This function is called by Tapestry to load new content.
 * It retrieves unread articles and converts them to Tapestry Items.
 * If a category ID is specified in the configuration, only articles
 * from that category are fetched.
 *
 * Uses adaptive time window:
 * - First load: 7 days back (to get recent articles on initial setup)
 * - Subsequent loads: 4 hours back (for multi-device sync)
 *
 * @returns {Promise<Array<Item>>} Array of Tapestry Items
 */
function load() {
    console.log("Loading unread articles from Miniflux...");

    // Get last fetch timestamp to determine time window
    var lastFetchTime = getItem("lastFetchTime");
    var timestamp;
    var timeParam;

    if (!lastFetchTime) {
        // First load: 7 days back, use published_after
        timestamp = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
        timeParam = "published_after";
        console.log("Initial fetch: looking back 7 days (published_after)");
    } else {
        // Subsequent loads: 4 hours back, use changed_after for multi-device sync
        timestamp = Math.floor(Date.now() / 1000) - (4 * 60 * 60);
        timeParam = "changed_after";
        console.log("Subsequent fetch: looking back 4 hours (changed_after)");
    }

    var url = buildEntriesUrl(categoryId, timestamp, timeParam);
    console.log("Fetching from: " + url);

    sendRequest(url, "GET", null, getAuthHeaders())
        .then(function(response) {
            var data = JSON.parse(response);
            console.log("Received " + data.total + " unread articles");

            if (!data.entries || data.entries.length === 0) {
                setItem("lastFetchTime", Math.floor(Date.now() / 1000).toString());
                processResults([]);
                return;
            }

            // Collect unique feed IDs that have icons
            var feedIconIds = {};
            for (var i = 0; i < data.entries.length; i++) {
                var feed = data.entries[i].feed;
                if (feed && feed.icon && feed.icon.icon_id && !feedIconIds[feed.id]) {
                    feedIconIds[feed.id] = feed.icon.icon_id;
                }
            }

            // Fetch all feed icons
            var baseUrl = site.replace(/\/$/, "");
            var iconFeedIds = Object.keys(feedIconIds);
            var iconPromises = [];
            for (var j = 0; j < iconFeedIds.length; j++) {
                var feedId = iconFeedIds[j];
                var iconId = feedIconIds[feedId];
                iconPromises.push(
                    fetchFeedIcon(baseUrl, feedId, iconId)
                );
            }

            return Promise.all(iconPromises).then(function(iconResults) {
                // Build icon map: feedId -> data URI
                var iconMap = {};
                for (var k = 0; k < iconResults.length; k++) {
                    if (iconResults[k]) {
                        iconMap[iconResults[k].feedId] = iconResults[k].dataUri;
                    }
                }
                console.log("Fetched " + Object.keys(iconMap).length + " feed icons");

                // Convert entries to items
                var items = [];
                for (var m = 0; m < data.entries.length; m++) {
                    var item = convertEntryToItem(data.entries[m], iconMap);
                    items.push(item);
                }

                // Save fetch timestamp for next load
                setItem("lastFetchTime", Math.floor(Date.now() / 1000).toString());

                console.log("Converted " + items.length + " items");
                console.log("Calling processResults with " + items.length + " items");
                processResults(items);
            });
        })
        .catch(function(error) {
            console.log("Error in load(): " + error);

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
}

/**
 * performAction() - Handles user actions on items
 *
 * This function is called when the user performs an action on an item,
 * such as marking an article as read, unread, starred, or unstarred.
 *
 * @param {string} actionId - The action identifier
 * @param {string} actionValue - The entry ID
 * @param {Item} item - The Tapestry Item object
 * @returns {Promise} Resolves when the action is completed
 */
function performAction(actionId, actionValue, item) {
    console.log("Performing action: " + actionId + " on entry: " + actionValue);

    var baseUrl = site.replace(/\/$/, "");
    var entryId = parseInt(actionValue);

    // Handle read/unread status changes
    if (actionId === "mark_as_read" || actionId === "mark_as_unread") {
        var updateUrl = baseUrl + "/v1/entries";
        var newStatus = (actionId === "mark_as_read") ? "read" : "unread";

        var requestBody = JSON.stringify({
            entry_ids: [entryId],
            status: newStatus
        });

        return sendRequest(updateUrl, "PUT", requestBody, getAuthHeaders())
        .then(function(response) {
            console.log("Article marked as " + newStatus + " successfully");

            // Update item actions to reflect new state
            var newActions = {};
            if (newStatus === "read") {
                newActions["mark_as_unread"] = actionValue;
            } else {
                newActions["mark_as_read"] = actionValue;
            }
            // Preserve star/unstar action
            if (item.actions && item.actions["star"]) {
                newActions["star"] = actionValue;
            } else if (item.actions && item.actions["unstar"]) {
                newActions["unstar"] = actionValue;
            }
            item.actions = newActions;
            actionComplete(item, null);

            return response;
        })
        .catch(function(error) {
            console.log("Failed to mark article as " + newStatus + ": " + error.message);
            if (error.message && error.message.includes("401")) {
                raiseCondition("authorize",
                    "Authentication Failed",
                    "Your API token is invalid or expired. Please re-enter your credentials."
                );
            }
            // Must always signal completion, otherwise the feed's action
            // queue stays blocked (only one action per feed runs at a time)
            actionComplete(null, error);
        });
    }

    // Handle star/unstar (bookmark toggle)
    if (actionId === "star" || actionId === "unstar") {
        var bookmarkUrl = baseUrl + "/v1/entries/" + entryId + "/bookmark";

        return sendRequest(bookmarkUrl, "PUT", null, getAuthHeaders())
        .then(function(response) {
            console.log("Bookmark toggled successfully");

            // Update item actions to reflect new state
            var newActions = {};
            // Toggle star/unstar
            if (actionId === "star") {
                newActions["unstar"] = actionValue;
            } else {
                newActions["star"] = actionValue;
            }
            // Preserve mark_as_read/mark_as_unread action
            if (item.actions && item.actions["mark_as_read"]) {
                newActions["mark_as_read"] = actionValue;
            } else if (item.actions && item.actions["mark_as_unread"]) {
                newActions["mark_as_unread"] = actionValue;
            }
            item.actions = newActions;
            actionComplete(item, null);

            return response;
        })
        .catch(function(error) {
            console.log("Failed to toggle bookmark: " + error.message);
            if (error.message && error.message.includes("401")) {
                raiseCondition("authorize",
                    "Authentication Failed",
                    "Your API token is invalid or expired. Please re-enter your credentials."
                );
            }
            // Must always signal completion to unblock the feed's action queue
            actionComplete(null, error);
        });
    }

    // Unknown action
    console.log("Unknown action: " + actionId);
    actionComplete(null, new Error("Unknown action: " + actionId));
    return Promise.resolve();
}
