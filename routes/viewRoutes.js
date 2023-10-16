const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

// Route for rendering our templates/pages in the browser..... .get() is usually always what we use for rendering pages in the browser...first we specify the url (which here we are specifying as simply the root url)....we then do a normal response object, but instaed of using .json, we use .render(), which renders the name of the template we want to use....we can then pass in the name of the pug file we want to render (i.e. 'base.pug'), and then we can pass in an object with variables in it, which are the variabls we want to use in order to populate the template

router.use(viewsController.alerts);

router.get('/', authController.isLoggedIn, viewsController.getOverview);

router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', authController.isLoggedIn, viewsController.getLoginForm);
router.get('/me', authController.protect, viewsController.getAccount);

router.get(
  '/my-tours',
  // bookingController.createBookingCheckout,
  authController.protect,
  viewsController.getMyTours,
);

// router.post(
//   '/submit-user-data',
//   authController.protect,
//   viewsController.updateUserData,
// );

module.exports = router;
