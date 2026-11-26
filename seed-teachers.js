// Fills the "teachers" collection in MongoDB Atlas:
//   npm run seed:teachers
// Each teacher has a first name, a last name and the ids of the lessons they teach.
// Lessons are looked up by topic, so this does NOT change the existing lessons.
// WARNING: this deletes all existing teachers first.
const { MongoClient } = require("mongodb");

const teachers = [
    { firstName: "Sarah",  lastName: "Ahmed",    topics: ["Mathematics", "Physics"] },
    { firstName: "James",  lastName: "Walker",   topics: ["English", "History"] },
    { firstName: "Layla",  lastName: "Hassan",   topics: ["Science", "Biology"] },
    { firstName: "Omar",   lastName: "Khalil",   topics: ["Chemistry", "Geography"] },
    { firstName: "Priya",  lastName: "Nair",     topics: ["Computer Science", "Business Studies"] }
];

async function seedTeachers() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME || "afterschool");

        const lessons = await db.collection("lessons").find({}).toArray();

        const docs = teachers.map(function (teacher) {
            const lessonIDs = lessons
                .filter(function (lesson) {
                    return teacher.topics.indexOf(lesson.topic) !== -1;
                })
                .map(function (lesson) {
                    return lesson._id.toString();
                });

            return {
                firstName: teacher.firstName,
                lastName: teacher.lastName,
                lessonIDs: lessonIDs
            };
        });

        await db.collection("teachers").deleteMany({});
        const result = await db.collection("teachers").insertMany(docs);
        console.log("Inserted " + result.insertedCount + " teachers.");
    } finally {
        await client.close();
    }
}

seedTeachers().catch(function (err) {
    console.error(err);
    process.exit(1);
});
