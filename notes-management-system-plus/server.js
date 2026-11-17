
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// 1. NOTE MODEL
// ==========================================

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },

    category: {
      type: String,
      enum: ["Class", "Assignment", "Personal", "Revision", "Other"],
      default: "Class"
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium"
    },

    pinned: {
      type: Boolean,
      default: false
    },

    archived: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const Note = mongoose.model("Note", noteSchema);

// ==========================================
// 2. PERSONAL GALLERY MODEL
// ==========================================

const gallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    category: {
      type: String,
      default: "General",
      trim: true,
      maxlength: 50
    },

    filename: {
      type: String,
      required: true
    },

    contentType: {
      type: String,
      required: true,
      enum: ["image/jpeg", "image/png", "image/webp", "image/gif"]
    },

    data: {
      type: Buffer,
      required: true
    },

    size: {
      type: Number,
      required: true
    }
  },
  { timestamps: true }
);

const GalleryImage = mongoose.model(
  "GalleryImage",
  gallerySchema
);

// ==========================================
// 3. GALLERY SETTINGS MODEL
// ==========================================

const gallerySettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true
    },

    viewMode: {
      type: String,
      enum: ["grid", "list"],
      default: "grid"
    },

    defaultCategory: {
      type: String,
      default: "General",
      maxlength: 50
    }
  },
  { timestamps: true }
);

const GallerySettings = mongoose.model(
  "GallerySettings",
  gallerySettingsSchema
);

// ==========================================
// 4. IMAGE UPLOAD CONFIGURATION
// ==========================================

const storage = multer.memoryStorage();

const imageUpload = multer({
  storage: storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG, WEBP and GIF images are allowed.")
      );
    }

    callback(null, true);
  }
});

// ==========================================
// 5. HELPER FUNCTION
// ==========================================

function validId(id) {
  return mongoose.isValidObjectId(id);
}

// ==========================================
// 6. DATABASE HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected"
  });
});

// ==========================================
// 7. GET ALL NOTES
// ==========================================

app.get("/api/notes", async (req, res) => {
  try {
    const filter = {};

    if (req.query.archived === "true") {
      filter.archived = true;
    } else if (req.query.archived !== "all") {
      filter.archived = false;
    }

    if (req.query.category && req.query.category !== "All") {
      filter.category = req.query.category;
    }

    if (req.query.priority && req.query.priority !== "All") {
      filter.priority = req.query.priority;
    }

    if (req.query.search) {
      const term = req.query.search.trim();

      if (term) {
        filter.$or = [
          { title: { $regex: term, $options: "i" } },
          { content: { $regex: term, $options: "i" } }
        ];
      }
    }

    const notes = await Note.find(filter)
      .sort({ pinned: -1, updatedAt: -1 });

    res.json(notes);

  } catch (error) {
    console.error("Notes error:", error);

    res.status(500).json({
      message: "Could not load notes."
    });
  }
});

// ==========================================
// 8. DASHBOARD STATISTICS
// ==========================================

app.get("/api/stats", async (req, res) => {
  try {
    const [
      total,
      active,
      archived,
      pinned,
      highPriority
    ] = await Promise.all([
      Note.countDocuments(),

      Note.countDocuments({
        archived: false
      }),

      Note.countDocuments({
        archived: true
      }),

      Note.countDocuments({
        pinned: true,
        archived: false
      }),

      Note.countDocuments({
        priority: "High",
        archived: false
      })
    ]);

    res.json({
      total,
      active,
      archived,
      pinned,
      highPriority
    });

  } catch (error) {
    console.error("Statistics error:", error);

    res.status(500).json({
      message: "Could not load dashboard statistics."
    });
  }
});

// ==========================================
// 9. ANALYTICS API
// ==========================================

app.get("/api/analytics", async (req, res) => {
  try {
    const [
      total,
      active,
      archived,
      byCategory,
      byPriority
    ] = await Promise.all([
      Note.countDocuments(),

      Note.countDocuments({
        archived: false
      }),

      Note.countDocuments({
        archived: true
      }),

      Note.aggregate([
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]),

      Note.aggregate([
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
    ]);

    res.json({
      total,
      active,
      archived,
      byCategory,
      byPriority
    });

  } catch (error) {
    console.error("Analytics error:", error);

    res.status(500).json({
      message: "Could not load analytics data."
    });
  }
});

// ==========================================
// 10. CREATE NOTE
// ==========================================

app.post("/api/notes", async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      priority
    } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({
        message: "Title and content are required."
      });
    }

    const note = await Note.create({
      title,
      content,
      category,
      priority
    });

    res.status(201).json(note);

  } catch (error) {
    console.error("Create note error:", error);

    res.status(400).json({
      message: "Could not create note."
    });
  }
});

// ==========================================
// 11. UPDATE NOTE
// ==========================================

app.put("/api/notes/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid note ID."
      });
    }

    const updates = {};

    [
      "title",
      "content",
      "category",
      "priority",
      "pinned",
      "archived"
    ].forEach((key) => {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    if (
      updates.title !== undefined &&
      !String(updates.title).trim()
    ) {
      return res.status(400).json({
        message: "Title cannot be empty."
      });
    }

    if (
      updates.content !== undefined &&
      !String(updates.content).trim()
    ) {
      return res.status(400).json({
        message: "Content cannot be empty."
      });
    }

    const note = await Note.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!note) {
      return res.status(404).json({
        message: "Note not found."
      });
    }

    res.json(note);

  } catch (error) {
    console.error("Update note error:", error);

    res.status(400).json({
      message: "Could not update note."
    });
  }
});

