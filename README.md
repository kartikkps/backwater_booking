# 🚤 Boat Booking System

A full-stack **Boat Booking and Tourism Management System** that allows users to browse boats, select destinations, calculate dynamic trip prices, and book trips. Boat owners can manage boats and receive booking details, while admins control destinations and pricing logic.

---

## 📌 Features

### 👤 User Features
- User registration and login (session-based authentication)
- View available boats with:
  - Boat image
  - Owner name
  - Capacity
  - Base trip price
- Select multiple destinations for a trip
- Dynamic price calculation based on selected destinations
- Book boats online
- View booking status

### 🚢 Boat Owner Features
- Add and manage boats
- Set price for each destination
- Base price automatically determined as the minimum destination price
- Receive booking details from users

### 🛠 Admin Features
- Add and manage destinations (places)
- Control place-based pricing logic
- Manage boats, users, and bookings

---

## 🧠 Pricing Logic

- Each boat owner sets prices for individual destinations.
- The **base price** of a boat is the **minimum price** among all destinations.
- The **total trip price** increases as users select more destinations.
- Price is calculated dynamically before booking confirmation.

---

## 🧰 Technologies Used

### Backend
- **Node.js**
- **Express.js**
- **MySQL**
- **Express-session**
- **Multer** (for image uploads)

### Frontend
- **EJS (Embedded JavaScript Templates)**
- **HTML5**
- **CSS3**
- **JavaScript**

### Other Tools
- **Socket.IO** (for real-time features / notifications – optional)
- **MySQL Workbench**
- **Git & GitHub**

---

## 🗂 Project Structure

boat-booking-system/
│
├── public/
│ ├── css/
│ ├── images/
│ └── js/
│
├── views/
│ ├── admin/
│ ├── owner/
│ ├── user/
│ └── partials/
│
├── routes/
│ ├── auth.js
│ ├── admin.js
│ ├── owner.js
│ └── user.js
│
├── controllers/
├── models/
├── uploads/
│
├── config/
│ └── db.js
│
├── app.js
├── package.json
└── README.md


---

## 🛠 Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/your-username/boat-booking-system.git
cd boat-booking-system
```
### 2️⃣ Install Dependencies
```bash
npm install
```
### 3️⃣ Configure Database
1. Create a MySQL database
2. Update database credentials in config/db.js

module.exports = {
  host: "localhost",
  user: "root",
  password: "",
  database: "boat_booking"
};
### 4️⃣ Start the Server
```bash 
npm start
or
nodemon
```
### 5️⃣ Open in Browser
http://localhost:3000

## 🧪 Sample Modules
- Authentication (Login / Register)
- Boat Management
- Destination Selection
- Price Calculation
- Booking Management
  






