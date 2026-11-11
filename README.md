# AutoLink

[![GitHub contributors from allcontributors.org](https://img.shields.io/github/all-contributors/NellowTCS/Obsidian-AutoLink)](#contributors)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/NellowTCS/Obsidian-AutoLink/release.yml) ![GitHub License](https://img.shields.io/github/license/NellowTCS/Obsidian-Autolink)

Automatically creates backlinks between your notes with intelligent word completion and customizable behavior.  
Available on [Obsidian](https://community.obsidian.md/plugins/autolink)!

## Features

- **Smart word completion**: Creates backlinks when you finish typing note titles
- **Multiple modes**: Choose from autonomous, semi-autonomous, suggestions, or custom modes
- **Easy undo**: Press backspace, delete, or Ctrl+Shift+Z to undo any auto-link
- **Alias support**: Matches note aliases from frontmatter
- **Conflict resolution**: Waits for disambiguation when multiple notes have similar names
- **Link limits**: Limit repeated links across a note or per section

## Modes

### Autonomous

Keeps a list of all your notes and automatically inserts backlinks when you complete typing a word that matches a note title.

**Example:**

- Notes: `Note`, `Note1`, `Note with Space`
- Writing in any note: `Note1 has etc`
- Becomes: `[[Note1]] has etc`

**Smart disambiguation:** If multiple notes share prefixes, the plugin waits until you complete the word to determine the correct match.

**Example:**

- Notes: `Note`, `Note with Space`
- Writing: `Note ` (space typed)
- Since both `Note` and `Note with Space` start with "Note", it waits
- After: `Note has etc`
- Becomes: `[[Note]] has etc`

### Semi-Autonomous

Works exactly like Autonomous mode, but only creates backlinks to notes in the current folder.

- Root directory: only links to other root notes
- Subfolder: only links to notes in the same subfolder

### Suggestions

Shows a popup below your cursor with matching notes instead of auto-inserting.

- Press Enter/Return to accept a suggestion
- Press Escape to dismiss
- Navigate with arrow keys

### Custom

Provides full customization over when and how backlinks are created.

**Options:**

- Choose specific folders to scan
- Toggle Enter key acceptance for suggestions
- Enable/disable auto-insertion for single matches
- Fine-tune behavior to match your workflow

## Settings

- **Mode**: Choose your preferred linking behavior
- **Minimum word length**: Set the minimum characters before linking activates (1-10)
- **Case sensitive matching**: Toggle case sensitivity for note matching
- **Include aliases**: Match against frontmatter aliases in addition to note titles
- **Debounce delay**: Adjust typing delay before processing (50-1000ms)
- **Max suggestions**: Limit popup suggestions (1-20)
- **Max links per note**: Limit repeated links to the same note (0-10, 0 for unlimited)
- **Link limit scope**: Apply the limit to the whole note or each heading section

### Link Limits

By default, AutoLink links to the same note once. Set **Max links per note** to **0** for unlimited links.

**Updating from an older version?** This default also applies after updating.

**Scopes:**

- **Whole note**: Count links across the current note (default)
- **Per section**: Count links from the current heading to the next heading of any level (`#` through `######`)
- Text before the first heading counts as its own section
- Headings inside frontmatter or fenced code blocks are ignored

**Behavior:**

- Existing wikilinks count, including manual links and unsaved changes
- Display aliases, heading/block links, and folder paths count too
- Embeds do not count
- Deleting or undoing a link allows another link to that note
- Notes at the limit are hidden from suggestions
- Notes with the same name share a count, even in different folders
- Existing links are left unchanged, and you can still add links manually

## Undo Options

- **Backspace/Delete**: Immediate undo when pressed right after a link is created
- **Ctrl+Shift+Z**: Undo the last auto-link from anywhere
- Both methods temporarily disable auto-linking to prevent conflicts

## Installation

### Direct (Recommended)

You can install **Autolink** directly from Obsidian’s Community Plugins [at the plugin page](https://community.obsidian.md/plugins/autolink).

1. Open **Settings -> Community Plugins**
2. Make sure **Restricted Mode** is off
3. Click **Browse**
4. Search for **“Autolink”**
5. Click **Install**, then **Enable**

### Manual

If you prefer installing manually:

1. Download the latest release from the repo’s **Releases** page
   - You need:
     - `main.js`
     - `manifest.json`
     - `styles.css` (if present)
2. Create a folder in your vault:
   ```text
   .obsidian/plugins/autolink
   ```
3. Place all downloaded files inside that folder
4. Restart Obsidian
5. Go to **Settings -> Community Plugins** and enable **Autolink**

### Install

## Technical Details

- Built with TypeScript
- Debounced input processing for performance
- Intelligent cursor positioning and conflict detection

## Development

Requires **Node.js 22+** and **npm**. Obsidian provides the plugin API.

```sh
npm ci
npm run build
```

**Other commands:**

- `npm run dev`: Rebuild when source files change
- `npm test`: Run tests
- `npm run lint`: Lint the code

**Testing in Obsidian:**

1. Copy `main.js` and `manifest.json` from `dist/` to your vault's `.obsidian/plugins/autolink/` folder
2. Restart Obsidian and enable **Autolink**

## Star History

<!-- markdownlint-disable -->
<a href="https://www.star-history.com/#NellowTCS/Obsidian-AutoLink&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=NellowTCS/Obsidian-AutoLink&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=NellowTCS/Obsidian-AutoLink&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=NellowTCS/Obsidian-AutoLink&type=Date" />
 </picture>
</a>
<!-- markdownlint-restore -->

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Moyf"><img src="https://avatars.githubusercontent.com/u/4013062?v=4?s=100" width="100px;" alt="Moy"/><br /><sub><b>Moy</b></sub></a><br /><a href="#bug-Moyf" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/JoonasBjork"><img src="https://avatars.githubusercontent.com/u/73201140?v=4?s=100" width="100px;" alt="JoonasBjork"/><br /><sub><b>JoonasBjork</b></sub></a><br /><a href="#bug-JoonasBjork" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/GrimbiXcode"><img src="https://avatars.githubusercontent.com/u/8967938?v=4?s=100" width="100px;" alt="GrimbiXcode"/><br /><sub><b>GrimbiXcode</b></sub></a><br /><a href="#code-GrimbiXcode" title="Code">💻</a> <a href="#test-GrimbiXcode" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Ansraer"><img src="https://avatars.githubusercontent.com/u/6329420?v=4?s=100" width="100px;" alt="Ansraer"/><br /><sub><b>Ansraer</b></sub></a><br /><a href="#bug-Ansraer" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/p0shkar"><img src="https://avatars.githubusercontent.com/u/14195934?v=4?s=100" width="100px;" alt="Oskar Norén"/><br /><sub><b>Oskar Norén</b></sub></a><br /><a href="#bug-p0shkar" title="Bug reports">🐛</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
