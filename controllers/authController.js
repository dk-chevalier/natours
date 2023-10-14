const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true, // makes so cookie can't be access/modified in anyway by the browser
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true; // cookie only sent on an encrypted connection (i.e. when using https)....this won't work during development because we are only using http, not https

  // use res.cookie() to send a cookie, and the arguments inside cookie() basically define the cookie, first we specify the name of the cookie, then the data we want to send in the cookie, and then some options for the cookie (if a new cookie is made with the same name as another one, then it will override the old one, i.e. delete the old one)
  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // below code is so we only allow the data that we actually need to be put into the new user...this means a user can't manually input a role (e.g. that they are an admin), etc....this also means we can't register as an admin...but what we can do instead is make a new user normally, and then go into mongoDB compass and edit that role from there...could also define a special route for creating admins
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });

  // send welcome email when user signs up
  const url = `${req.protocol}://${req.get('host')}/me`;
  // console.log(url);
  await new Email(newUser, url).sendWelcome();

  // // below we create a token using the jwt.sign(), where we pass in the payload, the secret, and some options (here we are creating a timeframe that the JWT will expire in, i.e. the user will be logged out...we have specified here as 90d, which is read as 90days)...the header is automatically created
  // const token = signToken(newUser._id);

  // // we then automatically log the user in after they signup by sending a token..and the users client should then store that token somewhere
  // res.status(201).json({
  //   status: 'success',
  //   token,
  //   data: {
  //     user: newUser,
  //   },
  // });

  // replaced above codes with below function:
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password'); // use .select(+) to specify a property that we want to include that has been set to select: false in the model (i.e. hidden from requests/not included in outputs)

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }
  // by testing for both and giving one error, it means hackers don't know which is wrong

  // 3) If everything ok, send JWT to client
  createSendToken(user, 200, res);
});

// to log users out we send a cookie with the same name as our JWT (i.e. the cookie we send when we log in), thus overwriting the cookie so it no longer has the token, and thus we can no longer identify the user as being logged in, thus logging the user out....so we are effectively deleting the cookie (because of the short expiration time we are giving it)
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there (common practice is to send a token using a HTTP header with the request)
  let token;
  // with the request we send our own header property, in which we add the token...the property is authorization (which convention is to capitalise, but the app will put in lowercase itself) and then the value is a string with 'Bearer' followed by the JWT...so Authorization: 'Bearer ${JWT}' essentially
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt; // makes so we can get it from the cookie
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401),
    );
  }
  // 2) Verification of token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // verify() is an async function...it requires a callback function as the third argument, which will run as soon as the verification has been completed...so we will promisify the verify function (i.e. make it return a promise) so we can then use async await...to do that node has a built in promisify function in the built in util module, in which we pass in the jwt.verify function, and then we call that promisified function straight away with the token and the secret passed into it (this process of promisifying only works with async functions that require a callback)....above, decoded = an object with the id of the logged in user, and the time that the token was created at and the expiry time of the token

  // 3) Check if user still exists (i.e. hasn't been deleted since the JWT was issued)
  const currentUser = await User.findById(decoded.id);
  // this is why we put the id in the payload, because then we can use it to find the user by that id
  if (!currentUser) {
    return next(
      new AppError('The user belonging to this token no longer exists.', 401),
    );
  }

  // 4) Check if user changed password after the JWT was issued (will use another Instance Method to implement this)
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401),
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser; // this puts entire user data on the request, which could be useful later
  res.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET,
      );

      // 2) Check if user still exists (i.e. hasn't been deleted since the JWT was issued)
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 4) Check if user changed password after the JWT was issued (will use another Instance Method to implement this)
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser; // this gives our pug template access to the user (because templates all have access to the 'locals', which are like variables for pug templates)
      return next();
    } catch (err) {
      return next(); // here we don't want to catch any errors if there are any, we just want to go immediately to the next middleware, thus basically saying there is no logged in user
    }
  }
  next();
};

// here we want to pass arguments into the middleware function, which is something you usually can't do (see when we call the function in tourRoutes)....to do this we create a kind of wrapper function which then returns the middleware function that we actually want to create
exports.restrictTo =
  (...roles) =>
  // below is the middleware function, which is inside the restrictTo function, thus giving middleware function access to the arguments/roles
  (req, res, next) => {
    // roles = an array (e.g. ['admin', 'lead-guide'])...role = 'user'
    // req.user works because our protect() middleware function (above), always runs first, and we define req.user = currentUser in there in order to have access to it
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }

    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address.', 404));
  }
  // 2) Generate the random reset token (will use an Instance Method here, as it is a bit cleaner to separate this into its own line of code because it is a few lines of code)
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false }); // this deactivates all the validators that we specified in our schema...without this we get errors asking us to confirm password etc.

  // 3) Send it to the user's email
  try {
    const resetURL = `${req.protocol}://${req.get(
      'host',
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500,
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  // rest token we sent in the url (and email) is the non-encrypted token, but one in database is encrypted, so we now need to encrypt the original token again so we can compare it with the encrypted one in the database
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }); // the second parameter in the findOne() method here allows us to find the user and at the same time check that the token hasn't expired...means if it has expired it will still return no user, which makes the below line of code smoother

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password; // sets the new password
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save(); // have to do this because otherwise it only modifies the document, but doesn't really update/save it....here we don't have to turn off the validators because we actually want them to validate the passwordConfirm etc. here now...

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

// Update Password for logged in users
exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  // My solution:
  // const user = await User.findOne({ email: req.user.email }).select(
  //   '+password',
  // );
  // His solution:
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is incorrect.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});
