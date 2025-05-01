# Feliz Tails 🐾 – Pet Adoption & Donation Platform

**Feliz Tails** is a full-stack MERN (MongoDB, Express, React, Node.js) web application designed for pet lovers to **adopt pets** and contribute to **donation campaigns** for animal welfare.

---

## 🚀 Features

- 🐶 Add and browse pets available for adoption
- 📩 Send and manage adoption requests
- 💰 Create and support donation campaigns
- 🧾 View your donations and campaigns
- 🛡️ Role-based dashboards (admin/user)
- 🔐 JWT authentication & authorization
- 🌐 Hosted with **Vercel** (frontend) and **Vercel** (backend)

---

## 🛠️ Tech Stack

- **Frontend:** React, React Router, Tailwind CSS, DaisyUI, Axios
- **Backend:** Node.js, Express.js, MongoDB, Mongoose
- **Authentication:** JWT, secure cookies
- **Payment Gateway:** Stripe
- **Deployment:** Vercel (client), Vercel (server)

---

## 📂 Project Structure

---

## 🔐 Environment Variables

Create `.env` files in both `client/` and `server/` directories.

### `/server/.env`

```env
PORT=5000
MONGO_URI=your_database_url_here
JWT_SECRET=your_jwt_secret_here
STRIPE_SECRET_KEY=your_stripe_secret_key
CLIENT_URL=https://your-frontend-url.com
COOKIE_SECRET=your_cookie_secret


## Local Setup

git clone https://github.com/your-username/feliz-tails.git
cd feliz-tails

## Install dependencies
cd ../client
npm install
```

## 📌 API Endpoints
### 🛡️ Authentication
POST /jwt – Generate JWT token and set as HTTP-only cookie

POST /logout – Clear the token cookie

### 🐶 Pets
GET /pets – Get all pets (with optional filters: category, search, email)

POST /addPet – Add a new pet (requires JWT)

GET /pet/:id – Get pet details (requires JWT)

PUT /pet/:id – Update a pet (requires JWT)

DELETE /pet/:id – Delete a pet (requires JWT)

### 📥 Adoption Requests
GET /adoptionRequests – Get all adoption requests (filterable by email, requires JWT)

POST /adoptionRequests – Submit an adoption request (requires JWT)

PATCH /adoptionRequests/:id – Update request status (approve/reject) (requires JWT)

### 💰 Donation Campaigns
GET /campaigns – Get all donation campaigns

POST /campaigns – Create a new campaign (requires JWT)

GET /campaigns/:id – Get campaign details

PATCH /campaigns/:id – Update campaign (requires JWT)

DELETE /campaigns/:id – Delete campaign (requires JWT)

### 🎁 Donations
GET /donations – Get all donations (optional filter by user email)

POST /donations – Submit a donation

### 📊 User Stats
GET /myAddedPets – Get pets added by a specific user (filter by email)

GET /myDonationCampaigns – Get campaigns created by a user (filter by email)

GET /myDonations – Get user donation history (filter by email)

## 🔐 Middleware
verifyToken
A middleware to protect routes using JWT. It checks for a valid token in the cookie, verifies and decodes it before allowing access to protected endpoints.

## 📦 Deployment
Frontend: Vercel

Backend: Vercel

Make sure to correctly configure your environment variables in production as well.


## 🌐 Live Demo
🔗 https://feliz-tails.vercel.app


## 🙋‍♂️ Author
### MD SOJIB HOSSAIN
Diploma in Engineering, Computer Technology
Dhaka Polytechnic Institute
📧 Email: sojibhossain.cse@gmail.com