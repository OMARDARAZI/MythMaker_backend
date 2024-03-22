import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  dob: {
    type: Date,
    required: true,
  },
  bio: {
    type: String,
    trim: true, 
  },
  pfp: {
    type: String,
    trim: true, 
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
});

const User = mongoose.model("User", userSchema);

export default User;
