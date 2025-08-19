# Refactor Log

## Background
This is a community fork of the original [obsidian-confluence](https://github.com/markdown-confluence/obsidian-confluence) plugin which was last updated in 2023. The original maintainer (andymac4182) appears to have stopped maintaining it, possibly due to joining Atlassian.

## Changes Made (v5.5.x)

### Build System Fixes
- Updated `esbuild.config.mjs` to use modern esbuild API
- Fixed TypeScript configuration (removed parent config dependency)
- Updated build scripts in `package.json`
- Added `.gitignore` for build artifacts

### Dependency Updates
- Updated devDependencies to modern versions:
  - `esbuild`: 0.25.9
  - `typescript`: 5.9.2
  - `eslint`: 9.33.0
  - `@typescript-eslint/*`: 8.40.0
  - Added missing `builtin-modules`
- Kept `confluence.js` at 1.7.4 for compatibility with `@markdown-confluence` packages
- React updated to 18.3.1

### TypeScript Compilation Fixes
- Removed broken `AuthenticationService` import, implemented local auth function
- Added null safety checks for `file.parent` and `e.response`
- Fixed type mismatches with confluence.js API
- Fixed authentication type handling for email/apiToken vs username/password

### React 18 Compatibility
- Replaced deprecated `ReactDOM.render` with `createRoot` API
- Fixed `unmountComponentAtNode` deprecation warnings
- Updated both `CompletedModal.tsx` and `ConfluencePerPageForm.tsx`

### Error Handling Improvements
- Added validation for required "Folder to Publish" setting
- Added clear error messages when settings are missing
- Added debug logging for authentication and publishing
- Fixed "no paths provided" error when publishFilter is undefined

### Known Issues
- Still uses unmaintained `@markdown-confluence/lib` and `@markdown-confluence/mermaid-electron-renderer` packages from 2023
- These packages have many peer dependency warnings with React versions
- Full modernization would require rewriting the markdown-to-ADF conversion

## Version History

- **5.5.3**: Initial fork fixes - build system and dependency updates
- **5.5.4**: React 18 compatibility fixes and debug logging
- **5.5.5**: Fixed "no paths provided" error and improved error messages

## Technical Debt
- The `@markdown-confluence` packages are abandoned and have complex Atlassian dependencies
- Updating to latest `confluence.js` (2.1.0) breaks compatibility
- The plugin bundles to 5.5MB due to heavy Atlassian UI components
- React version conflicts between v16 (required by Atlassian components) and v18

## Future Considerations
A full rewrite would be needed to:
- Remove dependency on `@markdown-confluence` packages
- Implement direct markdown-to-ADF conversion
- Update to latest confluence.js
- Reduce bundle size
- Eliminate React dependency warnings