import express from "express";
import mongoose from "mongoose";
import User from "./modules/User.js";
import Post from "./modules/posts.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createToken, validateToken } from "./jwt.js";

const app = express();
const port = 3000;

app.use(express.json());

app.post("/", async (req, res) => {
  res.send("Welcome To MythMaker Backend");
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
    const existingUser = await User.findOne({ email: lowerCaseEmail });
    if (existingUser) {
      return res.status(400).send("User already exists.");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email: lowerCaseEmail,
      password: hashedPassword,
      dob,
      bio,
      pfp,
    });

    await user.save();

    const accessToken = createToken(user);

    res.status(201).json({
      message: "User registered successfully",
      accessToken, // Send the token to the user
    });
  } catch (error) {
    res.status(500).send("An error occurred during registration.");
    console.error(error);
  }
});

app.get("/getUserInfo", validateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const { password, ...userInfo } = user.toObject();
    res.json(userInfo);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

app.post("/follow", async (req, res) => {
  const currentUserId = req.body.currentUserId;
  const targetUserId = req.body.targetUserId;

  if (!currentUserId || !targetUserId) {
    return res
      .status(400)
      .send("Both current user ID and target user ID are required.");
  }

  try {
    if (currentUserId === targetUserId) {
      return res.status(400).send("You cannot follow yourself.");
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
      return res.status(404).send("One or both users not found.");
    }

    if (currentUser.following.includes(targetUserId)) {
      return res.status(400).send("You are already following this user.");
    }

    currentUser.following.push(targetUserId);
    await currentUser.save();

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

    currentUser.following.pull(targetUserId);
    await currentUser.save();

    targetUser.followers.pull(currentUserId);
    await targetUser.save();

    res.status(200).send("Unfollowed successfully.");
  } catch (error) {
    res.status(500).send("An error occurred during the unfollow process.");
    console.error(error);
  }
});

app.post("/likePost", async (req, res) => {
  const postId = req.body.postId;
  const userId = req.body.userId;

  if (!postId || !userId) {
    return res.status(400).send("Post ID and User ID are required.");
  }

  try {
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).send("Post not found.");
    }

    if (post.likes.includes(userId)) {
      return res.status(400).send("You already liked this post.");
    }

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

    if (!post.likes.includes(userId)) {
      return res.status(400).send("You have not liked this post.");
    }

    post.likes.pull(userId);
    await post.save();

    res.status(200).send("Like removed successfully.");
  } catch (error) {
    res.status(500).send("An error occurred while removing the like.");
    console.error(error);
  }
});

app.get("/hasLikedPost", async (req, res) => {
  const { postId, userId } = req.query;

  if (!postId || !userId) {
    return res.status(400).send("Post ID and User ID are required.");
  }

  try {
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).send("Post not found.");
    }

    const hasLiked = post.likes.includes(userId);

    res.status(200).json({ hasLiked });
  } catch (error) {
    res.status(500).send("An error occurred while checking the like status.");
    console.error(error);
  }
});

app.post("/comment", async (req, res) => {
  const postId = req.body.postId;
  const userId = req.body.userId;
  const text = req.body.text;

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

    const comment = {
      text: text,
      postedBy: userId,
      createdAt: new Date(),
    };

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
  const searchQuery = req.query.name;

  if (!searchQuery) {
    return res.status(400).send("A search query is required.");
  }

  try {
    const regex = new RegExp(searchQuery, "i");

    const users = await User.find({ name: regex });

    if (users.length === 0) {
      return res
        .status(404)
        .send("No users found matching the search criteria.");
    }

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

app.get("/post/:postId", async (req, res) => {
  try {
    const postId = req.params.postId; 

    const post = await Post.findById(postId)
      .populate('postedBy', 'name -_id') 
      .populate({
        path: 'comments.postedBy',
        select: 'name -_id' 
      });

    if (!post) {
      return res.status(404).send("Post not found."); 
    }

    res.status(200).json(post); 
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while retrieving the post.");
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
    `mongodb+srv://folk21434:HtxB6Ry9xO1LK6xe@mythmaker.piqbasd.mongodb.net/database?retryWrites=true&w=majority&appName=mythmaker`,
    {}
  )
  .then(() => {
    app.listen(port, () => {
      console.log(`Started on port ${port}`);
    });
  })
  .catch((err) => console.error("Could not connect to MongoDB", err));

const db = mongoose.connection;
