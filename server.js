// load Express.js, the MongoDB native driver and Node's path module
const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

// parse JSON request bodies (req.body)
app.use(express.json());

// ---------------------------------------------------------------
// MIDDLEWARE 1: logger - prints every request to the server console
// ---------------------------------------------------------------
app.use(function (req, res, next) {
    const start = Date.now();

    // "finish" fires once the response has been sent, so we can log the status code too
    res.on("finish", function () {
        console.log(
            "[" + new Date().toISOString() + "] " +
            req.method + " " + req.originalUrl +
            " -> " + res.statusCode +
            " (" + (Date.now() - start) + " ms)"
        );
    });

    next();
});

// ---------------------------------------------------------------
// MIDDLEWARE 2: CORS - lets the GitHub Pages front-end call this API
// ---------------------------------------------------------------
app.use(function (req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT,DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Origin, Accept, X-Requested-With, Content-Type");

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// ---------------------------------------------------------------
// MIDDLEWARE 3: static files - lesson images from the "images" folder
// e.g. GET /images/maths.jpg
// ---------------------------------------------------------------
const imagePath = path.resolve(__dirname, "images");
app.use("/images", express.static(imagePath));

// only reached when express.static did NOT find the file
app.use("/images", function (req, res) {
    res.status(404).json({ error: "Image not found: " + req.path });
});

// ---------------------------------------------------------------
// MongoDB connection (connection string comes from an environment variable)
// ---------------------------------------------------------------
const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "afterschool";

if (!uri) {
    console.error("MONGODB_URI is not set. Add it to .env (local) or to Render's environment variables.");
    process.exit(1);
}

const client = new MongoClient(uri);
let db;

async function startServer() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log("Connected successfully to MongoDB database: " + dbName);

        // root route, so visiting the base URL shows the API is running
        app.get("/", function (req, res) {
            res.send("After School API is running. Try GET /lessons");
        });

        // -------------------------------------------------------
        // GET /lessons - return all lessons as JSON
        // -------------------------------------------------------
        app.get("/lessons", async function (req, res, next) {
            try {
                const lessons = await db.collection("lessons").find({}).toArray();
                res.json(lessons);
            } catch (err) {
                next(err);
            }
        });

        // -------------------------------------------------------
        // GET /teachers - return all teachers as JSON
        // each teacher: { firstName, lastName, lessonIDs: [...] }
        // -------------------------------------------------------
        app.get("/teachers", async function (req, res, next) {
            try {
                const teachers = await db.collection("teachers")
                    .find({})
                    .sort({ lastName: 1, firstName: 1 })
                    .toArray();
                res.json(teachers);
            } catch (err) {
                next(err);
            }
        });

        // -------------------------------------------------------
        // GET /teachers/:id/lessons - all the lessons taught by one teacher
        // -------------------------------------------------------
        app.get("/teachers/:id/lessons", async function (req, res, next) {
            try {
                if (!ObjectId.isValid(req.params.id)) {
                    return res.status(400).json({ error: "Invalid teacher id" });
                }

                const teacher = await db.collection("teachers").findOne({
                    _id: new ObjectId(req.params.id)
                });

                if (!teacher) {
                    return res.status(404).json({ error: "Teacher not found" });
                }

                // lessonIDs are stored as strings, so convert them back to ObjectIds
                const ids = teacher.lessonIDs
                    .filter(function (id) { return ObjectId.isValid(id); })
                    .map(function (id) { return new ObjectId(id); });

                const lessons = await db.collection("lessons")
                    .find({ _id: { $in: ids } })
                    .toArray();

                res.json(lessons);
            } catch (err) {
                next(err);
            }
        });

        // -------------------------------------------------------
        // GET /search?q=... - search topic, location, price and space
        // (search is done here in the back-end, not in the browser)
        // -------------------------------------------------------
        app.get("/search", async function (req, res, next) {
            try {
                const q = (req.query.q || "").trim();

                if (q === "") {
                    const all = await db.collection("lessons").find({}).toArray();
                    return res.json(all);
                }

                // escape special regex characters so e.g. "+" or "(" are searched literally
                const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

                const query = {
                    $or: [
                        { topic: { $regex: safe, $options: "i" } },
                        { location: { $regex: safe, $options: "i" } },
                        // price and space are numbers, so convert them to strings first
                        { $expr: { $regexMatch: { input: { $toString: "$price" }, regex: safe } } },
                        { $expr: { $regexMatch: { input: { $toString: "$space" }, regex: safe } } }
                    ]
                };

                const results = await db.collection("lessons").find(query).toArray();
                res.json(results);
            } catch (err) {
                next(err);
            }
        });

        // -------------------------------------------------------
        // POST /orders - save a new order
        // body: { name, phone, lessonIDs: [...], spaces: [...] }
        // -------------------------------------------------------
        app.post("/orders", async function (req, res, next) {
            try {
                const order = req.body;

                if (!order.name || !order.phone ||
                    !Array.isArray(order.lessonIDs) || order.lessonIDs.length === 0) {
                    return res.status(400).json({ error: "name, phone and lessonIDs are required" });
                }

                // every lesson id must be a valid ObjectId
                const idsAreValid = order.lessonIDs.every(function (id) {
                    return ObjectId.isValid(id);
                });
                if (!idsAreValid) {
                    return res.status(400).json({ error: "lessonIDs must be valid lesson ids" });
                }

                // spaces holds one positive whole number per lesson id
                const spacesAreValid = Array.isArray(order.spaces) &&
                    order.spaces.length === order.lessonIDs.length &&
                    order.spaces.every(function (n) {
                        return Number.isInteger(n) && n > 0;
                    });
                if (!spacesAreValid) {
                    return res.status(400).json({ error: "spaces must list one positive whole number per lesson" });
                }

                order.createdAt = new Date();

                const result = await db.collection("orders").insertOne(order);
                res.status(201).json({ msg: "success", insertedId: result.insertedId });
            } catch (err) {
                next(err);
            }
        });

        // -------------------------------------------------------
        // PUT /lessons/:id - update ANY attribute of a lesson
        // e.g. body { "space": 3 } sets the available spaces to 3
        // -------------------------------------------------------
        app.put("/lessons/:id", async function (req, res, next) {
            try {
                if (!ObjectId.isValid(req.params.id)) {
                    return res.status(400).json({ error: "Invalid lesson id" });
                }

                const changes = Object.assign({}, req.body);
                delete changes._id; // _id can never be changed

                if (Object.keys(changes).length === 0) {
                    return res.status(400).json({ error: "Nothing to update" });
                }

                // spaces can be set to any whole number from 0 upwards
                if ("space" in changes &&
                    (!Number.isInteger(changes.space) || changes.space < 0)) {
                    return res.status(400).json({ error: "space must be a whole number, 0 or more" });
                }

                const result = await db.collection("lessons").updateOne(
                    { _id: new ObjectId(req.params.id) },
                    { $set: changes }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: "Lesson not found" });
                }
                res.json({ msg: "success" });
            } catch (err) {
                next(err);
            }
        });

        // unknown routes
        app.use(function (req, res) {
            res.status(404).json({ error: "Route not found" });
        });

        // error handler (any next(err) ends up here)
        app.use(function (err, req, res, next) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        });

        // start the server only after MongoDB has connected
        const port = process.env.PORT || 3000;
        const server = app.listen(port, function () {
            console.log("Express.js server running on port " + port);
        });

        // when the process is told to stop (Ctrl+C locally, or a Render redeploy),
        // stop accepting requests and close the MongoDB connection cleanly
        function shutDown(signal) {
            console.log(signal + " received, shutting down");
            server.close(function () {
                client.close().then(function () {
                    process.exit(0);
                });
            });
        }
        process.on("SIGINT", function () { shutDown("SIGINT"); });
        process.on("SIGTERM", function () { shutDown("SIGTERM"); });
    } catch (err) {
        console.error("MongoDB connection failed:", err);
        process.exit(1);
    }
}

startServer();
