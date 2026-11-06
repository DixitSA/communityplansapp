# Isolated Expo Go filter checks (2026-11-06)

- GitHub Actions run: [42160407629](https://github.com/DixitSA/communityplansapp/actions/runs/42160407629)
- Result: one Maestro flow passed in 1m50s; all 29 recorded commands completed.
- Environment: Expo Go SDK 58, iOS simulator. Metro reported `backend not configured (demo mode)`.

## Assertions

- Filters opened; Nightlife initially unselected.
- Nightlife was selected through its stable `filter-interest-nightlife` identifier.
- Free and Uptown were selected.
- Clear all became disabled; Nightlife, Free, and Uptown returned to unselected.

## Screenshots

- [Nightlife selected](2026-11-06-ios-filters-nightlife-selected.png)
- [Multiple filters selected](2026-11-06-ios-filters-multiple-selected.png)
- [Filters cleared](2026-11-06-ios-filters-cleared.png)
