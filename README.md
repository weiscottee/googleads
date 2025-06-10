# googleads
A collection of my Google Ads scripts for automation and reporting.

Of course! This is an excellent script to showcase. It's complex, practical, and uses an external AI service, which makes for a very strong portfolio piece.

I have rewritten the README for you in professional English. I've structured it to be clear, concise, and easy for anyone (a recruiter, a future colleague, or just a curious developer) to understand what the script does, why it's valuable, and how to use it.

Just copy and paste the content below into your `README.md` file on GitHub.

---

```markdown
# AI-Powered Google Ads Search Term Management Script

This Google Ads Script automates the process of managing converting search terms by leveraging the OpenAI API for intelligent language detection and semantic matching. The script runs weekly to identify high-performing search queries, intelligently adds them as new keywords to the most relevant ad groups, and logs all actions to a Google Sheet for easy review.

This project was developed to streamline Pay-Per-Click (PPC) account management, reduce manual labor, and improve campaign performance by making data-driven decisions automatically.

## Key Features

-   **Automated Keyword Harvesting**: Scans the search query report for terms that have led to conversions but are not yet keywords.
-   **AI-Powered Language Detection**: Uses the OpenAI API (e.g., GPT-4o) to accurately identify the language of each search term (`fr`, `it`, `es`, `de`, `zh`, or `other`).
-   **Intelligent Ad Group Matching**: Leverages the OpenAI API to perform semantic matching, assigning the new keyword to the most contextually relevant ad group based on its name.
-   **Multi-Lingual Campaign Routing**: Automatically routes keywords to the correct language-specific campaigns.
-   **Dynamic Labeling**: Applies a date-stamped label (e.g., `Converted_20250610`) to all newly added keywords for performance tracking.
-   **Automated Reporting**: Generates a detailed report in a Google Sheet, listing all new keywords added, their campaign/ad group, and highlights the new additions.

## Technology Stack

-   **Google Ads Scripts (JavaScript)**
-   **OpenAI API** (for language detection and semantic matching)
-   **Google Apps Script Services**:
    -   `UrlFetchApp` for making API calls.
    -   `SpreadsheetApp` for automated reporting.

## How to Use

### 1. Prerequisites
-   An active Google Ads account.
-   An OpenAI API key.
-   A Google Sheet for logging.

### 2. Setup

1.  **Copy the Script**: Copy the entire code from the `.js` file in this repository.
2.  **Open Google Ads Scripts Editor**:
    -   In your Google Ads account, navigate to **Tools & Settings** > **BULK ACTIONS** > **Scripts**.
    -   Click the `+` button to create a new script.
    -   Paste the code into the editor.
3.  **Configure the Script**:
    -   At the top of the script, you **must** update the configuration variables with your own details:
    ```javascript
    // The part of the campaign name that the script should look for.
    var CAMPAIGN_NAME_CONDITION = "function"; 
    // The URL of the Google Sheet for logging.
    var LOG_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/your-sheet-id/edit";
    // Your OpenAI API Key.
    var OPENAI_API_KEY = "sk-xxxxxxxxxxxxxxxxxxxxxxxx"; 
    // The default bid for new keywords.
    var DEFAULT_CPC_BID = 1.0;
    ```
4.  **Authorize the Script**:
    -   Save the script.
    -   Click **Run** once. A dialog box will appear asking for authorization. Grant the necessary permissions for the script to access your Google Ads data, external URLs (OpenAI), and Google Sheets.
5.  **Schedule the Script**:
    -   Set the script to run on a schedule. This script is designed to run weekly (e.g., every Friday). In the script editor, set the **Frequency** to `Weekly` and choose a day and time.

### 3. How It Works

-   The script runs automatically at the scheduled time.
-   It fetches search terms from the last 7 days that resulted in at least one conversion.
-   For each term, it calls the OpenAI API to determine its language.
-   Based on the language, it finds the appropriate campaign (e.g., campaigns containing "fr" for French terms).
-   It then calls the OpenAI API again to find the best-matching ad group within that campaign.
-   The search term is added as both a **[Exact Match]** and a **"Phrase Match"** keyword to the selected ad group.
-   All newly created keywords are labeled for tracking.
-   Finally, a new sheet is created in your specified Google Sheet, containing a detailed log of all actions taken.

---

**Disclaimer**: This script is provided as a portfolio example. All sensitive information such as API keys, account IDs, and specific campaign names has been removed or replaced with placeholders for security and confidentiality. Please use with caution and test thoroughly in a non-critical environment before deploying in a live account.
```
