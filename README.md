# AutoLink

[![GitHub contributors from allcontributors.org](https://img.shields.io/github/all-contributors/NellowTCS/Obsidian-AutoLink)](#contributors)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/NellowTCS/Obsidian-AutoLink/release.yml) ![GitHub License](https://img.shields.io/github/license/NellowTCS/Obsidian-Autolink) 
 

Automatically creates backlinks between your notes with intelligent word completion and customizable behavior.

## Features

- **Smart word completion**: Creates backlinks when you finish typing note titles
- **Multiple modes**: Choose from autonomous, semi-autonomous, suggestions, or custom modes
- **Easy undo**: Press backspace, delete, or Ctrl+Shift+Z to undo any auto-link
- **Alias support**: Matches note aliases from frontmatter
- **Conflict resolution**: Waits for disambiguation when multiple notes have similar names

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

## Undo Options

- **Backspace/Delete**: Immediate undo when pressed right after a link is created
- **Ctrl+Shift+Z**: Undo the last auto-link from anywhere
- Both methods temporarily disable auto-linking to prevent conflicts

## Installation

(WIP)

## Technical Details

- Built with TypeScript and Svelte
- Debounced input processing for performance
- Intelligent cursor positioning and conflict detection

## Star History

<a href="https://www.star-history.com/#NellowTCS/Obsidian-AutoLink&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=NellowTCS/Obsidian-AutoLink&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=NellowTCS/Obsidian-AutoLink&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=NellowTCS/Obsidian-AutoLink&type=Date" />
 </picture>
</a>

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Moyf"><img src="https://avatars.githubusercontent.com/u/4013062?v=4?s=100" width="100px;" alt="Moy"/><br /><sub><b>Moy</b></sub></a><br /><a href="#bug-Moyf" title="Bug reports">🐛</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
