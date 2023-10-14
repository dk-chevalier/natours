const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');

// in the router we can pass in some options, and by setting mergeParams to true, this means that the reviewRouter will have access to the parameters in the tourRouter (where the reviewRouter is nested onto it)...thus giving us access to the tourId
const router = express.Router({ mergeParams: true });

// e.g. of how nested route url looks
// POST /tour/29p8345/reviews
// GET /tour/29p8345/reviews
// POST /reviews

router.use(authController.protect);

router
  .route('/')
  .get(reviewController.getAllReviews)
  .post(
    authController.restrictTo('user'),
    reviewController.setTourUserIds,
    reviewController.createReview,
  );

router
  .route('/:id')
  .get(reviewController.getReview)
  .patch(
    authController.restrictTo('user', 'admin'),
    reviewController.updateReview,
  )
  .delete(
    authController.restrictTo('user', 'admin'),
    reviewController.deleteReview,
  );

module.exports = router;
