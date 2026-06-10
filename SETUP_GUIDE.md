## Development Setup

Install Node.js, then run:

```bash
npm install
npm run dev
```

The app should be opened from the dev server, not by double-clicking an HTML file.

## GitHub Pages Setup

1. Create a GitHub repository for this project.
2. Push the whole `C:\Users\User\3dchess` folder contents to the repository.
3. In GitHub, open `Settings > Pages`.
4. Set `Build and deployment` to `Deploy from a branch`.
5. Set `Branch` to `main` and folder to `/ (root)`.
6. Click `Save`.
7. Wait for GitHub Pages to publish the site.

Do not choose the suggested `GitHub Pages Jekyll` or `Static HTML` workflow cards. This project can run directly from the repository root on GitHub Pages.

## Online Room Test

Use two different browsers, two devices, or one normal window plus one private window.

1. Player 1 opens the GitHub Pages URL and creates a room.
2. Player 1 copies the generated link.
3. Player 2 opens the copied link.
4. Player 2 should auto-join as Black.
5. Both sides should show connected.

If the room fails, create a new room link. The host browser must stay open because it owns the room ID.
