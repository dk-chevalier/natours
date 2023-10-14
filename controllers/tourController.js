const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`),
// );

const multerStorage = multer.memoryStorage();

// goal of the multerFilter is basically to test if the uploaded file is an image, if it is we pass true into the callback function, and if not we pass false along with an error (can test for all kinds of files, not just images)
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

// Use multer as a middleware for multi-part form data, thus allowing users to upload user photos...and they will be saved to the below directory
// Here we are configuring a 'multer upload' which we will then use
// images aren't directly uploaded into the database, we just upload them into our file system, and then we put a link to them in our database
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

// use .fields (which is from multer), in order to upload multiple files that need to go to different parts of our document (i.e. to different field...e.g. here we want to save one image to the Tour documents imageCover property, and the others into an array for the images property) (could use .array if we want multiple files to be uploaded to the same property/field/area in our document)
exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

// upload.single('image') .....will produce req.file
// upload.array('images', 5) .....will produce req.file

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  // 1) Cover image
  // we put image file names on req.body so that in the next middleware it will put that data onto the document when it updates it
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;

  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) Images
  req.body.images = [];

  // have to use map() instead of forEach() because otherwise async await wouldn't actually work properly in this instance and we would just move to the next() middleware before actually awaiting everything (????)....its because the async away happens inside the callback function of one of the loop methods...but if we do a map, we can instead save an array of all the promises and then use promise.all to await all of them
  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    }),
  );

  // console.log(req.body);
  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  // Tour.aggregate() returns an aggregate object....only when we await it does it actually come back with a result
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      // $group allows us to group documents together using accumulators
      $group: {
        _id: { $toUpper: '$difficulty' }, // setting this to null means we group all the tours together....by setting this to one of the fields in our documents (e.g. the difficulty), we will then get the below calculations based on everything with the same values in that field (e.g. we will get the results of all the tours with a 'medium' difficulty, an 'easy' difficulty, and a 'hard' difficulty)...can also put it inside an object and use operators on it (e.g. $toUpper will change the values in this field to uppercase... 'EASY' etc.)
        numTours: { $sum: 1 }, // i.e. for each of the documents that will go through this pipeline, 1 will be added
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' }, // this calculates the average of whatever field we define in the '' (must put the $ at the start too)
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 }, // 1 = sorting by ascending order
    },
    // {
    //   $match: { _id: { $ne: 'EASY' } }, // we can repeat steps (e.g. $match), and $ne means 'not equal to'...so we are basically excluding all the tours with 'EASY' difficulty (because id is set to difficulty above)
    // },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = +req.params.year; // 2021

  const plan = await Tour.aggregate([
    {
      // unwind basically deconstructs an array field from the input documents and then outputs one document for each element of the array...i.e. will basically copy all the information in a document and make a new copy of it for each of the elements in the array field that we unwind, and that field will just have one of the elements in it per documents
      $unwind: '$startDates',
    },
    {
      // using match to only select the documents with startDates of the defined year (which has been passed into the request)
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      // grouping the results by the month (mongoDB is able to get the month out of the date that we have)
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' }, // $push creates an array
      },
    },
    {
      $addFields: { month: '$_id' }, // here create a new field with the same value as the _id field
    },
    {
      $project: {
        _id: 0, // setting it to 0 means the id will no longer show up
      },
    },
    {
      $sort: { numTourStarts: -1 }, // -1 = descending
    },
    {
      $limit: 12, // basically lets us limit the amount of results we get to 12 (for example)
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});

//   '/tours-within/:distance/center/:latlng/unit/:unit',
// /tours-within/233/center/34.192911,-116.838443/unit/mi
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  // radius has to be in 'radians' (divide distance by radius of the earth)
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng.',
        400,
      ),
    );
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng.',
        400,
      ),
    );
  }

  // pass in array with all stages of the aggregation pipeline that we want to define
  const distances = await Tour.aggregate([
    // for geospatial aggregation there is only one stage...$geoNear
    {
      // $geoNear always needs to be the first stage in the aggregation pipeline....it also requires that at least one of our fields contains a geospatial index
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [+lng, +lat],
        }, // near = point from which to calculate the distances
        distanceField: 'distance', // name of the field that will be created, and where calculated distances will be stored
        distanceMultiplier: multiplier, // here we specify a number that all the distances will be multiplied by (we are essentially dividing by 1000 here in order to convert from meters into kms, otherwise the other number will convert it to miles)
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
