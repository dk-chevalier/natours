const mongoose = require('mongoose');
const dotenv = require('dotenv');
// dotenv.confic() has to be before requiring the app, otherwise the application variable won't have access to the environment variable (i.e. which are in the config.env file)

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! Shutting down...');
  console.log(err.name, err.message);
  process.exit(1); // code 0 = success, 1 = uncaught exception (which is what is usually used here)
});

dotenv.config({ path: './config.env' });

const app = require('./app');

// Changing the database url to include the correct password (all from the config.env file)
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

// connecting to the database...pass in the url connection first, then options...this returns a promise, which we use .then() to handle
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true, // he doesn't use this, but a warning suggested to use it in the terminal, so will try unless it causes issues following lectures
  })
  .then(() => console.log('DB connection successful!'));

const port = process.env.PORT || 3000;
// Starts up a server with app.listen()
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

// Handling Unhandled Promise Rejections...this is a safety net to handle all promise rejections...
process.on('unhandledRejection', (err) => {
  // all we can really do here if this error occurs is to shut down our application
  console.log('UNHANDLE REJECTION! Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1); // code 0 = success, 1 = uncaught exception (which is what is usually used here)
  });
  // by clsoing the server, with server.close() first, and then shutting down the app after that (in the callback function), we give the server time to finish all the requests that are still pending/being handled at the time, and only after that the server is then killed
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
