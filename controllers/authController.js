const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Helper: Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// ─────────────────────────────────────────────
// GET /api/auth/check-username/:username
// ─────────────────────────────────────────────
const checkUsername = async (req, res) => {
  try {
    const { username } = req.params;

    if (username.length < 3) {
      return res.json({ available: false, message: "Username too short" });
    }

    const usernameRegex = /^[a-z0-9_]+$/;
    if (!usernameRegex.test(username.toLowerCase())) {
      return res.json({ available: false, message: "Only letters, numbers, underscore allowed" });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.json({ available: false, message: "Username already taken!" });
    }

    return res.json({ available: true, message: "Username available!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({ error: "Username already taken!" });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already registered!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      token: generateToken(user._id),
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Username or Email already exists!" });
    }
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "Please provide username/email and password" });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() },
      ],
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { checkUsername, register, login, getMe };
