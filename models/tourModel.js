const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');
// const validator = require('validator');

// creating our first schema, in which we say what elements should be included and what data type their values should be, as well as other possible options/details, like if it is a required field etc.
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal than 40 characters'],
      minlength: [10, 'A tour name must have more or equal than 10 characters'],
      // validate: [validator.isAlpha, 'Tour name must only contain characters'],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // this will round the average to 1 decimal place for us
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      // use 'validate' in which we pass in a callback function (which will have access to the value that was inputted) in order to create our own validator
      validate: {
        validator: function (val) {
          // here, the 'this' keyword only points to the current document when we are creating a NEW document...won't work on updates!
          return val < this.price; // 100 < 200 = true, so no error
        },
        // in the message we can have access to the value that was inputted, but it looks different to using a temperate literal...instead we put {VALUE} in a regular string
        message: 'Discount price ({VALUE}) should be below regular price',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String], // this means it will accept and array of strings
    createdAt: {
      type: Date,
      default: Date.now(), // mongoose immediately converts the milliseconds we get into today's date
      select: false, // means that the client won't be able to receive this from their requests
    },
    startDates: [Date], // array of dates of when the tour starts...mongodb will try to automatically parse the string that we pass in as the date into a real javascript date
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // GeoJSON (for GeoJSON, the object here is actually really an embedded object, not just schema type options (like in the other properties))...for it to be recognised as an object we have to use type and coordinates properties (which is an array of numbers)
      type: {
        type: String,
        default: 'Point', // could also specify polygons, lines, and other geometries
        enum: ['Point'],
      },
      coordinates: [Number], //longitude first and latitude second (normally we see this the opposite way around, e.g. on google maps)
      address: String,
      description: String,
    },
    // above isn't really a new embedded document, it is just an object...to make an actual embedded document we really have to specify an array of objects, like below:
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User', // this is how we establish references between different datasets in mongoose...we don't even need to have the user be imported into this document (i.e. via require at the top)
      },
    ],
  },
  {
    // each time data is outputed as json, we want the virtuals to be part of the output
    toJSON: { virtuals: true },
    toObject: { virtuals: true }, // and when the data gets output as an object
  },
);

// Single Field Index (i.e. index for when we only query based on one field)
// when indexing based on numbers, a 1 means index in ascending order, -1 means descending
// tourSchema.index({ price: 1 });

// Compound Index (an index with 2+ fields, rather than just 1)
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
// indexes the start location based on their location on an earthlike 2dsphere
tourSchema.index({ startLocation: '2dsphere' });

// the virtual property will basically be created each time we get some information from the database...hence why we have to call the get method (so it isn't actually stored in the database)...can't use this 'durationWeeks' in a query, becuase the property isn't part of the database
tourSchema.virtual('durationWeeks').get(function () {
  // we need the 'this' keyword here, hence using a regular function, rather than arrow function
  return this.duration / 7;
});

// Virtual Populate (this still has to then add .populate('reviews') to any of the queries that we want it to be added to...e.g. getTour in tourController)
tourSchema.virtual('reviews', {
  ref: 'Review', // name of the model we want to reference
  foreignField: 'tour', // name of the field in the Review model where the reference to the tour is stored
  localField: '_id', // where that reference is linked to in the current tour model (i.e. in Review we are referencing a tour via its _id)
});

// DOCUMENT MIDDLEWARE: runs before (because of using the .pre()) .save() and .create() (doesn't run before .update()!)
tourSchema.pre('save', function (next) {
  // use slugify to create a slug (i.e. string to be attached to end of url), we are using the name property of the document, and changing everything to lowercase
  this.slug = slugify(this.name, { lower: true });
  // then call the next() function in order to call the next middleware
  next();
});

// Middleware to get the user documents based on the ids in the guides array within the tour document:
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id)); // map function here returns an array of promises, because it is an async function, which is why we then need to run all of these promises at the same time with the below code and store the results in guides
//   this.guides = await Promise.all(guidesPromises);

//   // this middleware means that when a new tour is created with the guides, those guides user documents will be embedded in the response

//   next();
// });

// tourSchema.pre('save', function (next) {
//   console.log('Will save document...');
//   next();
// });

// // post() middleware (i.e. after the event) has access to the finished document and the next function
// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
// });

// QUERY MIDDLEWARE
// problem with just using the 'find' hook is it doesn't work on .findById()/.findOne() etc....so have to use a regular expression to do this...the regular expression here means all the strings that start with find
tourSchema.pre(/^find/, function (next) {
  // 'this' = a query object, which means we have access to query functions, like find()...here we are only showing tours that have the secreTour property set to anything other than true (because some of them were created before this property existed, so can't just say it = false)
  this.find({ secretTour: { $ne: true } });

  this.start = Date.now();
  next();
});

// query middleware that will mean that whenver a query using any methods that start with 'find' (e.g. findOne, findById etc.) is used, then the guides array of references will be populated with the documents that it is referencing
tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});
// .populate() is used to then populate an array that we have used to reference other documents (i.e. to fill that array with the documents that it is referencing) whenever we query...so this one is 'populating' the array in the guides property...can also pass in an object of options and use 'select' property to include/exclude certain properties in from the referenced documents in the response

tourSchema.post(/^find/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds`);
  next();
});

// AGGREGATION MIDDLEWARE
// tourSchema.pre('aggregate', function (next) {
//   // 'this' gives us access to the aggregation object...this.pipline() gives us access to the aggregate that we specified...e.g. in our tourStats function we have $match, $group and $sort stages, so this is what this.pipeline() will show us...from here we can use aggregation middleware to add another $match stage to simply exclude the secretTours
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
//   console.log(this.pipeline());
//   next();
// });

// creating a model from our schema
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
