import express from "express";
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import mongoose from "mongoose";
import User from "./modules/User.js";
import Post from "./modules/posts.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createToken, validateToken } from "./jwt.js";

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.REGION,
});

const polly = new AWS.Polly();

const app = express();
const port = 3000;

app.use(express.json());

app.post("/", async (req, res) => {
  res.send("Welcome To MythMaker Backend");
});



app.get("/userInfo/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).send("An error occurred while retrieving user data.");
    console.error(error);
  }
});





app.post('/speak', async (req, res) => {
  const { text, voiceId } = req.body;  
  const params = {
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: voiceId || 'Joanna'  
  };

  try {
    const { AudioStream } = await polly.synthesizeSpeech(params).promise();
    if (AudioStream instanceof Buffer) {
      res.writeHead(200, {
        'Content-Type': 'audio/mp3',
        'Content-Length': AudioStream.length
      });
      res.end(AudioStream);
    } else {
      res.status(404).send('Audio stream not available');
    }
  } catch (err) {
    console.error('Error calling Amazon Polly:', err);
    res.status(500).send(err.message);
  }
});

app.get("/searchPosts", async (req, res) => {
  const { query } = req.query; 

  if (!query) {
    return res.status(400).send("Search query is required.");
  }

  try {
    const posts = await Post.find({
      $or: [
        { title: { $regex: query, $options: "i" } }, 
        { story: { $regex: query, $options: "i" } }  
      ]
    })
    .populate("postedBy", "name pfp -_id")  
    .populate({
      path: "comments.postedBy",
      select: "name pfp -_id",  
    });


    res.json(posts); 
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while searching for posts.");
  }
});
app.post("/follow", async (req, res) => {
    const currentUserId = req.body.currentUserId;
    const targetUserId = req.body.targetUserId;

    if (!currentUserId || !targetUserId) {
        return res.status(400).send("Both current user ID and target user ID are required.");
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

        if (targetUser.followers.includes(currentUserId)) {
            return res.status(400).send("You cannot follow a user who is already following you.");
        }

        currentUser.following.push(targetUserId);
        await currentUser.save();

        targetUser.followers.push(currentUserId);
        await targetUser.save();

        // Send Notification to Target User using OneSignal
        const notification = {
            contents: {
                en: "You have a new follower!",
            },
            filters: [
                { field: "tag", key: "id", relation: "=", value: targetUserId }
            ]
        };

        try {
            const response = await client.createNotification(notification);
            console.log("Notification sent with response:", response.body);
        } catch (error) {
            console.error("Error sending notification:", error);
        }

        res.status(200).send("Followed successfully.");
    } catch (error) {
        res.status(500).send("An error occurred during the follow process.");
        console.error(error);
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

    const posts = await Post.find({ postedBy: user._id }).lean();

    const { password, ...userInfo } = user.toObject();
    
    res.json({...userInfo, posts});
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

    if (targetUser.followers.includes(currentUserId)) {
      return res.status(400).send("You cannot follow a user who is already following you.");
    }

    currentUser.following.push(targetUserId);
    await currentUser.save();

    targetUser.followers.push(currentUserId);
    await targetUser.save();

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

    if (!currentUser.following.includes(targetUserId)) {
      return res.status(400).send("You are not following this user.");
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

app.get("/searchPosts", async (req, res) => {
  const { query } = req.query; 

  if (!query) {
    return res.status(400).send("Search query is required.");
  }

  try {
    const posts = await Post.find({
      $or: [
        { title: { $regex: query, $options: "i" } }, 
        { story: { $regex: query, $options: "i" } }  
      ]
    })
    .populate("postedBy", "name -_id") 
    .populate({
      path: "comments.postedBy",
      select: "name -_id",
    });

    res.json(posts); 
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while searching for posts.");
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
      .populate("postedBy", "name pfp _id")  // Include _id in the selection
      .populate({
        path: "comments.postedBy",
        select: "name pfp _id",  // Include _id in the selection
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


app.get("/user/:userId/posts", async (req, res) => {
  try {
    const userId = req.params.userId;

    const posts = await Post.find({ postedBy: userId })
      .populate("postedBy", "name -_id") // Assuming you still want to populate the 'postedBy' field
      .populate({
        path: "comments.postedBy",
        select: "name -_id", // Populating comment authors, adjust as necessary
      });

    if (posts.length === 0) {
      return res.status(404).send("No posts found for this user.");
    }

    res.status(200).json(posts);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send("An error occurred while retrieving the user's posts.");
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

    if (user.following.length > 0) {
      const posts = await Post.find({ postedBy: { $in: user.following } })
        .sort({ createdAt: -1 })
        .populate("postedBy", "pfp name _id")
        .populate({
          path: "comments.postedBy",
          select: "pfp name _id",
        });
      res.status(200).json(posts);
    } else {
      const posts = await Post.find({})
        .sort({ likes: -1 }) 
        .limit(15) 
        .populate("postedBy", "pfp name _id")
        .populate({
          path: "comments.postedBy",
          select: "pfp name _id",
        });
      res.status(200).json(posts);
    }
  } catch (error) {
    res.status(500).send("An error occurred while retrieving the feed.");
    console.error(error);
  }
});

app.patch("/updatePfp/:userId", async (req, res) => {
  const userId = req.params.userId;
  const { pfp } = req.body;

  if (!userId) {
    return res.status(400).send("User ID is required.");
  }

  if (!pfp) {
    return res.status(400).send("Profile picture data is required.");
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { pfp: pfp } },
      { new: true }
    );

    if (!user) {
      return res.status(404).send("User not found.");
    }

    const { password, ...userInfo } = user.toObject();

    res.status(200).json({
      message: "Profile picture updated successfully",
      user: userInfo,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send("An error occurred while updating the profile picture.");
  }
});

app.patch("/updateBio/:userId", async (req, res) => {
  const userId = req.params.userId;
  const { bio } = req.body;

  if (!userId) {
    return res.status(400).send("User ID is required.");
  }

  if (bio === undefined) {
    return res.status(400).send("Bio content is required.");
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { bio: bio } },
      { new: true }
    );

    if (!user) {
      return res.status(404).send("User not found.");
    }

    const { password, ...userInfo } = user.toObject();

    res
      .status(200)
      .json({ message: "Bio updated successfully", user: userInfo });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while updating the bio.");
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
