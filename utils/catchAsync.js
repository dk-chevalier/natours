// below will allow us to catch errors and send them to our global error handling middleware, and so we don't have to catch errors and have basically the same code in all of our async functions....
module.exports = (fn) => {
  // here the catchAsync function is returning another function that can then be called when necessary...otherwise, e.g., our createTour function would have been equal to the result of a function, rather than being a function itself...not it is the returned function, and will only get called when needed due to a request etc.
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
