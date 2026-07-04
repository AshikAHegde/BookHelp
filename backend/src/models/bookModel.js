const db = require('../config/db');

/**
 * Returns all distinct subjects from the books table
 * that match the given student's standard.
 * @param {number} standard The student's class/standard.
 * @returns {Promise<Array<{ id: number, subject: string, pdf_url: string, standard: number }>>}
 */
const getSubjectsByStandard = async (standard) => {
	const [rows] = await db.query(
		`SELECT b.id, b.subject, b.pdf_url, b.standard
		 FROM books b
		 JOIN users u ON b.standard = u.standard
		 WHERE u.standard = ?
		 GROUP BY b.id, b.subject, b.pdf_url, b.standard
		 ORDER BY b.subject ASC`,
		[standard]
	);

	return rows;
};

module.exports = {
	getSubjectsByStandard,
};
