require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 8080;

// MIDDLEWARE
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://more-blogs-atiq.web.app",
      "https://more-blogs-atiq.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verify = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res
      .status(401)
      .send({ message: "Unauthorize Access, Login First!" });
  }
  // console.log(token)
  jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ message: "Unauthorize Access, Login Again!" });
    }
    req.user = decoded;
    next();
  });
  // next()
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    const blogs = client.db("MoreBlogs").collection("Blogs");
    blogs.createIndex(
      { title: "text", category: "text", author: "text" },
      { name: "title_text_category_text_author_text" }
    );

    const comments = client.db("MoreBlogs").collection("Comments");
    const categories = client.db("MoreBlogs").collection("Categories");
    const wishlist = client.db("MoreBlogs").collection("Wishlist");

    // Auth with jwt

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET, {
        expiresIn: "3d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Blogs

    app.post("/addBlog", verify, (req, res) => {
      const blogCredentials = req.body;

      if (req.user.email !== blogCredentials.author_email) {
        return res
          .status(403)
          .send({ message: "Forbidden Access!" });
      }

      blogs
        .insertOne(blogCredentials)
        .then((result) => {
          console.log(`A Blog was inserted with the _id: ${result.insertedId}`);
          res.status(201).send(`Blog added`);
        })
        .catch((error) => {
          console.error(`Failed to add Blog: ${error}`);
          res.status(500).send("Failed to add Blog.");
        });
    });

    app.get("/blogs", (req, res) => {
      let { query, limit, projection, sort } = req.query;

      blogs
        .find(query)
        .limit(Number(limit))
        .project(projection)
        .sort(sort)
        .toArray()
        .then((result) => {
          res.status(200).send(result);
        })
        .catch((error) => {
          console.error(`Failed to find Blogs: ${error}`);
          res.status(500).send("Failed to find Blogs.");
        });
    });




  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`SERVER IS RUNNING AT PORT: ${port}`);
});
