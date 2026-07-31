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

const findUserById = async (id) => {
	const [rows] = await db.query(
		'SELECT id, name, email, password, standard FROM users WHERE id = ? LIMIT 1',
		[id]
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

/**
 * Updates a user's details.
 * @param {number} userId User ID to update.
 * @param {{ name: string, email: string, password?: string, standard: number }} updates User fields to update.
 * @returns {Promise<void>}
 */
const updateUser = async (userId, { name, email, password, standard }) => {
	if (password) {
		await db.query(
			'UPDATE users SET name = ?, email = ?, password = ?, standard = ? WHERE id = ?',
			[name, email, password, standard, userId]
		);
	} else {
		await db.query(
			'UPDATE users SET name = ?, email = ?, standard = ? WHERE id = ?',
			[name, email, standard, userId]
		);
	}
};

module.exports = {
	findUserByEmail,
	findUserById,
	createUser,
	updateUser,
};
