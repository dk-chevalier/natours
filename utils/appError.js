class AppError extends Error {
  constructor(message, statusCode) {
    super(message); // call super in order to call the parent constructor, and we do it with 'message' because message is the only paramter that the built in Error accepts

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'; // this saves us from manually having to type in whether it is a fail or an error
    this.isOperational = true; // doing this so we can later test for this property and only send error messages to the client for these operational errors that we created using this class
    // useful because other unexpected errors that may happen in our app won't have this property on them (so won't get sent to the client???)

    Error.captureStackTrace(this, this.constructor); // this means when a new object is created and the constructor function is called, that function call won't appear in the stack trace and won't pollute it
  }
}

module.exports = AppError;
