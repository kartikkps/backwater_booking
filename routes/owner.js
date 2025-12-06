const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });


router.get('/owner/dashboard', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boat_owner') {
    return res.redirect('/login');
  }

  const ownerId = req.session.user.id;
const [boats] = await db.query(`
  SELECT b.*, 
         u.name AS owner_name,
         (
           SELECT MIN(opp.price)
           FROM owner_place_prices opp
           WHERE opp.boat_id = b.id
         ) AS base_price
  FROM boats b
  JOIN users u ON b.owner_id = u.id
  WHERE b.status = 'approved'
    AND EXISTS (
      SELECT 1 FROM owner_place_prices opp2 WHERE opp2.boat_id = b.id
    )
`);






const [bookings] = await db.query(`
  SELECT b.id AS booking_id, b.booking_date, u.name AS user_name, bt.name AS boat_name
  FROM bookings b
  JOIN users u ON u.id = b.user_id
  JOIN boats bt ON b.boat_id = bt.id
  WHERE bt.owner_id = ?
  ORDER BY b.booking_date DESC
`, [req.session.user.id]);




  res.render('owner/dashboard', {
    user: req.session.user,
    boats,
    bookings
  });
});

router.get('/owner/setprice', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boat_owner') {
    return res.redirect('/login');
  }

  const userId = req.session.user.id;

  // Get boats owned by the user
  const [boats] = await db.query('SELECT * FROM boats WHERE owner_id = ?', [userId]);
  if (!boats.length) return res.send("You don't have any boats.");

  // Select boat from query or default to first one
  const selectedBoatId = req.query.boat || boats[0].id;

  // Confirm the selected boat belongs to the user
  const isValidBoat = boats.some(boat => boat.id == selectedBoatId);
  if (!isValidBoat) return res.status(403).send("Invalid boat selection.");

  // Get all places with price set for the selected boat
  const [places] = await db.query(`
    SELECT p.*, opp.price
    FROM places p
    LEFT JOIN owner_place_prices opp 
      ON p.id = opp.place_id AND opp.boat_id = ?
  `, [selectedBoatId]);

  res.render('owner/setprice', {
    user: req.session.user,
    boats,
    selectedBoatId,
    places
  });
});


router.post('/owner/setprice', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boat_owner') {
    return res.redirect('/login');
  }

  const userId = req.session.user.id;
  const { boat_id, prices } = req.body;

  
  const [boatCheck] = await db.query('SELECT * FROM boats WHERE id = ? AND owner_id = ?', [boat_id, userId]);
  if (boatCheck.length === 0) {
    return res.status(403).send('You do not own this boat.');
  }

for (const placeId in prices) {
  const price = parseFloat(prices[placeId]);
  const placeIdInt = parseInt(placeId);

  
  if (isNaN(price)) continue;


  const [placeExists] = await db.query('SELECT id FROM places WHERE id = ?', [placeIdInt]);
  if (placeExists.length === 0) continue;

  const [existing] = await db.query(
    'SELECT * FROM owner_place_prices WHERE boat_id = ? AND place_id = ?',
    [boat_id, placeIdInt]
  );

  if (existing.length > 0) {
    await db.query(
      'UPDATE owner_place_prices SET price = ? WHERE boat_id = ? AND place_id = ?',
      [price, boat_id, placeIdInt]
    );
  } else {
    await db.query(
      'INSERT INTO owner_place_prices (boat_id, place_id, price) VALUES (?, ?, ?)',
      [boat_id, placeIdInt, price]
    );
  }
}



  res.redirect(`/owner/setprice?boat=${boat_id}`);
});



router.get('/owner/boats', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boat_owner') {
    return res.redirect('/login');
  }

  const ownerId = req.session.user.id;

  const [boats] = await db.query(`
    SELECT b.*, 
           (
             SELECT MIN(price) 
             FROM owner_place_prices 
             WHERE owner_id = ?
           ) AS base_price
    FROM boats b
    WHERE b.owner_id = ?
  `, [ownerId, ownerId]);

  res.render('owner/boats', {
    user: req.session.user,
    boats
  });
});

router.get('/owner/add-boat', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boat_owner') {
    return res.redirect('/login');
  }

  res.render('owner/add_boat', { user: req.session.user });
});

