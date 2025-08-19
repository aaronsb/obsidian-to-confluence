# Obsidian Confluence Integration Plugin

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/markdown-confluence/markdown-confluence/badge)](https://api.securityscorecards.dev/projects/github.com/markdown-confluence/markdown-confluence)

This is a fork of the original [obsidian-confluence](https://github.com/markdown-confluence/obsidian-confluence) plugin, updated to work with modern Obsidian and Node.js versions. The original project appears to have been abandoned in 2023.

## Overview

This plugin allows you to publish markdown content from Obsidian to [Atlassian Confluence](https://www.atlassian.com/software/confluence). It supports Obsidian markdown extensions and currently only works with Atlassian Cloud instances.

## Installation

### Via BRAT (Recommended)
1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian Community Plugins
2. In BRAT settings, click "Add Beta Plugin"
3. Enter: `https://github.com/aaronsb/obsidian-to-confluence`
4. Enable "Confluence Integration" in your Community Plugins

### Manual Installation
1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/aaronsb/obsidian-to-confluence/releases/latest)
2. Create folder `your-vault/.obsidian/plugins/confluence-integration/`
3. Copy the files into this folder
4. Enable "Confluence Integration" in Community Plugins

## Configuration

### Required Settings

Open the plugin settings (Settings → Plugin Options → Confluence Integration) and configure:

1. **Confluence Base URL** 
   - Your Atlassian instance URL
   - Example: `https://your-company.atlassian.net`
   - ⚠️ No trailing slash

2. **Atlassian User Name**
   - Your Atlassian account email address
   - Example: `your.email@company.com`

3. **Atlassian API Token**
   - **NOT your password!**
   - Generate at: https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token" and copy the generated token

4. **Confluence Parent Id**
   - The Confluence page ID where notes will be published as child pages
   - To find: Open your target page in Confluence, the ID is in the URL
   - Example: `https://your-company.atlassian.net/wiki/spaces/SPACE/pages/123456789/Page+Title`
   - The ID is: `123456789`

5. **Folder To Publish**
   - The Obsidian folder containing notes to publish
   - Use `/` to publish entire vault
   - Use folder name like `Documentation` to publish only that folder
   - ⚠️ **Required even when publishing single files**

### Optional Settings

- **First Header Page Name**: Use the first heading as the Confluence page title instead of the filename

## How It Works

### Publishing Workflow

1. The plugin publishes notes from your configured **"Folder To Publish"** to Confluence
2. Each note becomes a child page under your configured **Parent Page ID**
3. The folder structure in Obsidian is preserved in Confluence

### Publishing Methods

#### Method 1: Publish All (Folder)
- Click the **cloud icon** in the ribbon, OR
- Use command: **"Publish All to Confluence"**
- Publishes ALL notes in the configured folder

#### Method 2: Publish Current File
- Use command: **"Publish Current File to Confluence"**
- Publishes only the active note
- ⚠️ Still requires "Folder To Publish" to be configured

### Controlling What Gets Published

#### Include Specific Files Outside the Folder
Add this frontmatter to any note outside your configured folder:
```yaml
---
connie-publish: true
---
```

#### Exclude Specific Files Inside the Folder
Add this frontmatter to notes you want to skip:
```yaml
---
connie-publish: false
---
```

#### Enable/Disable Publishing Per File
Use these commands on any open note:
- **"Enable publishing to Confluence"** - Adds `connie-publish: true`
- **"Disable publishing to Confluence"** - Adds `connie-publish: false`

## Example Setup

1. Create a folder in your vault: `Work/Documentation`
2. In settings, set "Folder To Publish" to `Work/Documentation`
3. Add your Confluence credentials and parent page ID
4. Place notes you want to publish in `Work/Documentation`
5. Click the cloud icon to publish all, or use commands for specific files

## Troubleshooting

### "No paths provided" Error
- Ensure "Folder To Publish" is configured in settings
- This is required even when publishing single files

### "Not logged in" Error
- Verify your Confluence URL (no trailing slash)
- Check your email is correct
- Ensure you're using an API token, not your password
- API tokens expire - you may need to generate a new one

### Debug Mode
Open Developer Console (`Ctrl+Shift+I` or `Cmd+Option+I`) to see:
- Authentication attempts
- Publishing progress
- Detailed error messages

### React Warnings
These are cosmetic issues from the older codebase and don't affect functionality.

## Known Limitations

- Only works with Atlassian Cloud (not Server/Data Center)
- Uses unmaintained `@markdown-confluence` packages from 2023
- Some Obsidian markdown features may not convert perfectly
- Large vaults may take time to publish

## Issues & Support

### For This Fork
- Issues: https://github.com/aaronsb/obsidian-to-confluence/issues
- This is a community fork, not officially maintained

### Original Project (Abandoned)
- Original repo: https://github.com/markdown-confluence/obsidian-confluence
- Last updated: 2023

## Technical Details

### Fork Changes (v5.5.x)
- Fixed build system for modern Node.js
- Updated dependencies where possible
- Fixed React 18 compatibility
- Added error handling and debug logging
- Maintained compatibility with original `@markdown-confluence` packages

### Requirements
- Obsidian 1.0.0+
- Atlassian Cloud instance
- Confluence permissions to create/edit pages

## License

Copyright (c) 2022 Atlassian Pty Ltd  
Copyright (c) 2022 Atlassian US, Inc.

Licensed under [Apache 2.0](LICENSE)

## Disclaimer

The Apache license applies only to this plugin code, not to Atlassian Confluence or any third-party services. You are responsible for obtaining appropriate licenses and complying with Atlassian's terms of service.