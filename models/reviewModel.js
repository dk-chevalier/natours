// review / rating / createdAt / ref to tour / ref to user
const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review cannot be empty!'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// here we create a compound index, and then we pass in options with unique set to true which means that the combination of both the tour and user properties has to be unique (i.e. both of them together must be unique)...this prevents a user from adding more than one review to a single tour
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

// Populate as middleware (to populate the references)...this will add two extra queries to our original find query
reviewSchema.pre(/^find/, function (next) {
  // this.populate({
  //   path: 'tour',
  //   select: 'name',
  // }).populate({
  //   path: 'user',
  //   select: 'name photo',
  // });
  this.populate({
    path: 'user',
    select: 'name photo',
  });
  next();
});

reviewSchema.statics.calcAverageRatings = async function (tourId) {
  // in a static method 'this' points to the model, and the aggregate can only be called on the model...hence why we are using a static method
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  // update ratingsQuantity and ratingsAverage
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

reviewSchema.post('save', function () {
  // 'this' points to current document, and .constructor is basically the model who created that document...so this.constructor points to the current Model....
  this.constructor.calcAverageRatings(this.tour);
  // we have to do it like this, because we can't simply do Review.calcAverageRatings() because Review hasn't been defined yet (c.f. below), and we have to define Review later, otherwise the reviewSchema won't have this pre Middleware/function on it...(???)
});

// findByIdAndUpdate
// findByIdAndDelete
reviewSchema.pre(/^findOneAnd/, async function (next) {
  // we want access to the current document, but 'this' gives us access to the current query...so to go around this we can execute the query, which will then give us the document that is currently being processed and then we can use a .post middleware
  this.r = await this.findOne();
  // by saving to 'this.r' (rather than to a variable called r) we are able to pass the info we need to the next middleware function
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  // await this.findOne(); does NOT work here, query has already executed
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;

// below is example of nested routes (because reviews are clearly a child element of the tours...i.e. will only ever want to access it when on a tour page and a user is logged in, so this info should automatically be given to us, not be manually entered into the request)
// POST /tours/{tourID}/reviews
// GET /tours/{tourID}/reviews
// GET /tours/{tourID}/reviews/{reviewID}
