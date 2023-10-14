const multer = require('multer');
const sharp = require('sharp');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// with the multerStorage we can basically give a complete definition of how we want to store our file, with a destination and a filename
// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users'); // takes a callback function, which is similar to the next() function in express...first argument cb takes is the error, if there is one, otherwise we just do null, then it takes the actual desination
//   },
//   filename: (req, file, cb) => {
//     // user-198313028130-9138283400939.jpeg (i.e. user-{userID}-{timestamp}.jpeg)
//     const ext = file.mimetype.split('/')[1]; //mimetype in the file object = something like 'image/jpeg', so we can get the .jpeg from there
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });

// the above multerStorage was to immediately store the image in the disk, but because we are going to resize the image after it is uploaded, we want to instead store it in memory as a buffer
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

// in updateMe route we have made it so user can upload a photo (using multer)...we do upload (function we created above) .single (because we only want to update one single image), and then we pass in the name of the field in the form that is going to hold the image to upload (i.e. the name of the field is 'photo')
exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  // we need req.file.filename to get set, because we need it in our other middleware function in updateMe in order to save the filename in our database, so below we define it for that
  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  // use sharp package to resize the image...when doing image processing like this, right after uploading a file, then it's always best to not even save the file to the disk, but to save it to memory
  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// use getMe as a middleware to artificially add the user id to the parameters, thus allowing us to use the getOne factory function (which gets the id from the params, not from the user normally)
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword',
        400,
      ),
    );
  }

  // 2) Filtered out unwanted field names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email'); // we create this function so that we can decide what the user can/can't update (otherwise they could update their role to admin for instance)

  // to add the photo to the user document we do the below to add the photo property:
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) Update user document (we use findByIdAndUpdate because we can't just use .save() method, as that will require us to confirm our password etc. because of the validators)
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

// when a user deletes their account we don't actually delete from database, we just set to inactive, incase they want to reactivate their account in future...will then use Query middleware to prevent data/accounts that are inactive from being accessed
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! Please use /signup instead',
  });
};

exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
// Do NOT update passwords with this!
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
