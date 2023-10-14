const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // can both query for a specific document/Tour and update it in one query with mongoose....with findByIdAndUpdate() we first pass in the id of document we want to update, then the data we want to update it with, and then can pass in some options
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true, // this means that the new updtated object is what will be returned to the client
      runValidators: true, // means that the validators we placed in our schema will run everytime we update the document (i.e. if we defined the data types we want, or if somethine is required etc.)
    });

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body); // so can use Tour model directly and call the create method on it...then in that function we pass the data that we want to store in the database, and that data comes from the POST body (which is stored in request.body...or req.body)...this returns a promise, which we await and then store the result in the newTour variable, which wil be the newly created document already with the id etc.

    res.status(201).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (popOptions) query = query.populate(popOptions);

    // findById() is just a helper function/shorthand for writing .findOne({ _id: req.params.id})
    const doc = await query; // the parameter is called id because that is what we defined it as in the router (with the /:id)...if we had called it /:name, then it would be req.params.name...here we then add .populate() in order to virtually populate the reviews field when we have a parent reference (this works with the virtual populate in the tour model)

    // even if the searched for ID doesn't exist in our database, the request is/may be successful (I think if it is a potential id), but will return null...so we can do an if statement to handle that and send an error if that is the case
    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    // To allow for nested GET reviews on tour (hack)
    let filter = {};
    if (req.params.tourId) filter = { tour: req.params.tourId };

    // EXECUTE QUERY
    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    const doc = await features.query;
    // const doc = await features.query.explain(); // can use .explain() to get info on the execution of the query in our response (e.g. how many documents were examined to get the results we needed, etc.)
    // by here the query string could look like: query.sort().select().skip().limit()

    // SEND RESPONSE
    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: {
        data: doc,
      },
    });
  });
