const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minLength: 8,
    select: false, // makes it so the password isn't accessible to client requests
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // this checks if the passwordConfirm matches the password....
      // THIS ONLY WORKS ON SAVE and CREATE!!...so whenever we want to update a user we will have to use .save() (and .create()), rather than find a user and .update()
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

// use Middleware to encrypt passwords
userSchema.pre('save', async function (next) {
  // guard clause saying that if the password hasn't been modified we should just exit this function and call next middleware
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12); // the higher the cost, i.e. the number we pass in, the more cpu intensive the hashing will be, and the better/stronger protected the password will be....12 is a good level for where computers are at at the moment.....hash() is asyncrhonous and returns a promise, so we must await it

  // can now delete passwordConfirm, because the validation has already occured and we no longer need it...fact it is required just means it is a required input, but not that it must be persisted afterwardsd
  this.passwordConfirm = undefined;

  next();
});

// this middleware is to reset the passwordChangedAt property
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000; // here we put the passwordChangeAt time as 1 second earlier because sometime it can happen that the JWT is sometimes created before this middleware finished, which will mean the user can't log in with the JWT (because we use passwordChangedAt to compare them), so putting the time at 1 second earlier ensures this doesn't happen
  next();
});

// query middleware because of the 'find' event (will apply to every query that starts with find...including findAndUpdate etc. by using a regular expression)...this query middleware is to make sure inactive users and their data can't be accessed
userSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

// An Instance Method (i.e. a method that is available on all documents of a certain collection)
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  // this keyword points to current document, but because password is set to select: false, we can't access it with the this keyword, so instead have to pass it in as an argument
  return await bcrypt.compare(candidatePassword, userPassword);
  // candidatePassword isn't hashed, but userPassword is, so we need bcrypts own compare function to compare them
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  // if the password has been changed (i.e. that field exists), then we get the timestamp of that change and change it to a number that matches the JWT's creation timestamp (in seconds?), and then compare that to when the password was changed to see if the current JWT is up to date
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );

    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed...this is the default
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  // creating the token that we will send to the user...it's like a reset password that the user can use to create a new real password...only the user will have access to this token/temporary password
  const resetToken = crypto.randomBytes(32).toString('hex');
  // can just use nodes built in crypto package, because it doesn't need a super cryptographically strong encryption like the actual password, because these reset strings are a less vulnerable attack method

  // below we encrypt resetToken and store that in the schema
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  console.log({ resetToken }, this.passwordResetToken);

  // here we store (into the user schema) the expiry time of the reset token as 10min after it was issued
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // we return the plain text token, which is the one we send through the email (not the encrypted one), otherwise it wouldn't make much sense to encrypt it at all
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
