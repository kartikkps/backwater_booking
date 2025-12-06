const express=require("express");
const bcrypt=require('bcrypt');
const router =express.Router();
const db=require("../config/db");
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


router.get('/login',(req,res)=>{
    res.render('login',{error:null});
})
router.get('/', async (req, res) => {
  const [places] = await db.query('SELECT * FROM places');
  res.render('index', { places });
});
router.get('/register',(req,res)=>{
    res.render('register',{error:null});
})

router.get('/admin/dashboard', async (req, res) => {
  const [[{ userCount }]] = await db.query("SELECT COUNT(*) AS userCount FROM users WHERE role = 'user'");
  const [[{ ownerCount }]] = await db.query("SELECT COUNT(*) AS ownerCount FROM users WHERE role = 'boat_owner'");
 console.log("Session Data:", req.session);
  res.render('admin/dashboard', { userCount, ownerCount });
});



router.post('/admin/users/delete/:id', async (req, res) => {
  const userId = req.params.id;


  await db.query("DELETE FROM users WHERE id = ? AND role != 'admin'", [userId]);

  res.redirect('/admin/users');
});


router.post('/register',async(req,res)=>{
    const {name,email,password}=req.body;
   const hashedpwd=await bcrypt.hash(password,10);
   try{
    await db.query("INSERT INTO users(name,email,password)  VALUES(?,?,?)",[name,email,hashedpwd]);
   }catch(err){
     res.render('register',{error:"email already exist."});
   }
   res.redirect('/login');
});


router.get('/admin/users', async (req, res) => {
  const [users] = await db.query("SELECT id, name, email FROM users WHERE role = 'user'");
  res.render('admin/manage_users', { users });
});



// router.post('/login',async(req,res)=>{
//     const {email,password}=req.body;
//    const sql = "SELECT * FROM users WHERE email = ?";
//   db.query(sql, [email], async (err, results) => {
//     if (err) return res.send("Error");
//     if (results.length === 0) return res.send("User not found");

//     const user = results[0];
//     const match = await bcrypt.compare(password, user.password);
//     if (!match) return res.send("Invalid password");

//     if (user.role === 'admin') {
   
//         return res.redirect('/admin/dashboard');
//     } else if (user.role === 'boat_owner') {
//       return res.redirect('/owner/dashboard');
//     } else {
//         return res.render('admin/dashboard')
//       //return res.redirect('/user/dashboard');
//     }
//   });
// });

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  
  const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

  if (users.length === 0) {
    return res.render('login', { error: 'Invalid credentials' });
  }

  const user = users[0];


  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.render('login', { error: 'Invalid credentials' });
  }

 req.session.user = {
  id: user.id,
  name: user.name,
  role: user.role
};
req.session.userId = user.id;
req.session.userName = user.name;

req.session.save(err => {
  if (err) {
    console.error("Session save error:", err);
    return res.render('login', { error: 'Session error. Please try again.' });
  }

  
  if (user.role === 'admin') {
    return res.redirect('/admin/dashboard');
  } else if (user.role === 'boat_owner') {
    return res.redirect('/owner/dashboard');
  } else {
    return res.redirect('/user/dashboard');
  }
});

});



router.get('/admin/dashboard', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }
  res.render('admin/dashboard', { user: req.session.user });
});

router.get('/logout',(req,res)=>{
    req.session.destroy();
    res.redirect('/login');
});


router.get('/admin/boats', async (req, res) => {
  try {
    const [pendingBoats] = await db.query(`
      SELECT b.*, u.name AS owner_name, u.email 
      FROM boats b 
      JOIN users u ON b.owner_id = u.id 
      WHERE b.status = 'pending'
    `);

    res.render('admin/manage_boats', { pendingBoats });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});


router.post('/admin/boats/approve/:id', async (req, res) => {
  const boatId = req.params.id;

  await db.query('UPDATE boats SET status = "approved" WHERE id = ?', [boatId]);

  const [[boat]] = await db.query('SELECT owner_id FROM boats WHERE id = ?', [boatId]);

  const ownerId = boat.owner_id;

  await db.query('UPDATE users SET role = "boat_owner" WHERE id = ?', [ownerId]);


  res.redirect('/admin/boats');
});



router.post('/admin/boats/reject/:id', async (req, res) => {
  await db.query('UPDATE boats SET status = "rejected" WHERE id = ?', [req.params.id]);
  res.redirect('/admin/boats');
});


router.post('/owner/boats/add', async (req, res) => {
  const { name, type, capacity } = req.body;
  const ownerId = req.session.user.id;

  await db.query(
    'INSERT INTO boats (name, type, capacity, status, owner_id) VALUES (?, ?, ?, ?, ?)',
    [name, type, capacity, 'pending', ownerId]
  );

  res.redirect('/owner/dashboard');
});


router.post('/admin/boats/delete/:id', async (req, res) => {
  const boatId = req.params.id;
  await db.query('DELETE FROM boats WHERE id = ?', [boatId]);
  res.redirect('/admin/boats');
});


router.get('/admin/owners', async (req, res) => {
  const [owners] = await db.query("SELECT id, name, email FROM users WHERE role = 'boat_owner'");
  res.render('admin/manage_owners', { owners });
});



router.post('/admin/owners', async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPwd = await bcrypt.hash(password, 10);

  try {
    await db.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'boat_owner')", [
      name, email, hashedPwd
    ]);
    res.redirect('/admin/owners');
  } catch (err) {
    console.error(err);
    res.send("Error: Email might already exist.");
  }
});


