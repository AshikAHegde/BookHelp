/**
 * Creates a 404 error for unknown routes.
 * @param {import('express').Request} req Incoming request object.
 * @param {import('express').Response} res Response object used to set the status code.
 * @param {import('express').NextFunction} next Express next function.
 * @returns {void}
 */
const notFound = (req, res, next) => {
	const error = new Error(`Route not found - ${req.originalUrl}`);
	res.status(404);
	next(error);
};

/**
 * Sends a formatted JSON error response.
 * @param {Error} err Error passed from previous middleware.
 * @param {import('express').Request} req Incoming request object.
 * @param {import('express').Response} res Response object used to send the error payload.
 * @param {import('express').NextFunction} next Express next function.
 * @returns {void}
 */
const errorHandler = (err, req, res, next) => {
	const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

	res.status(statusCode).json({
		success: false,
		message: err.message || 'Something went wrong',
		stack: process.env.NODE_ENV === 'production' ? null : err.stack,
	});
};

module.exports = {
	notFound,
	errorHandler,
};
