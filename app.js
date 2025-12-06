const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const authRoutes=require('./routes/auth')
const userRoutes=require('./routes/user')
const ownerRoutes=require('./routes/owner')
const app = express();
app.use(session({
  secret: 'backwater_secret',
  resave: false,
  saveUninitialized: true
}));

app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static('public/uploads'));


app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());




// const userRoutes = require('./routes/auth');
app.use('/', authRoutes);
app.use('/',userRoutes);
app.use('/',ownerRoutes);
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
