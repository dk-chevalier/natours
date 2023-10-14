const express = require('express');
const tourController = require('../controllers/tourController');
const authController = require('../controllers/authController');
const reviewRouter = require('./reviewRoutes');

// below we create a new router and save it into the variable tourRouter, and then we use that instead of the 'app' variable we created earlier, it is a middleware though...hence we pass it in to the app.use()...then the link we pass into the app.use becomes the root when we use tourRouter.route(), hence we don't need the entire url
const router = express.Router();

// can use below .param() to define our own parameter middleware...we don't need it anymore though
// router.param('id', tourController.checkID);

// router
//   .route('/:tourId/reviews')
//   .post(
//     authController.protect,
//     authController.restrictTo('user'),
//     reviewController.createReview,
//   );

// below basically tells tour router to use the reviewRouter instead whenever it sees the below url...but with this we still need to make it so that the reviewRouter has access to the tourId parameter
router.use('/:tourId/reviews', reviewRouter);

router
  .route('/top-5-cheap')
  .get(tourController.aliasTopTours, tourController.getAllTours); // aliasTopTours is a middleware function that manipulates the query object before sending it through the getAllTours function (which is what actually reads/goes through all our queries and sends back the response based on them)

router.route('/tour-stats').get(tourController.getTourStats);
router
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan,
  );

router
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(tourController.getToursWithin);
// /tours-within?distance=233,center=-40,45%unit=mi
// /tours-within/233/center/-40,45/unit/mi

router.route('/distances/:latlng/unit/:unit').get(tourController.getDistances);

router
  .route('/')
  .get(tourController.getAllTours) // .protect checks whether the user is logged in first...so it protects access to the resource (i.e. the getAllTours request/route) from those that aren't logged in
  .post(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.createTour,
  ); // can add multiple middleware handlers by chaining them together....here we check that the body element in the request object has certain elements before we actually create the tour

router
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.uploadTourImages,
    tourController.resizeTourImages,
    tourController.updateTour,
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour,
  );

module.exports = router;
