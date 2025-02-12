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
      let { query={},skip="0", limit="0", sort={} } = req.query;
      // console.log(req.query)
      blogs
      .find(query).skip(Number(skip)).limit(Number(limit)).sort(sort).toArray()
        .then((result) => {
          res.status(200).send(result);
        })
        .catch((error) => {
          console.error(`Failed to find Blogs: ${error}`);
          res.status(500).send("Failed to find Blogs.");
        });
    });

    app.get("/myBlogs", (req, res) => {
      let { query={},skip="0", limit="0", sort={} } = req.query;

      blogs
        .find(query)
        .sort(sort)
        .toArray()
        .then((result) => {
          res.status(200).json(result);
        })
        .catch((error) => {
          console.error(`Failed to find any blogs with the author email: ${author_email}: ${error}`);
          res.status(500).send(`Failed to find any blogs with the author email: ${author_email}.`);
        });
    });

    app.get("/blog-count", async (req, res) => {
      let { query={} } = req.query;

      try {
        const result =await blogs.countDocuments(query)
        res.status(200).json(result)
      } catch (error) {
        console.error(`Failed to count blogs: ${error}`);
        res.status(500).send("Failed to count blogs.");
      }
    });

    app.get("/blog/:_id", (req, res) => {
      let _id = new ObjectId(req.params._id);
      blogs
        .findOne({ _id })
        .then((result) => {
          res.status(200).json(result);
        })
        .catch((error) => {
          console.error(`Failed to find Blog: ${error}`);
          res.status(500).send("Failed to find Blog.");
        });
    });

    app.put("/updateBlog", verify, (req, res) => {
      const {
        _id,
        image,
        category,
        title,
        short_description,
        long_description,
        word_count,
        author_email,
      } = req.body;

      if (req.user.email !== author_email) {
        return res
          .status(403)
          .send({ message: "Forbidden Access, email don't match!" });
      }

      const objectId = new ObjectId(_id);
      const query = { _id: objectId };

      const update = {
        $set: {
          image,
          category,
          title,
          short_description,
          long_description,
          word_count,
        },
      };
      const options = { upsert: false };

      blogs
        .updateOne(query, update, options)
        .then((result) => {
          console.log(
            `${result.modifiedCount} Blog with the _id: ${_id} was Updated `
          );
          res.status(200).send(`${result.modifiedCount} Blog Updated`);
        })
        .catch((error) => {
          console.error(`Failed to Update Blog: ${error}`);
          res.status(500).send("Failed to Update Blog.");
        });
    });


    // Comments

    app.post("/addComment", (req, res) => {
      const commentCredentials = req.body;

      comments
        .insertOne(commentCredentials)
        .then((result) => {
          console.log(
            `A Comment was inserted with the _id: ${result.insertedId}`
          );
          res.status(201).send(`Comment added`);
        })
        .catch((error) => {
          console.error(`Failed to add Comment: ${error}`);
          res.status(500).send("Failed to add Comment.");
        });
    });

    app.get("/comments", (req, res) => {
      let { query, limit, sort } = req.query;
      // console.log(query, sort);
      comments
        .find(query)
        .limit(Number(limit))
        .sort(sort)
        .toArray()
        .then((result) => {
          res.status(200).send(result);
        })
        .catch((error) => {
          console.error(`Failed to find Comment: ${error}`);
          res.status(500).send("Failed to find Comment.");
        });
    });

    // Wishlist

    app.post("/addToWishlist", (req, res) => {
      const wishlistCredentials = req.body;
      wishlist
        .insertOne(wishlistCredentials)
        .then((result) => {
          console.log(
            `A blog was inserted to wishlist with the _id: ${result.insertedId}`
          );
          res.status(201).send(`blog added to the wishlist`);
        })
        .catch((error) => {
          console.error(`Failed to add blog to wishlist: ${error}`);
          res.status(500).send("Failed to add blog to the wishlist.");
        });
    });

    app.get("/Wishlist", verify, (req, res) => {
      let { query, sort } = req.query;

      if (req.user.email !== query?.user_email) {
        return res
          .status(403)
          .send({ message: "Forbidden Access, email don't match!" });
      }

      wishlist
        .find(query)
        .sort(sort)
        .toArray()
        .then((result) => {
          res.status(200).json(result);
        })
        .catch((error) => {
          console.error(`Failed to find any blogs from the wishlist: ${error}`);
          res.status(500).send("Failed to find any blogs from the wishlist.");
        });
    });

    app.delete("/deleteWishlist/:_id", (req, res) => {
      let _id = new ObjectId(req.params._id);

      wishlist
        .deleteOne({ _id })
        .then((result) => {
          console.log(
            `${result.deletedCount} blog with the _id:${_id} was deleted from the wishlist`
          );
          res
            .status(200)
            .send(`${result.deletedCount} blog was deleted from the wishlist`);
        })
        .catch((error) => {
          console.error(`Failed to delete blog from the wishlist: ${error}`);
          res.status(500).send("Failed to delete blog from the wishlist.");
        });
    });

    // Categories

    app.put("/updateCategory", (req, res) => {
      const categoryCredentials = req.body;

      const pipeline = [
        {
          $match: { category: categoryCredentials.category },
        },
        {
          $group: {
            _id: "$category",
            totalBlogs: { $sum: 1 },
          },
        },
        {
          $project: {
            category: "$_id",
            totalBlogs: 1,
            _id: 0,
          },
        },
      ];

      blogs
        .aggregate(pipeline)
        .next()
        .then((categoryData) => {
          let query, update, options;

          if (categoryData) {
            console.log("category Details:", categoryData);

            query = { category: categoryData.category };
            update = { $set: categoryData };
            options = { upsert: false };
          } else {
            console.log("No details found for the specified category.");

            query = { category: categoryCredentials.category };
            update = { $set: { totalBlogs: 0 } };
            options = { upsert: false };
          }

          return categories.updateOne(query, update, options);
        })
        .then((result) => {
          console.log(`${categoryCredentials.category} category was upserted`);
          res.status(201).send(`A category was upserted`);
        })
        .catch((error) => {
          console.error(`Failed to upsert category: ${error}`);
          res.status(500).send("Failed to upsert category.");
        });
    });

    // app.put('/updateCategories', (req, res) => {
    //   const pipeline = [
    //     {
    //       $group: {
    //         _id: "$category",
    //         totalBlogs: { $sum: 1 },
    //       },
    //     },
    //     {
    //       $project: {
    //         category: "$_id",
    //         totalBlogs: 1,
    //         _id: 0,
    //       },
    //     },
    //   ];

    //   blogs.aggregate(pipeline).toArray()
    //     .then((categoriesData) => {
    //       console.log("Categories Data:", categoriesData);

    //       const bulkDatas = categoriesData.map((data) => ({
    //         updateOne: {
    //           filter: { category: data.category },
    //           update: { $set: data },
    //           upsert: false,
    //         },
    //       }));

    //       return categories.bulkWrite(bulkDatas);
    //     })
    //     .then((result) => {
    //       console.log("Categories updated successfully:", result);
    //       res.status(201).send(`Categories updated successfully.`);
    //     })
    //     .catch((error) => {
    //       console.error(`Failed to update categories: ${error}`);
    //       res.status(500).send('Failed to update categories.');
    //     });
    // });

    app.get("/categories", (req, res) => {
      let { query, limit, sort } = req.query;

      categories
        .find(query)
        .limit(Number(limit))
        .sort(sort)
        .toArray()
        .then((result) => {
          res.status(200).send(result);
        })
        .catch((error) => {
          console.error(`Failed to find categories: ${error}`);
          res.status(500).send("Failed to find categories.");
        });
    });

    app.get("/category/:_id", (req, res) => {
      let _id = new ObjectId(req.params._id);

      categories
        .findOne({ _id })
        .then((result) => {
          res.status(200).json(result);
        })
        .catch((error) => {
          console.error(`Failed to find category: ${error}`);
          res.status(500).send("Failed to find category.");
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
