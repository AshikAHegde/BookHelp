/**
 * Wraps an async route handler and forwards rejected promises to Express error middleware.
 * @param {Function} handler Async route handler to wrap.
 * @returns {Function} Express middleware function.
 */
const asyncHandler = (handler) => {
	return (req, res, next) => {
		Promise.resolve(handler(req, res, next)).catch(next);
	};
};

module.exports = asyncHandler;
