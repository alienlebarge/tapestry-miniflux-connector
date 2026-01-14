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
 * Uses HTTP Basic Authentication with username:password encoded in Base64
 *
 * @returns {Object} Headers object with Authorization header
 */
function getAuthHeaders() {
    // Encode username:password in Base64 for HTTP Basic Auth
    const credentials = username + ":" + password;
    const encodedCredentials = btoa(credentials);

    return {
        "Authorization": "Basic " + encodedCredentials,
        "Content-Type": "application/json"
    };
}

/**
 * Builds the Miniflux API URL for fetching entries
 *
 * @returns {string} Complete API URL with query parameters
 */
function buildEntriesUrl() {
    // Remove trailing slash from site URL if present
    const baseUrl = site.replace(/\/$/, "");

    // Start with base endpoint
    let url = baseUrl + "/v1/entries?status=unread&order=published_at&direction=desc";

    // Add limit parameter (default to 50 if not specified)
    const articleLimit = limit || 50;
    url += "&limit=" + articleLimit;

    // Add category filter if specified
    if (category_filter && category_filter.trim() !== "") {
        // Split comma-separated category IDs and add each one
        const categoryIds = category_filter.split(",");
        for (let i = 0; i < categoryIds.length; i++) {
            const categoryId = categoryIds[i].trim();
            if (categoryId) {
                url += "&category_id=" + categoryId;
            }
        }
    }

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
    const uri = entry.url + "#" + entry.id;

    // Parse the publication date
    const date = new Date(entry.published_at);

    // Create the Tapestry Item
    const item = Item.createWithUriDate(uri, date);

    // Set basic properties
    item.title = entry.title;
    item.body = entry.content; // HTML content from Miniflux

    // Set author if available
    if (entry.author && entry.author.trim() !== "") {
        item.author = {
            name: entry.author
        };
    }

    // Add source feed information
    if (entry.feed) {
        item.source = {
            name: entry.feed.title,
            uri: entry.feed.site_url
        };

        // Add category if available
        if (entry.feed.category && entry.feed.category.title) {
            item.category = entry.feed.category.title;
        }
    }

    // Add action for marking as read (if entry is unread)
    if (entry.status === "unread") {
        item.action = "mark_as_read";
        item.actionValue = entry.id.toString();
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

    // Validate required fields - but don't call processError for missing fields
    // as verify() may be called before all fields are filled (especially on iOS)
    if (!site || site.trim() === "") {
        console.log("Site URL is not filled yet");
        return Promise.resolve();
    }

    if (!username || username.trim() === "") {
        console.log("Username is not filled yet");
        return Promise.resolve();
    }

    if (!password || password.trim() === "") {
        console.log("Password is not filled yet");
        return Promise.resolve();
    }

    // Build the URL to test authentication (using /v1/me endpoint)
    const baseUrl = site.replace(/\/$/, "");
    const verifyUrl = baseUrl + "/v1/me";

    // Make a request to verify credentials
    return sendRequest(verifyUrl, {
        method: "GET",
        headers: getAuthHeaders()
    })
    .then(function(response) {
        console.log("Authentication successful!");

        // Parse response to get user info
        const userData = JSON.parse(response.body);
        const displayName = userData.username ? "Miniflux (" + userData.username + ")" : "Miniflux Feed";

        // Signal successful verification to Tapestry
        processVerification({
            displayName: displayName
        });

        return response;
    })
    .catch(function(error) {
        console.log("Verification failed: " + error.message);

        // Provide user-friendly error messages
        let errorMessage = "Failed to connect to Miniflux";

        if (error.message.includes("401")) {
            errorMessage = "Authentication failed. Please check your username and password.";
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

    // Build the API URL
    const url = buildEntriesUrl();
    console.log("Fetching from: " + url);

    // Make the request
    return sendRequest(url, {
        method: "GET",
        headers: getAuthHeaders()
    })
    .then(function(response) {
        // Parse the JSON response
        const data = JSON.parse(response.body);

        console.log("Received " + data.total + " unread articles");

        // Convert each entry to a Tapestry Item
        const items = [];
        if (data.entries && data.entries.length > 0) {
            for (let i = 0; i < data.entries.length; i++) {
                const entry = data.entries[i];
                const item = convertEntryToItem(entry);
                items.push(item);
            }
        }

        console.log("Converted " + items.length + " items");
        return items;
    })
    .catch(function(error) {
        handleError(error);
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
 * @returns {Promise} Resolves when the action is completed
 */
function performAction(actionId, actionValue, item) {
    console.log("Performing action: " + actionId + " on entry: " + actionValue);

    // Only handle "mark as read" action
    if (actionId !== "mark_as_read") {
        console.log("Unknown action: " + actionId);
        return Promise.resolve();
    }

    // Build the API URL for updating entries
    const baseUrl = site.replace(/\/$/, "");
    const updateUrl = baseUrl + "/v1/entries";

    // Prepare the request body
    const requestBody = JSON.stringify({
        entry_ids: [parseInt(actionValue)],
        status: "read"
    });

    // Make the request to mark the entry as read
    return sendRequest(updateUrl, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: requestBody
    })
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