// ==========================================
// 12. DELETE NOTE
// ==========================================

app.delete("/api/notes/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid note ID."
      });
    }

    const note = await Note.findByIdAndDelete(
      req.params.id
    );

    if (!note) {
      return res.status(404).json({
        message: "Note not found."
      });
    }

    res.json({
      message: "Note deleted successfully."
    });

  } catch (error) {
    console.error("Delete note error:", error);

    res.status(500).json({
      message: "Could not delete note."
    });
  }
});

// ==========================================
// 13. GET ALL GALLERY IMAGES
// ==========================================

app.get("/api/gallery", async (req, res) => {
  try {
    const filter = {};

    if (req.query.category) {
      filter.category = req.query.category;
    }

    const images = await GalleryImage.find(filter)
      .select("-data")
      .sort({ createdAt: -1 });

    res.json(images);

  } catch (error) {
    console.error("Gallery error:", error);

    res.status(500).json({
      message: "Could not load gallery images."
    });
  }
});

// ==========================================
// 14. UPLOAD GALLERY IMAGE
// ==========================================

app.post(
  "/api/gallery",
  imageUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Please select an image."
        });
      }

      const title = (
        req.body.title || req.file.originalname
      ).trim().slice(0, 100);

      const category = (
        req.body.category || "General"
      ).trim().slice(0, 50);

      if (!title) {
        return res.status(400).json({
          message: "Image title is required."
        });
      }

      const image = await GalleryImage.create({
        title,
        category,
        filename: crypto.randomUUID(),
        contentType: req.file.mimetype,
        data: req.file.buffer,
        size: req.file.size
      });

      res.status(201).json({
        message: "Image uploaded successfully.",

        image: {
          _id: image._id,
          title: image.title,
          category: image.category,
          size: image.size,
          contentType: image.contentType,
          createdAt: image.createdAt
        }
      });

    } catch (error) {
      console.error("Upload error:", error);

      res.status(500).json({
        message: "Could not upload image."
      });
    }
  }
);

// ==========================================
// 15. VIEW GALLERY IMAGE
// ==========================================

app.get("/api/gallery/:id/image", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid image ID."
      });
    }

    const image = await GalleryImage.findById(
      req.params.id
    );

    if (!image) {
      return res.status(404).json({
        message: "Image not found."
      });
    }

    res.set("Content-Type", image.contentType);
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "private, no-store");

    res.send(image.data);

  } catch (error) {
    console.error("Image viewing error:", error);

    res.status(500).json({
      message: "Could not display image."
    });
  }
});

// ==========================================
// 16. DELETE GALLERY IMAGE
// ==========================================

app.delete("/api/gallery/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid image ID."
      });
    }

    const image = await GalleryImage.findByIdAndDelete(
      req.params.id
    );

    if (!image) {
      return res.status(404).json({
        message: "Image not found."
      });
    }

    res.json({
      message: "Image deleted successfully."
    });

  } catch (error) {
    console.error("Image deletion error:", error);

    res.status(500).json({
      message: "Could not delete image."
    });
  }
});

// ==========================================
// 17. GET GALLERY SETTINGS
// ==========================================

app.get("/api/gallery/settings", async (req, res) => {
  try {
    let settings = await GallerySettings.findOne({
      key: "default"
    });

    if (!settings) {
      settings = await GallerySettings.create({
        key: "default"
      });
    }

    res.json(settings);

  } catch (error) {
    console.error("Settings error:", error);

    res.status(500).json({
      message: "Could not load gallery settings."
    });
  }
});

// ==========================================
// 18. UPDATE GALLERY SETTINGS
// ==========================================

app.put("/api/gallery/settings", async (req, res) => {
  try {
    const updates = {};

    if (["grid", "list"].includes(req.body.viewMode)) {
      updates.viewMode = req.body.viewMode;
    }

    if (typeof req.body.defaultCategory === "string") {
      updates.defaultCategory =
        req.body.defaultCategory.trim().slice(0, 50) || "General";
    }

    const settings = await GallerySettings.findOneAndUpdate(
      { key: "default" },
      {
        $set: updates,
        $setOnInsert: { key: "default" }
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    res.json({
      message: "Gallery settings saved successfully.",
      settings
    });

  } catch (error) {
    console.error("Settings update error:", error);

    res.status(500).json({
      message: "Could not save gallery settings."
    });
  }
});

// ==========================================
// 19. UPLOAD ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Image must not exceed 5 MB."
          : error.message
    });
  }

  if (
    error.message &&
    error.message.startsWith("Only JPG")
  ) {
    return res.status(400).json({
      message: error.message
    });
  }

  console.error("Server error:", error);

  res.status(500).json({
    message: "An unexpected server error occurred."
  });
});

// ==========================================
// 20. START SERVER
// ==========================================

async function start() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing. Check your .env file."
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully.");

    app.listen(PORT, () => {
      console.log(
        `NoteNest running at http://localhost:${PORT}`
      );
    });

  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

start();
