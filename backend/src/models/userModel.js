const db = require('../config/db');

/**
 * Finds a user record by email.
 * @param {string} email Email address to look up.
 * @returns {Promise<object|null>} Matching user row or null when no user exists.
 */
const findUserByEmail = async (email) => {
	const [rows] = await db.query(
		'SELECT id, name, email, password, standard FROM users WHERE email = ? LIMIT 1',
		[email]
	);

	return rows[0] || null;
};

/**
 * Creates a new user record.
 * @param {{ name: string, email: string, password: string, standard: number }} user User data to insert.
 * @returns {Promise<number>} Inserted user id.
 */
const createUser = async ({ name, email, password, standard }) => {
	const [result] = await db.query(
		'INSERT INTO users (name, email, password, standard) VALUES (?, ?, ?, ?)',
		[name, email, password, standard]
	);

	return result.insertId;
};

module.exports = {
	findUserByEmail,
	createUser,
};
