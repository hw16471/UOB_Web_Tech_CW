"use strict";

/////////////////////////////////
// Constant Initialisation
/////////////////////////////////
const express    = require('express')
const session    = require('express-session');
const uuid       = require('uuid/v4')
const bodyParser = require("body-parser");
const sqlite3    = require('sqlite3').verbose();
const bcrypt     = require('bcrypt');
const app        = express()
const port       = 8080

/////////////////////////////////
// Node Configuration
/////////////////////////////////
app.use(session({ genid: (req) => {return uuid() }, 
  secret: 'shhhh', 
  resave: false,
  saveUninitialized: true,
  expires: new Date(Date.now() + (30 * 60 * 1000)) //Check this! Sessions should expire after 30 minutes
}))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('view engine', 'pug')
app.set('views', './views')


/////////////////////////////////
// Set server to listen on port
/////////////////////////////////
app.listen(port, () => console.log(`Server started, running on ${port}.`))


/////////////////////////////////
// Map GET requests
/////////////////////////////////
app.get('/',         function (req, res) { existing_session('pages/home',     req, res, {});})
app.get('/login',    function (req, res) { res.render('pages/login'); })
app.get('/forum',    function (req, res) { render_forum('pages/forum',    req, res); })
app.get('/tutorial', function (req, res) { existing_session('pages/tutorial', req, res, {}); })
app.get('/new_user', function (req, res) { res.render('pages/new_user'); })


/////////////////////////////////
// Map POST requests
/////////////////////////////////
app.post('/login', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  check_login(username, password, req, res);
})
app.post('/logout', function (req, res) {
  logout(req, res);
})
app.post('/new_user', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var password2 = req.body.password2;
  create_user(username, password, password2, req, res);
})
app.post('/create_post', function (req, res) {
  var post = req.body.post;
  insert_post(post, req, res);
})

/////////////////////////////////
// Open database connection
/////////////////////////////////
let db = new sqlite3.Database('./db/users.db', (err) => {
  if (err) {
    console.log('Error: Opening Database\n');
    return console.error(err.message);
  }
  console.log('Connection opened to database.');
  db.exec(account_schema);
  db.exec(forum_schema);
  insert_user("hw16471", "pass", "NULL");
  // insert_post("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis porta eros lacus, nec ultricies elit blandit non. Suspendisse pellentesque mauris sit amet dolor blandit rutrum. Nunc in tempus turpis.");
});

//Currently vulnerable to sql injection, single quotes!!

/////////////////////////////////
// Database queries
/////////////////////////////////
const account_schema = "CREATE TABLE IF NOT EXISTS Accounts (username TEXT PRIMARY KEY,password TEXT,session TEXT);"
const forum_schema   = "CREATE TABLE IF NOT EXISTS Forum (post_id INTEGER PRIMARY KEY AUTOINCREMENT,message TEXT,username TEXT, FOREIGN KEY (username) REFERENCES Accounts(username));"

function insert_user(username, password, sessionID){
  db.all("select * from Accounts where username='"+username+"';" , (err, rows) => {
    if (err) throw err;
    if(rows.length == 0)
      bcrypt.hash(password, 10, function(err, hash) {
        db.exec("INSERT INTO Accounts (username,password,session) VALUES ('"+username+"','"+hash+"','"+sessionID+"');");
      });
  });
}

function insert_post(message, req, res){
  console.log("inserting post");

  db.all("select * from Accounts where session='"+req.sessionID+"';" , (err, rows) => {
    if (err) throw err;
    if(rows.length > 0)  {
      db.exec("INSERT INTO Forum ('post_id','message', 'username') VALUES (NULL,'"+message+"','"+rows[0]['username']+"');", () => {
        render_forum('pages/forum',     req, res);

      });
    }
  });
}

function check_login(username, password, req, res){
  db.all("select * from Accounts where username='"+username+"';" , (err, rows) => {
  if (err) throw err; 
  for (var i = 0; i < rows.length; i++) {
    if (bcrypt.compareSync(password, rows[i]['password']))  { //Needs to hashed
      console.log("\nUser logged in with the following credentials\nUsername = " + username);
      console.log("Password = " + password);
      db.exec("REPLACE INTO Accounts (username,password,session) VALUES ('"+rows[i]['username']+"','"+rows[i]['password']+"','"+req.sessionID+"');");
      res.render('pages/home', { welcome_name: username, logged_in: true  });
      return;
    }
  }
  res.render('pages/login', { error_msg: "Invalid Login Details" })
  });
}

function create_user(username, password, password2, req, res){ 
  if (password === password2)  {
    console.log("\nUser created an account with the following credentials\nUsername = " + username);
    console.log("Password = " + password);
    console.log("Password2 = " + password2);
    insert_user(username, password, req.sessionID);
    res.render('pages/home', { welcome_name: username, logged_in: true  });
  } else {
    res.render('pages/new_user', { error_msg: "Passwords dont match" })
  }
}

function existing_session(view, req, res, args){
  db.all("select * from Accounts where session='"+req.sessionID+"';" , (err, rows) => {
    if (err) throw err;
    if(rows.length > 0)  {
      res.render(view, Object.assign({}, { welcome_name: rows[0]['username'], logged_in: true}, args));
    } else {
      res.render(view, Object.assign({}, { welcome_name: 'there' }, args));
    }
  });
}

function render_forum(view, req, res)  {
  console.log("rendering forum");

  db.all("select * from Forum;" , (err, rows) => {
    if (err) throw err;
    var message_data_list=[];
    for (var r=0; r < rows.length; r++)  {
      message_data_list.push({username: rows[r]['username'], message: rows[r]['message']});
    }
    console.log(message_data_list);
    existing_session(view, req, res, { posts : message_data_list.reverse()});
  });
}

function logout(req, res)  {
  db.all("select * from Accounts where session='"+req.sessionID+"';" , (err, rows) => {
    if (err) throw err;
    if(rows.length > 0)  {
      db.exec("REPLACE INTO Accounts (username,password,session) VALUES ('"+rows[0]['username']+"','"+rows[0]['password']+"','NULL');");
    }
    res.render('pages/home', { welcome_name: 'there'});

  });
}

//Logout function