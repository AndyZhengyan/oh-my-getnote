# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-08

### Added
- **graph**: Add source HTML button to canvas (fix #17)

### Changed
- **multiHop**: Use browsePath as single source of truth
- **docs**: Add Status field to all implementation plans

### Fixed
- **RightPanel**: Handle AI summary API errors gracefully (fix #32)

### Performance
- **ForceGraph**: Pre-compute node levels for O(1) lookup (fix #23, #25)
