# After School API (Express.js + MongoDB)

REST API for the CST3144 after-school lessons app.

Live: https://m00974878-after-school.onrender.com

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill in your MongoDB Atlas connection string.
3. `npm run seed` loads the 10 lessons, `npm run seed:teachers` loads the teachers.
4. `npm start` (or `npm run dev` to read `.env` automatically).

## Routes
| Method | Route | Description |
|---|---|---|
| GET | `/lessons` | all lessons as JSON |
| GET | `/search?q=text` | search topic, location, price and space |
| GET | `/teachers` | all teachers (first name, last name, lesson ids) |
| GET | `/teachers/:id/lessons` | the lessons taught by one teacher |
| POST | `/orders` | save an order `{ name, phone, lessonIDs[], spaces[] }` |
| PUT | `/lessons/:id` | update any attribute of a lesson, e.g. `{ "space": 3 }` |
| GET | `/images/:file` | lesson images (JSON 404 if the file does not exist) |

## Middleware
- **logger**: prints method, URL, status code and time for every request
- **CORS**: allows the GitHub Pages front-end to call the API
- **static**: serves the `images` folder
