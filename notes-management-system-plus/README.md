# NoteNest — Notes Management System

A student-friendly full-stack web application for creating, viewing, searching, editing, pinning, archiving, and deleting notes. Built with HTML/CSS/JavaScript, Node.js, Express, and MongoDB.

## Features
- CRUD operations: Create, Read, Update, Delete
- MongoDB persistence
- Search notes by title or content
- Filter by category and priority
- Pin important notes
- Archive and restore notes
- Dashboard statistics
- Created/updated timestamps
- Input validation and user-friendly error messages
- Responsive layout for desktop and mobile
- Database connection status indicator

## Requirements
- Node.js (LTS recommended)
- MongoDB local server or MongoDB Atlas account

## Run locally
1. Open this project folder in VS Code.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`.
4. Edit `.env`:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/notes_management
   ```
   If using MongoDB Atlas, replace the URI with your Atlas connection string.
5. Ensure MongoDB is running.
6. Start the server:
   ```bash
   npm start
   ```
7. Visit `http://localhost:3000`.

## API routes
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Server/database status |
| GET | `/api/notes` | List/search/filter notes |
| GET | `/api/stats` | Dashboard counts |
| POST | `/api/notes` | Create a note |
| PUT | `/api/notes/:id` | Update note fields |
| DELETE | `/api/notes/:id` | Delete a note |

## Important security note
Never upload `.env` or real database credentials to GitHub. `.env` is ignored by `.gitignore`. Use your hosting provider's environment-variable settings for deployment.

## Example presentation
“NoteNest is a Notes Management System built with HTML, CSS, JavaScript, Node.js, Express, and MongoDB. Users can create, read, update, and delete notes. It also supports searching, category and priority filters, pinning important notes, archiving notes, and dashboard statistics. MongoDB stores the notes so they remain available after the page is refreshed.”
