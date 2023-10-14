class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    // 1A) Filtering
    // deleting unwanted fields from the query object that we get from the request
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'fields', 'limit'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // 1B) Advanced Filtering
    let queryStr = JSON.stringify(queryObj); // this gives us a string of the query object, but for a query that has something like 'duration[gte]=5' in it (which searches for durations greater than/equal to 5), it doesn't give the $ symbol to the gte in the object, which we need....so below does that for us
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`); // This is using a 'regular expression'...google to learn more about them....replace() takes as the first argument what it is that we want to replace in the string (regular expression allows us to look for multiple things at once, and the \b means that they have to be that exact string (i.e. not a word with those letters in it) and /g means we look for all of them, in case there are more than one)...the function says what we want to replace the text with
    // console.log(JSON.parse(queryStr));

    // .find() with nothing passed into it will return all the documents within that collection...this will return a promise that we want to await...req.query gives us an object made out of the queries in the link of our api request...e.g. ...?duration=5&difficulty=easy will give us { duration: '5', difficulty: 'easy'}....this is a bit of a simple way of filtering that can be problematic sometimes
    this.query = this.query.find(JSON.parse(queryStr));
    // let query = Tour.find(JSON.parse(queryStr));
    // .find() method returns a query, which is why we can chain other methods like .where() and .equals() (below)....as soon as we await the result of the query, the query will then execute and come back with the documents that actually match our query...which means there is no way of later implementing sorting, pagination, etc....instead we have to save the Tour.find() part into a query, and then only when we have chained all the methods that we need to onto the query, only then we can await that query (e.g. if we are going to use other methods like .sort(), etc.)

    return this; // otherwise we can't chain other methods after this (see below when these are called)
  }

  sort() {
    // 2) SORTING
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      console.log(sortBy);
      this.query = this.query.sort(sortBy); // because Tour.find() (above) returns a query, that means we can chain more methods to it, like the .sort() method....e.g. query would be ?sort=-price ...this will sort from highest price to lowest (without the '-' it will sort lowest to highest)
      // sort('price ratingsAverage') will sort according to price, and then any that have the same price will be sorted based on ratingsAverage....request url is: ?sort=price,ratingsAverage, and is handled like:
    } else {
      this.query = this.query.sort('-createdAt'); // will show the newest ones first if no sorting is defined
    }

    return this;
  }

  limitFields() {
    // 3) FIELD LIMITING
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields); // .select() expects a string with spaces between the fields we want...e.g. 'name duration price'
    } else {
      this.query = this.query.select('-__v'); // mongoose uses some fields (e.g. '__v'), which we don't want to send to the client, but mongoose needs, so we can exclude them like this ('-' = exclude)
    }

    return this;
  }

  paginate() {
    // 4) PAGINATION
    const page = +this.queryString.page || 1; // the || 1 gives us a default page of 1 if the user doesn't specify
    const limit = +this.queryString.limit || 100;
    const skip = (page - 1) * limit;

    // page=2&limit=10 (this query means we want to skip 10 results, and the limit will be 10 results we want in the query)....
    this.query = this.query.skip(skip).limit(limit); // .skip() takes in the amount of results that should be skipped before actually querying data.....limit() takes in the amount of results that we want in the query...

    return this;
  }
}

module.exports = APIFeatures;
