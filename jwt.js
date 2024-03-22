import jwt from "jsonwebtoken";

export const createToken = (user) => {
  try {
    const accessToken = jwt.sign(
      {
        email: user.email,   
        id: user._id,        
      },
      '123',
    );
    return accessToken;
  } catch (error) {
    console.error('Error creating token:', error);
    return null;
  }
};



export const validateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Authorization header is required");
  }

  const accessToken = authHeader.split(" ")[1];

  try {
    const validToken = jwt.verify(accessToken,'123');
    req.user = validToken;
    return next();
  } catch (e) {
    return res.status(403).send("Invalid or expired token");
  }
};
