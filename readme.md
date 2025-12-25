# Code generator for my Stalker 2 mod config files

## Requirements:

- Node.js [24 or later](https://nodejs.org/en/download/current) (with *.mts typescript loader support).
- The official [STALKER2ZoneKit](https://store.epicgames.com/en-US/p/stalker-2-zone-kit).
- [Optional] https://github.com/trumank/repak if you want to quickly recompile pak files
- [Optional] if you fork it and want to publish with own modifications https://developer.valvesoftware.com/wiki/SteamCMD

## Usage

1. Install the required tools.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Run the generator:
   ```bash
   npm run prepare
   ```

## Compatibility

All mods use bPatch. For a list of modified files see corresponding mod readme.md file.

## License

Free for non-commercial use. For commercial use, please contact GSC - authors of this game - for a license.
Copying or modifying the code should keep the author mentioned in the comments (https://github.com/sdwvit).