router.post('/admin/owners/delete/:id', async (req, res) => {
  await db.query("DELETE FROM users WHERE id = ? AND role = 'boat_owner'", [req.params.id]);
  res.redirect('/admin/owners');
});


router.get('/admin/owners/edit/:id', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ? AND role = "boat_owner"', [req.params.id]);
  if (rows.length === 0) return res.redirect('/admin/owners');
  res.render('admin/edit_owner', { owner: rows[0] });
});


router.post('/admin/owners/edit/:id', async (req, res) => {
  const { name, email } = req.body;
  await db.query('UPDATE users SET name = ?, email = ? WHERE id = ? AND role = "boat_owner"', [name, email, req.params.id]);
  res.redirect('/admin/owners');
});


router.get('/admin/users/:id/bookings', async (req, res) => {
 const [bookings] = await db.query(`
  SELECT b.id, b.booking_date, b.status,b.total_price, u.name AS user_name,
         GROUP_CONCAT(p.name SEPARATOR ', ') AS places
  FROM bookings b
  JOIN users u ON b.user_id = u.id
  LEFT JOIN booking_places bp ON b.id = bp.booking_id
  LEFT JOIN places p ON bp.place_id = p.id
  WHERE b.user_id = ?
  GROUP BY b.id
`, [req.params.id]);


  bookings.forEach(b => {
    if (b.booking_date) b.booking_date = new Date(b.booking_date);
  });

  res.render('admin/user_bookings', { bookings });
});




router.get('/admin/bookings', async (req, res) => {
  const [bookings] = await db.query(`
    SELECT b.id, u.name AS user_name, b.booking_date,
           GROUP_CONCAT(p.name SEPARATOR ', ') AS places
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN booking_places bp ON b.id = bp.booking_id
    JOIN places p ON p.id = bp.place_id
    GROUP BY b.id
    ORDER BY b.booking_date DESC
  `);
  
  res.render('admin/bookings', { bookings });
});


router.get('/admin/places', async (req, res) => {
  const [places] = await db.query("SELECT * FROM places");
  res.render('admin/place', { places });
});

router.post('/admin/places', upload.single('image'), async (req, res) => {
  const { name, description } = req.body;
  const image = '/uploads/' + req.file.filename;

  await db.query("INSERT INTO places (name, description, image) VALUES (?, ?, ?)", [
    name, description, image
  ]);

  res.redirect('/admin/places');
});

router.post('/admin/places/delete/:id', async (req, res) => {
  await db.query("DELETE FROM places WHERE id = ?", [req.params.id]);
  res.redirect('/admin/places');
});


router.get('/admin/places/edit/:id', async (req, res) => {
  const [[place]] = await db.query("SELECT * FROM places WHERE id = ?", [req.params.id]);
  res.render('admin/edit_place', { place });
});


router.post('/admin/places/edit/:id', upload.single('image'), async (req, res) => {
  const { name, description ,price} = req.body;
  const image = req.file ? '/uploads/' + req.file.filename : req.body.oldImage;

  await db.query("UPDATE places SET name = ?, description = ?, image = ?  WHERE id = ?", [
    name, description, image, req.params.id
  ]);
  res.redirect('/admin/places');
});


router.get('/admin/chat/:userId', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  const adminId = req.session.user.id;
  const userId = req.params.userId;

  const [messages] = await db.query(
    `SELECT m.*, u.name AS sender_name FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE (m.sender_id = ? AND m.receiver_id = ?) OR
           (m.sender_id = ? AND m.receiver_id = ?)
     ORDER BY m.timestamp`,
    [adminId, userId, userId, adminId]
  );

  const [[user]] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

  res.render('admin/chat', { messages, user });
});


router.post('/admin/chat/:userId', async (req, res) => {
 

  const senderId = req.session.userId;
  const receiverId = req.params.userId;
  const { message } = req.body;

  if (!senderId) {
    return res.status(401).send("Unauthorized: Session expired or not logged in");
  }

  await db.query(
    'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
    [senderId, receiverId, message]
  );

  res.redirect(`/admin/chat/${receiverId}`);
});


router.get('/admin/profile', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  const [adminData] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
  res.render('admin/profile', { admin: adminData[0] });
});



router.get('/admin/profile', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }

  const [adminData] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
  res.render('admin/profile', { admin: adminData[0] });
});



router.post('/admin/profile/upload', upload.single('profileImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const imagePath = `/uploads/${req.file.filename}`;

  await db.query("UPDATE users SET profile_image = ? WHERE id = ?", [imagePath, req.session.user.id]);

  req.session.user.profile_image = imagePath;
  res.redirect('/admin/profile');
});


module.exports=router;
