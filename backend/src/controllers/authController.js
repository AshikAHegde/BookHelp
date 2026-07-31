const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const asyncHandler = require('../middleware/asyncHandler');
const { createUser, findUserByEmail, findUserById, updateUser } = require('../models/userModel');

/**
 * Builds a signed JWT for an authenticated user.
 * @param {{ id: number, email: string, standard: number }} user Authenticated user data.
 * @returns {string} Signed JWT string.
 */
const createToken = (user) => {
	return jwt.sign(
		{
			id: user.id,
			email: user.email,
			standard: user.standard,
		},
		process.env.JWT_SECRET,
		{
			expiresIn: process.env.JWT_EXPIRES_IN || '7d',
		}
	);
};

/**
 * Handles user registration.
 * @param {import('express').Request} req Request body with name, email, password, and standard.
 * @param {import('express').Response} res Response used to return the created user and token.
 * @returns {Promise<void>} Sends a JSON response.
 */
const registerUser = asyncHandler(async (req, res) => {
	const { name, email, password, standard } = req.body;

	if (!name || !email || !password || standard === undefined || standard === null) {
		res.status(400);
		throw new Error('Name, email, password, and standard are required');
	}

	const parsedStandard = Number(standard);

	if (Number.isNaN(parsedStandard)) {
		res.status(400);
		throw new Error('Standard must be a number');
	}

	const existingUser = await findUserByEmail(email);

	if (existingUser) {
		res.status(409);
		throw new Error('Email already exists');
	}

	const hashedPassword = await bcrypt.hash(password, 10);
	const userId = await createUser({
		name,
		email,
		password: hashedPassword,
		standard: parsedStandard,
	});

	const user = {
		id: userId,
		name,
		email,
		standard: parsedStandard,
	};

	res.status(201).json({
		success: true,
		message: 'User registered successfully',
		user,
		token: createToken(user),
	});
});

/**
 * Handles user login.
 * @param {import('express').Request} req Request body with email and password.
 * @param {import('express').Response} res Response used to return the authenticated user and token.
 * @returns {Promise<void>} Sends a JSON response.
 */
const loginUser = asyncHandler(async (req, res) => {
	const { email, password } = req.body;

	if (!email || !password) {
		res.status(400);
		throw new Error('Email and password are required');
	}

	const user = await findUserByEmail(email);

	if (!user) {
		res.status(401);
		throw new Error('Invalid email or password');
	}

	const isPasswordValid = await bcrypt.compare(password, user.password);

	if (!isPasswordValid) {
		res.status(401);
		throw new Error('Invalid email or password');
	}

	const tokenUser = {
		id: user.id,
		name: user.name,
		email: user.email,
		standard: user.standard,
	};

	res.json({
		success: true,
		message: 'Login successful',
		user: tokenUser,
		token: createToken(tokenUser),
	});
});

/**
 * Handles user profile update.
 * @param {import('express').Request} req Request containing name, email, standard, and optional password.
 * @param {import('express').Response} res Response used to return updated user details and a new token.
 * @returns {Promise<void>} Sends a JSON response.
 */
const updateUserProfile = asyncHandler(async (req, res) => {
	const userId = req.user.id;
	const { name, email, password, standard } = req.body;

	if (!name || !email || standard === undefined || standard === null) {
		res.status(400);
		throw new Error('Name, email, and standard are required');
	}

	const parsedStandard = Number(standard);
	if (Number.isNaN(parsedStandard)) {
		res.status(400);
		throw new Error('Standard must be a number');
	}

	const user = await findUserById(userId);
	if (!user) {
		res.status(404);
		throw new Error('User not found');
	}

	// If email is changing, check if new email is already in use
	if (email.toLowerCase() !== user.email.toLowerCase()) {
		const emailExists = await findUserByEmail(email);
		if (emailExists) {
			res.status(409);
			throw new Error('Email is already in use');
		}
	}

	let hashedPassword;
	if (password && password.trim() !== '') {
		hashedPassword = await bcrypt.hash(password, 10);
	}

	await updateUser(userId, {
		name,
		email,
		password: hashedPassword,
		standard: parsedStandard,
	});

	const updatedUser = {
		id: userId,
		name,
		email,
		standard: parsedStandard,
	};

	res.json({
		success: true,
		message: 'Profile updated successfully',
		user: updatedUser,
		token: createToken(updatedUser),
	});
});

module.exports = {
	registerUser,
	loginUser,
	updateUserProfile,
};
