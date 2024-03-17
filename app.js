import express from "express";
import mongoose from "mongoose";
import User from "./modules/User.js";
import Post from "./modules/posts.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createToken, validateToken } from "./jwt.js";

const app = express();
const port = 3000;

app.use(express.json());

app.post("/",async (req,res)=>{
    res.send('Welcome To MythMaker Backend')
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const lowerCaseEmail = email.toLowerCase();

  try {
    const user = await User.findOne({ email: lowerCaseEmail });
    if (!user) return res.status(400).send("Wrong email or password");

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(400).send("Wrong email or password");

    const accessToken = createToken(user);
    res.status(200).json({ message: "Login Successfully", accessToken });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post("/register", async (req, res) => {
  const { name, email, password, dob, bio, pfp } = req.body;
  const lowerCaseEmail = email.toLowerCase();

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email: lowerCaseEmail });
    if (existingUser) {
      return res.status(400).send("User already exists.");
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user
    const user = new User({
      name,
      email: lowerCaseEmail,
      password: hashedPassword,
      dob,
      bio,
      pfp,
    });

    // Save the new user to the database
    await user.save();

    // Optionally, create a token for the new user
    const accessToken = createToken(user);

    // Respond with success message (consider not sending back sensitive info)
    res.status(201).json({
      message: "User registered successfully",
      accessToken, // Send the token to the user
    });
  } catch (error) {
    res.status(500).send("An error occurred during registration.");
    console.error(error);
  }
});

app.post("/follow", async (req, res) => {
  const currentUserId = req.body.currentUserId; // The ID of the current user making the request
  const targetUserId = req.body.targetUserId; // The ID of the user to follow

  if (!currentUserId || !targetUserId) {
    return res
      .status(400)
      .send("Both current user ID and target user ID are required.");
  }

  try {
    // Prevent a user from following themselves
    if (currentUserId === targetUserId) {
      return res.status(400).send("You cannot follow yourself.");
    }

    // Fetch both the current and target users
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
      return res.status(404).send("One or both users not found.");
    }

    // Check if already following the target user
    if (currentUser.following.includes(targetUserId)) {
      return res.status(400).send("You are already following this user.");
    }

    // Add the target user to the current user's following list
    currentUser.following.push(targetUserId);
    await currentUser.save();

    // Add the current user to the target user's followers list
    if (!targetUser.followers.includes(currentUserId)) {
      targetUser.followers.push(currentUserId);
      await targetUser.save();
    }

    res.status(200).send("Followed successfully.");
  } catch (error) {
    res.status(500).send("An error occurred during the follow process.");
    console.error(error);
  }
});

app.post("/unfollow", async (req, res) => {
  const currentUserId = req.body.currentUserId;
  const targetUserId = req.body.targetUserId;

  if (!currentUserId || !targetUserId) {
    return res
      .status(400)
      .send("Both current user ID and target user ID are required.");
  }

  try {
    if (currentUserId === targetUserId) {
      return res.status(400).send("You cannot unfollow yourself.");
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
      return res.status(404).send("One or both users not found.");
    }

    // Remove the target user from the current user's following list
    currentUser.following.pull(targetUserId);
    await currentUser.save();

    // Remove the current user from the target user's followers list
    targetUser.followers.pull(currentUserId);
    await targetUser.save();

    res.status(200).send("Unfollowed successfully.");
  } catch (error) {
    res.status(500).send("An error occurred during the unfollow process.");
    console.error(error);
  }
});

app.post("/likePost", async (req, res) => {
  const postId = req.body.postId; // ID of the post to be liked
  const userId = req.body.userId; // ID of the user liking the post

  if (!postId || !userId) {
    return res.status(400).send("Post ID and User ID are required.");
  }

  try {
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).send("Post not found.");
    }

    // Check if the user has already liked the post
    if (post.likes.includes(userId)) {
      return res.status(400).send("You already liked this post.");
    }

    // Add the user's ID to the likes array
    post.likes.push(userId);
    await post.save();

    res.status(200).send("Post liked successfully.");
  } catch (error) {
    res.status(500).send("An error occurred while liking the post.");
    console.error(error);
  }
});

app.post("/removeLike", async (req, res) => {
  const { postId, userId } = req.body;

  if (!postId || !userId) {
    return res.status(400).send("Post ID and User ID are required.");
  }

  try {
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).send("Post not found.");
    }

    // Check if the user has liked the post
    if (!post.likes.includes(userId)) {
      return res.status(400).send("You have not liked this post.");
    }

    // Remove the user's ID from the likes array
    post.likes.pull(userId);
    await post.save();

    res.status(200).send("Like removed successfully.");
  } catch (error) {
    res.status(500).send("An error occurred while removing the like.");
    console.error(error);
  }
});

