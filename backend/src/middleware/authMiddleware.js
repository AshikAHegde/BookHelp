const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer token and attaches the decoded user to req.user.
 * @param {import('express').Request} req Incoming request containing the Authorization header.
 * @param {import('express').Response} res Response object used to set unauthorized status codes.
 * @param {import('express').NextFunction} next Express next function.
 * @returns {void}
 */
const protect = (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		res.status(401);
		throw new Error('Not authorized, token missing');
	}

	const token = authHeader.split(' ')[1];

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		req.user = {
			id: decoded.id,
			email: decoded.email,
			standard: decoded.standard,
		};

		next();
	} catch (error) {
		res.status(401);
		throw new Error('Not authorized, token failed');
	}
};

module.exports = {
	protect,
};