router.post('/owner/add-boat', upload.single('photo'), async (req, res) => {
  const { name, type, capacity } = req.body;
  const photo = req.file.filename;
  const ownerId = req.session.user.id;

  await db.query(
    'INSERT INTO boats (name, type, capacity, photo, owner_id, status) VALUES (?, ?, ?, ?, ?, "pending")',
    [name, type, capacity, photo, ownerId]
  );

  res.redirect('/owner/boats');
});



router.get('/owner/booking', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boat_owner') {
    return res.redirect('/login');
  }

  const ownerId = req.session.user.id;

  const [rows] = await db.query(`
    SELECT 
      b.id AS booking_id,
      b.booking_date,
      b.status,
      u.name AS user_name,
      u.phone AS user_phone,
      bt.name AS boat_name,
      p.name AS place_name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN boats bt ON b.boat_id = bt.id
    JOIN booking_places bp ON bp.booking_id = b.id
    JOIN places p ON bp.place_id = p.id
    WHERE bt.owner_id = ?
    ORDER BY b.booking_date DESC
  `, [ownerId]);

  // Group places under the same booking
  const bookings = {};
  rows.forEach(row => {
    if (!bookings[row.booking_id]) {
      bookings[row.booking_id] = {
        booking_id: row.booking_id,
        user_name: row.user_name,
        user_phone: row.user_phone,
        boat_name: row.boat_name,
        booking_date: row.booking_date,
        status: row.status, // ✅ Add this line
        places: []
      };
    }
    bookings[row.booking_id].places.push(row.place_name);
  });

  res.render('owner/booking', {
    user: req.session.user,
    bookings: Object.values(bookings)
  });
});


// router.get('/owner/profile', async (req, res) => {
//   if (!req.session.user || req.session.user.role !== 'boat_owner') {
//     return res.redirect('/login');
//   }

//   const ownerId = req.session.user.id;

//   const [rows] = await db.query(
//     'SELECT id, name, email, profile_image FROM users WHERE id = ?',
//     [ownerId]
//   );

//   if (!rows.length) return res.status(404).send('Owner not found');

//   res.render('owner/profile', {
//     user: req.session.user,
//     owner: rows[0]
//   });
// });

router.get('/owner/profile', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boat_owner') {
    return res.redirect('/login');
  }

  const ownerId = req.session.user.id;
  const [rows] = await db.query('SELECT id, name, email, role, profile_image FROM users WHERE id = ?', [ownerId]);

  if (!rows.length) return res.status(404).send('Owner not found');

  res.render('owner/profile', {
    owner: rows[0],
    user: req.session.user
  });
});

router.post('/owner/profile/upload', upload.single('profileImage'), async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boat_owner') {
    return res.redirect('/login');
  }

  const imagePath = '/uploads/' + req.file.filename;
  await db.query('UPDATE users SET profile_image = ? WHERE id = ?', [imagePath, req.session.user.id]);


  req.session.user.profile_image = imagePath;

  res.redirect('/owner/profile');
});


router.get('/owner/chat', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boat_owner') {
    return res.redirect('/login');
  }

  const ownerId = req.session.user.id;

  // Get admin id
  const [adminRow] = await db.query('SELECT id FROM users WHERE role = "admin" LIMIT 1');
  if (!adminRow.length) return res.send('Admin not found');
  const adminId = adminRow[0].id;

  // Get all messages between owner and admin
  const [messages] = await db.query(`
    SELECT m.*, u.name AS sender_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY m.timestamp ASC
  `, [ownerId, adminId, adminId, ownerId]);

  res.render('owner/chat', {
    user: req.session.user,
    messages,
    adminId
  });
});

router.post('/owner/chat', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'boat_owner') {
    return res.redirect('/login');
  }

  const senderId = req.session.user.id;
  const { receiver_id, message } = req.body;

  if (!message || !receiver_id) return res.redirect('/owner/chat');

  await db.query(
    'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
    [senderId, receiver_id, message]
  );

  res.redirect('/owner/chat');
});


router.post('/owner/bookings/:id/approve', async (req, res) => {
  try {
    await db.query('UPDATE bookings SET status = ? WHERE id = ?', ['Approved', req.params.id]);
    res.redirect('/owner/booking');
  } catch (err) {
    console.error('Error approving booking:', err);
    res.status(500).send('Internal Server Error');
  }
});


router.post('/owner/bookings/:id/cancel', async (req, res) => {
  try {
    await db.query('UPDATE bookings SET status = ? WHERE id = ?', ['Cancelled', req.params.id]);
    res.redirect('/owner/bookings');
  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).send('Internal Server Error');
  }
});






module.exports = router;
