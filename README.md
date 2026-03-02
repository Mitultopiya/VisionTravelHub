# Travel Agency Management System

Full-stack web application for managing a travel agency: authentication (login only), admin user management, travel packages, and bookings.

## Tech Stack

- **Frontend:** Vite, React, Tailwind CSS, React Router, Axios
- **Backend:** Node.js, Express.js, PostgreSQL, JWT, bcrypt

## Prerequisites

- Node.js 18+
- PostgreSQL

## Database Setup

1. Create a PostgreSQL database:

```bash
createdb travel_agency
```

2. (Optional) Run the schema manually, or let the server create tables on first run:

```bash
psql -d travel_agency -f database/schema.sql
```

## Backend Setup

1. Go to the server folder and install dependencies:

```bash
cd server
npm install
```

2. Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

3. Edit `.env` and set:

- `PORT` – server port (default 5000)
- `JWT_SECRET` – a long random string for signing JWTs
- `DATABASE_URL` – e.g. `postgresql://username:password@localhost:5432/travel_agency`

4. Start the server:

```bash
npm start
```

The server will create tables if they don’t exist and seed a default admin user.

**Default admin:**

- Email: `admin@travel.com`
- Password: `admin123`
- Role: admin

## Frontend Setup

1. Go to the client folder and install dependencies:

```bash
cd client
npm install
```

2. (Optional) Create `.env` in `client/` if the API is not on localhost:5000:

```
VITE_API_URL=http://localhost:5000/api
```

3. Start the dev server:

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

1. **Login** – Use the default admin or any user created by an admin. No signup page; admins create users from the Admin Panel.
2. **Admin** – After login as admin you can:
   - View dashboard stats
   - Manage users (create/delete)
   - Manage packages (create/edit/delete)
   - View all bookings and update booking status (pending / confirmed / cancelled)
3. **User** – After login as user you can:
   - View dashboard
   - Browse and book travel packages
   - View “My Bookings” and their status

## API Overview

- `POST /api/auth/login` – Login (email, password)
- `GET /api/users` – List users (admin)
- `POST /api/users` – Create user (admin)
- `DELETE /api/users/:id` – Delete user (admin)
- `GET /api/packages` – List packages
- `POST /api/packages` – Create package (admin)
- `PUT /api/packages/:id` – Update package (admin)
- `DELETE /api/packages/:id` – Delete package (admin)
- `POST /api/bookings` – Create booking (user)
- `GET /api/bookings/user` – Current user’s bookings
- `GET /api/bookings` – All bookings (admin)
- `PUT /api/bookings/:id/status` – Update booking status (admin)

## Project Structure

```
Travel-Agency/
├── client/                 # Vite + React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Admin/
│   │   │   └── User/
│   │   ├── services/
│   │   └── utils/
│   └── ...
├── server/                 # Express backend
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   └── server.js
├── database/
│   └── schema.sql
└── README.md
```

## Security

- Passwords hashed with bcrypt
- JWT for authentication; admin routes protected by role middleware
- Store secrets in `.env`; do not commit `.env` to version control
