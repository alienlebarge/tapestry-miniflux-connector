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
 * @returns {string} Compvare API URL with query parameters
 */
function buildEntriesUrl() {
    // Remove trailing slash from site URL if present
    var baseUrl = site.replace(/\/$/, "");

    // Start with base endpoint
    var url = baseUrl + "/v1/entries?status=unread&order=published_at&direction=desc";

    // Add time filter to improve performance with large unread counts
    // Only fetch articles from the last 1 day
    var oneDayAgo = Math.floor(Date.now() / 1000) - (1 * 24 * 60 * 60);
    url += "&published_after=" + oneDayAgo;

    // Add limit parameter (default to 10 if not specified)
    var articleLimit = limit || 10;
    url += "&limit=" + articleLimit;

    return url;
}

/**
 * Converts a Miniflux entry to a Tapestry Item
 *
 * @param {Object} entry - A Miniflux entry object
 * @returns {Item} A Tapestry Item object
 */
function convertEntryToItem(entry) {
    // Create unique URI for this article (using the article URL and ID)
    var uri = entry.url + "#" + entry.id;

    // Parse the publication date
    var date = new Date(entry.published_at);

    // Create the Tapestry Item
    var item = Item.createWithUriDate(uri, date);

    // Set only title for performance testing
    item.title = entry.title;

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
 *
 * @returns {Promise<Array<Item>>} Array of Tapestry Items
 */
function load() {
    console.log("Loading unread articles from Miniflux...");

    var url = buildEntriesUrl();
    console.log("Fetching from: " + url);

    return sendRequest(url, "GET", null, getAuthHeaders())
    .then(function(response) {
        var data = JSON.parse(response);
        console.log("Received " + data.total + " unread articles");

        var items = [];
        if (data.entries && data.entries.length > 0) {
            for (var i = 0; i < data.entries.length; i++) {
                var entry = data.entries[i];
                var item = convertEntryToItem(entry);
                items.push(item);
            }
        }

        console.log("Converted " + items.length + " items");
        return items;
    });
}

/**
 * performAction() - Handles user actions on items
 *
 * This function is called when the user performs an action on an item,
 * such as marking an article as read.
 *
 * @param {string} actionId - The action identifier ("mark_as_read")
 * @param {string} actionValue - The entry ID to mark as read
 * @param {Item} item - The Tapestry Item object
 * @returns {Promise} Resolves when the action is compvared
 */
function performAction(actionId, actionValue, item) {
    console.log("Performing action: " + actionId + " on entry: " + actionValue);

    // Only handle "mark as read" action
    if (actionId !== "mark_as_read") {
        console.log("Unknown action: " + actionId);
        return Promise.resolve();
    }

    // Build the API URL for updating entries
    var baseUrl = site.replace(/\/$/, "");
    var updateUrl = baseUrl + "/v1/entries";

    // Prepare the request body
    var requestBody = {
        entry_ids: [parseInt(actionValue)],
        status: "read"
    };

    // Make the request to mark the entry as read
    return sendRequest(updateUrl, "PUT", requestBody, getAuthHeaders())
    .then(function(response) {
        console.log("Article marked as read successfully");
        return response;
    })
    .catch(function(error) {
        console.log("Failed to mark article as read: " + error.message);
        // Don't throw error here to avoid disrupting the user experience
        return Promise.resolve();
    });
}
