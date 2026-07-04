const asyncHandler = require('../middleware/asyncHandler');
const { getSubjectsByStandard } = require('../models/bookModel');

/**
 * Returns all subjects available for the authenticated user's standard.
 * GET /books/subjects
 * Requires: Bearer token (protect middleware sets req.user)
 *
 * @param {import('express').Request} req  req.user.standard is set by protect middleware.
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
const getSubjects = asyncHandler(async (req, res) => {
	const { standard } = req.user;

	const subjects = await getSubjectsByStandard(standard);

	res.json({
		success: true,
		standard,
		count: subjects.length,
		subjects,
	});
});

module.exports = {
	getSubjects,
};
