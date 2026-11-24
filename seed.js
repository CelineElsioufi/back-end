// Run once to fill the "lessons" collection in MongoDB Atlas:
//   npm run seed
// WARNING: this deletes all existing lessons first.
const { MongoClient } = require("mongodb");

const lessons = [
    { topic: "Mathematics",      location: "Dubai",          price: 100, space: 5, capacity: 5, image: "maths.jpg" },
    { topic: "English",          location: "Sharjah",        price: 80,  space: 5, capacity: 5, image: "english.jpg" },
    { topic: "Science",          location: "Abu Dhabi",      price: 120, space: 5, capacity: 5, image: "science.jpg" },
    { topic: "Physics",          location: "Dubai",          price: 150, space: 5, capacity: 5, image: "physics.jpg" },
    { topic: "Chemistry",        location: "Ajman",          price: 110, space: 5, capacity: 5, image: "chemistry.jpg" },
    { topic: "Biology",          location: "Sharjah",        price: 95,  space: 5, capacity: 5, image: "biology.jpg" },
    { topic: "Computer Science", location: "Dubai",          price: 180, space: 5, capacity: 5, image: "computing.jpg" },
    { topic: "History",          location: "Abu Dhabi",      price: 75,  space: 5, capacity: 5, image: "history.jpg" },
    { topic: "Geography",        location: "Ras Al Khaimah", price: 85,  space: 5, capacity: 5, image: "geography.jpg" },
    { topic: "Business Studies", location: "Dubai",          price: 130, space: 5, capacity: 5, image: "business.jpg" }
];

async function seed() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME || "afterschool");

        await db.collection("lessons").deleteMany({});
        const result = await db.collection("lessons").insertMany(lessons);
        console.log("Inserted " + result.insertedCount + " lessons.");
    } finally {
        await client.close();
    }
}

seed().catch(function (err) {
    console.error(err);
    process.exit(1);
});
