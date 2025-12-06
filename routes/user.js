const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './public/uploads/';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'user_' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.post('/user/profile/upload', upload.single('profileImage'), async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId || !req.file) return res.redirect('/login');

  const profileImage = req.file.filename;
  await db.query('UPDATE users SET profile_image = ? WHERE id = ?', [profileImage, userId]);

  res.redirect('/user/profile');
});


router.get('/user/dashboard', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'user') return res.redirect('/login');

  try {
    const [boats] = await db.query(`
      SELECT b.*, u.name AS owner_name
      FROM boats b
      JOIN users u ON u.id = b.owner_id
      WHERE b.status = 'approved'
    `);

    const [places] = await db.query('SELECT * FROM places');
    const [prices] = await db.query(`
      SELECT opp.*, p.name AS place_name
      FROM owner_place_prices opp
      JOIN places p ON p.id = opp.place_id
    `);

    res.render('user/dashboard', {
      user: req.session.user,
      boats,
      places,
      prices
    });
  } catch (err) {
    console.error('Dashboard Load Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/user/book/:boatId', async (req, res) => {
  if (!req.session.user || !req.session.user.id || req.session.user.role !== 'user') return res.redirect('/login');

  const userId = req.session.user.id;
  const boatId = req.params.boatId;
  const selectedPlaces = req.body.selected_places?.split(',').filter(Boolean) || [];
  const totalPrice = parseFloat(req.body.total_price);

  if (selectedPlaces.length === 0) return res.status(400).send('No places selected.');

  try {
    const [owner] = await db.query('SELECT owner_id FROM boats WHERE id = ?', [boatId]);
    if (!owner || owner.length === 0) return res.status(400).send('Invalid boat selected.');

    const ownerId = owner[0].owner_id;
    const bookingDate = new Date();

    const [bookingResult] = await db.query(
      'INSERT INTO bookings (user_id, boat_id, owner_id, booking_date, total_price) VALUES (?, ?, ?, ?, ?)',
      [userId, boatId, ownerId, bookingDate, totalPrice]
    );

    const bookingId = bookingResult.insertId;

    for (const placeId of selectedPlaces) {
      await db.query('INSERT INTO booking_places (booking_id, place_id) VALUES (?, ?)', [bookingId, placeId]);
    }

    res.redirect('/user/dashboard');
  } catch (err) {
    console.error('Booking Error:', err);
    res.status(500).send('Booking failed.');
  }
});

router.get('/user/book/:boatId', async (req, res) => {
  const boatId = req.params.boatId;

  try {
    const [[boat]] = await db.query('SELECT * FROM boats WHERE id = ?', [boatId]);
    const [places] = await db.query('SELECT * FROM places');
    const [prices] = await db.query('SELECT * FROM owner_place_prices WHERE boat_id = ?', [boatId]);

    res.render('user/book', { boat, places, prices });
  } catch (err) {
    console.error('Book page error:', err);
    res.status(500).send('Failed to load booking page.');
  }
});


router.get('/user/become-owner', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'user') return res.redirect('/login');

  const [boats] = await db.query('SELECT * FROM boats WHERE owner_id = ?', [req.session.user.id]);
  const alreadyRequested = boats.length > 0;

  res.render('user/become_owner', {
    user: req.session.user,
    alreadyRequested
  });
});

router.post('/user/become-owner', upload.single('image'), async (req, res) => {
  if (!req.session.user || !req.session.user.id) return res.redirect('/login');

  const { name, type, capacity } = req.body;
  const image = req.file.filename;
  const userId = req.session.user.id;

  await db.query(
    'INSERT INTO boats (name, type, capacity, photo, owner_id, status) VALUES (?, ?, ?, ?, ?, "pending")',
    [name, type, capacity, image, userId]
  );

  res.redirect('/user/dashboard');
});

router.get('/user/profile', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect('/login');

    const [userData] = await db.query('SELECT name, email, role, profile_image, phone FROM users WHERE id = ?', [userId]);
    if (userData.length === 0) return res.status(404).send('User not found');

    res.render('user/profile', { user: userData[0], sessionUser: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/user/mybookings', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const userId = req.session.user.id;

  const [bookings] = await db.query(`
    SELECT b.id, b.booking_date, b.total_price, b.status,
           GROUP_CONCAT(p.name SEPARATOR ', ') AS places
    FROM bookings b
    LEFT JOIN booking_places bp ON b.id = bp.booking_id
    LEFT JOIN places p ON bp.place_id = p.id
    WHERE b.user_id = ?
    GROUP BY b.id
    ORDER BY b.booking_date DESC
  `, [userId]);

  bookings.forEach(b => {
    if (b.booking_date) b.booking_date = new Date(b.booking_date);
  });

  res.render('user/my_bookings', { bookings });
});

router.post('/user/cancel-booking/:id', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const userId = req.session.user.id;
  const bookingId = req.params.id;


  const [rows] = await db.query('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [bookingId, userId]);
  if (rows.length === 0) {
    return res.status(403).send('Unauthorized or invalid booking');
  }

  await db.query('UPDATE bookings SET status = "Cancelled" WHERE id = ?', [bookingId]);

  res.redirect('/user/mybookings');
});


module.exports = router;