app.get("/hasLikedPost", async (req, res) => {
  const { postId, userId } = req.query; // Assuming postId and userId are passed as query parameters

  if (!postId || !userId) {
    return res.status(400).send("Post ID and User ID are required.");
  }

  try {
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).send("Post not found.");
    }

    // Check if the user's ID is in the likes array of the post
    const hasLiked = post.likes.includes(userId);

    res.status(200).json({ hasLiked });
  } catch (error) {
    res.status(500).send("An error occurred while checking the like status.");
    console.error(error);
  }
});

app.post("/comment", async (req, res) => {
  const postId = req.body.postId; // ID of the post to comment on
  const userId = req.body.userId; // ID of the user making the comment
  const text = req.body.text; // Text of the comment

  if (!postId || !userId || !text) {
    return res
      .status(400)
      .send("Post ID, User ID, and comment text are required.");
  }

  try {
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).send("Post not found.");
    }

    // Create a new comment object
    const comment = {
      text: text,
      postedBy: userId,
      createdAt: new Date(), // Optionally set the creation date of the comment
    };

    // Add the comment to the post's comments array
    post.comments.push(comment);
    await post.save();

    res.status(200).send("Comment added successfully.");
  } catch (error) {
    res.status(500).send("An error occurred while adding the comment.");
    console.error(error);
  }
});

app.post("/removeComment", async (req, res) => {
  const { postId, commentId } = req.body;

  if (!postId || !commentId) {
    return res.status(400).send("Post ID and Comment ID are required.");
  }

  try {
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).send("Post not found.");
    }

    // Find and remove the comment by its ID
    const commentIndex = post.comments.findIndex(
      (comment) => comment._id.toString() === commentId
    );
    if (commentIndex === -1) {
      return res.status(404).send("Comment not found.");
    }

    post.comments.splice(commentIndex, 1);
    await post.save();

    res.status(200).send("Comment removed successfully.");
  } catch (error) {
    res.status(500).send("An error occurred while removing the comment.");
    console.error(error);
  }
});

app.get("/searchUsers", async (req, res) => {
  const searchQuery = req.query.name; // Get the search query from the request's query parameters

  if (!searchQuery) {
    return res.status(400).send("A search query is required.");
  }

  try {
    // Create a case-insensitive regular expression to search for names containing the provided characters
    const regex = new RegExp(searchQuery, "i");

    // Find users whose name contains the search query
    const users = await User.find({ name: regex });

    if (users.length === 0) {
      // No users found
      return res
        .status(404)
        .send("No users found matching the search criteria.");
    }

    // Users found
    res.status(200).json(users);
  } catch (error) {
    res.status(500).send("An error occurred during the search process.");
    console.error(error);
  }
});

app.post("/addPost", async (req, res) => {
  try {
    const post = new Post({
      title: req.body.title,
      story: req.body.story,
      image: req.body.image,
      likes: req.body.likes,
      comments: req.body.comments,
      postedBy: req.body.postedBy,
    });

    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/getPosts", async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(400).send("User ID is missing from the request.");
    }

    const userId = req.user.id;
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).send("User not found.");
    }

    const posts = await Post.find({
      postedBy: { $in: currentUser.following },
    }).populate("postedBy", "name");

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).send("An error occurred while fetching posts.");
    console.error(error);
  }
});

app.get("/myPosts", async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).send("User ID is required.");
  }

  try {
    const posts = await Post.find({ postedBy: userId }).sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).send("An error occurred while retrieving your posts.");
    console.error(error);
  }
});

app.get("/feed", async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).send("User ID is required.");
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    const posts = await Post.find({ postedBy: { $in: user.following } }).sort({
      createdAt: -1,
    });
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).send("An error occurred while retrieving the feed.");
    console.error(error);
  }
});

mongoose
  .connect(
    `mongodb+srv://folk21434:HtxB6Ry9xO1LK6xe@mythmaker.piqbasd.mongodb.net/?retryWrites=true&w=majority&appName=mythmaker`,
    {}
  )
  .then(() => {
    app.listen(port, () => {
      console.log(`Started on port ${port}`);
    });
  })
  .catch((err) => console.error("Could not connect to MongoDB", err));

const db = mongoose.connection;
