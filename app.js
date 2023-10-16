const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitise = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

// Start express app
const app = express();

app.enable('trust proxy');

// Specifying our Template Enging (as Pug) for server-side rendering
app.set('view engine', 'pug');
// setting the path to the 'views' folder, where our templates will be stored
app.set('views', path.join(__dirname, 'views'));

// 1) GLOBAL MIDDLEWARES
// Implement CORS (Cross Origin Resource Sharing)
app.use(cors());
// Access-Control-Allow-Origin header to allow * (i.e. allow all/everything, thus allowing all requests, no matter where they are coming from, thus letting everyone consume our api)
// if we don't want to share the api, but have the api on one domain/subdomain and the frontend application on a different domain (e.g. back-end at api.natours.com, front-end at natours.com)
// then we would do:
// app.use(
//   cors({
//     origin: 'https://www.natours.com',
//   }),
// );

// the above uses are just the first step to enabling cors, because they only apply to simple requests (i.e. get and post requests).....but non-simple requests (put, patch, delete, and requests that send cookies/use non-standard headers) require a 'pre-flight' phase (which the browser will automatically issue when there is one of these requests).....so before the real request actually happens, the browser first does an options request, in order to figure out if the actual request is safe to send....this means that on our server we need to respond to that options request (options requests are really just another http method, like get, post, delete, etc.)
// so when we get one of these options requests on our server, we then have to send back the same access-control-allow-origin header, so then the browser will then know that the actual request is safe to perform and then executes the request
app.options('*', cors());
// app.options('/api/v1/tours/:id', cors()); ....this is to enable it only one one specific route

// Serving static files
// serves static files to the browser (i.e. if you type in the local host with the right port, and then you can write the path to the file that you want to open, from the root folder which is the first argument passed in...e.g., below is in the public folder....so can type in 127.0.0.1:3000/overview.html to open the overview.html file on the browser)
app.use(express.static(path.join(__dirname, 'public')));
// above allows us to tell pug what folder it is that it should receive its static files from (i.e. from the public folder), which is how it then knows where to get its css files etc....e.g. pug uses css/style.css, which means it will look for the style.css file in the css folder which is inside the public folder

// Set security HTTP headers
app.use(helmet()); // helmet() returns a function that will be sitting there until it is called....it's best to use helmet package early in the middleware stack so that these headers are sure to be set

// app.use(helmet.crossOriginEmbedderPolicy({ policy: 'credentialless' }));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

//Add the following
// Further HELMET configuration for Security Policy (CSP)
const scriptSrcUrls = [
  'https://api.tiles.mapbox.com/',
  'https://api.mapbox.com/',
  'https://cdnjs.cloudflare.com/',
  'https://js.stripe.com/',
];
const styleSrcUrls = [
  'https://api.mapbox.com/',
  'https://api.tiles.mapbox.com/',
  'https://fonts.googleapis.com/',
];
const connectSrcUrls = [
  'https://api.mapbox.com/',
  'https://a.tiles.mapbox.com/',
  'https://b.tiles.mapbox.com/',
  'https://events.mapbox.com/',
  'https://bundle.js:*',
  'https://*.stripe.com',
];
const fontSrcUrls = ['fonts.googleapis.com', 'fonts.gstatic.com'];

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        'unsafe-inline',
        'data:',
        'blob:',
        ...connectSrcUrls,
      ],
      scriptSrc: ["'self'", ...scriptSrcUrls],
      styleSrc: ["'self'", "'unsafe-inline'", 'data', 'blob', ...styleSrcUrls],
      workerSrc: [
        "'self'",
        'blob:',
        "'unsafe-inline'",
        'data:',
        'https://*.stripe.com',
      ],
      objectSrc: [],
      frameSrc: [
        'self',
        'unsafe-inline',
        'data:',
        'blob:',
        'https://*.stripe.com',
      ],
      imgSrc: ["'self'", 'blob:', 'data:'],
      fontSrc: ["'self'", 'data:', ...fontSrcUrls],
    },
  }),
);

// Development logging
if (process.env.NODE_ENV === 'development') {
  // morgan is a third-party middleware that logs information about the request for us
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100, // max number of requests
  window: 60 * 60 * 1000, // timeframe for max number of requests in milliseconds (this example works out to an hour)
  message: 'Too many requests from this IP, please try again in an hour!', // error message if they go over limiter
});
app.use('/api', limiter); // we have here set this to affect all routes that start with /api (i.e. that access our api)

// Body parser, i.e. reading data from body into req.body
// app.use allows us to use Middleware (i.e. a function that can modify the incoming request data....it stands between the request and the response...hence 'middle')...express.json() returns a function which is then added to the middleware stack
app.use(express.json({ limit: '10kb' })); // now when we have a body larger than 10kb it won't be accepted

// urlencoded allows us to parse data from a url encoded form (extended property means we can parse more complex data from it too)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// parse data from cookies
app.use(cookieParser());

// Data Sanitisation (to be done after body parser)
// Data Sanitisation against NoSQL query injection
app.use(mongoSanitise()); // this middleware looks at request body, query string, and req.params, and will filter out all $ and dots (: or . ????) (because that's how all mongoDB operators are written)

// Data Sanitisation against XSS
app.use(xss()); // this will clean any user input from malicious html code

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  }),
); // this clears up the query string, preventing duplicate fields apart from the ones in the whitelist that we specify to allow duplicates of

// in each middleware function we have access to the request, response, and next function (which is the third argument we get access to)...we have to call the next() function, otherwise we wouldn't be able to move on and we woudl never send back a response to the client...this middleware applies to every request, because we don't specify a route

// Returns a middleware function that compresses all the text that is sent to clients
app.use(compression());

// Test Middleware
// below middleware adds an element to the object that has the time that the request was made, which can be useful if we have a function etc. that needs that data
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// 3) ROUTES

// API Routes
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// ERROR HANDLING for undefined routes...will only run this code if the above middlewares aren't executed, because if the above routes are executed, then the code will be sent somewhere else basically
// app.all() means it will apply to all the verbs...e.g. .get(), .post() etc....and the * means it will apply to all the routes that are input
app.all('*', (req, res, next) => {
  // if the next function receives an argument, it will automatically know that there was an error, and assume whatever we pass into next is an error...so it will then skip all the other middlewares in our stack and send the error that we passed in, to our global error handling middleware
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
