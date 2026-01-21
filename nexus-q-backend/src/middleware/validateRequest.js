// src/middleware/validateRequest.js

module.exports = function validateRequest(requiredFields = []) {
  return function (req, res, next) {
    for (const field of requiredFields) {
      // Be strict about missing or empty values
      if (
        req.body[field] === undefined ||
        req.body[field] === null ||
        req.body[field] === ''
      ) {
        return res.status(400).json({
          error: `Missing required field: ${field}`
        });
      }
    }

    next();
  };
};
