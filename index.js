const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_SK)

const port = process.env.PORT || 5000;

//middleware
app.use(cors({
    origin: [
        'http://localhost:5173', 'http://localhost:5174',
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

//custom middleware
const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    console.log(token, req.cookie, req.cookie?.token)
    if (!token) {
        return res.status(401).send({ message: "unauthorized access" })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorized access" })
        }
        req.user = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jnc3ejx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db("felizTailsDB").collection("users");
        const petListingCollection = client.db("felizTailsDB").collection("petListing");
        const reviewsCollection = client.db("felizTailsDB").collection("reviews");
        const adoptionRequestCollection = client.db("felizTailsDB").collection("adoptionRequest");
        const donationCampaignCollection = client.db("felizTailsDB").collection("donationCampaign");


        //custom middleware 
        const verifyAdmin = async (req, res, next) => {
            const user = req?.user;
            console.log(user?.email)
            const query = { email: user?.email };
            const result = await usersCollection.findOne(query)
            console.log(result)
            if (result.role !== "admin") {
                return res.status(401).send({ message: "unauthorized access" })
            }
            next();
        }

        app.get("/", async (req, res) => {
            res.send("Feliz Tails Server is running ...");
        })

        //jwt related api
        app.post("/jwt", async (req, res) => {
            const token = await jwt.sign(req.body, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "24hr" })
            res.cookie("token", token, cookieOptions).send({ success: true })
        })

        //user related api
        app.post("/users", async (req, res) => {
            const userInfo = req.body;
            const query = { email: userInfo.email };
            const isExist = await usersCollection.findOne(query);
            if (isExist) {
                return;
            }
            const result = await usersCollection.insertOne(userInfo);
            res.send(result);
        })

        //pet listing related api
        app.get("/pet-listing", async (req, res) => {
            const searchedCategory = req.query.category;
            const searchedName = req.query.name;
            const page = req.query.page;
            const limit = req.query.limit;
            let query = {};
            if (searchedCategory) {
                query = { ...query, category: searchedCategory };
            }
            if (searchedName) {
                query = { ...query, name: { $regex: searchedName, $options: "i" } };
            }
            const sortBy = { date: -1 };
            const result = await petListingCollection.find(query).limit(page * limit).sort(sortBy).toArray();
            res.send(result);
        })

        //single pet details related api
        app.get("/petDetails/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await petListingCollection.findOne(query);
            res.send(result);
        })

        //donation campaign related api
        app.get("/donation-campaign", async (req, res) => {
            const page = req.query.page;
            const limit = req.query.limit;
            const sortBy = { createdAt: -1 };
            const result = await donationCampaignCollection.find().skip((page - 1) * limit).limit(page * limit).sort(sortBy).toArray();
            res.send(result);
        })

        app.get("/donation-campaign/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await donationCampaignCollection.findOne(query);
            res.send(result);
        })

        app.patch("/donation-campaign/:id", async (req, res) => {
            const id = req.params.id;
            const query = {_id : new ObjectId(id)};
            const donationData = req.body;
            console.log(id , query , donationData)
            const previousDonation = await donationCampaignCollection.aggregate([
                {
                    $match: { _id: new ObjectId(id) }
                },
                {
                    $unwind: "$donationDetails"
                },
                {
                    $group: {
                        _id : "$_id",
                        totalDonationAmount: { $sum: "$donationDetails.amount" }
                    }
                }
            ]).toArray();
            const currentTotal = parseInt(previousDonation[0].totalDonationAmount) > 0 ? parseInt(previousDonation[0].totalDonationAmount) : 0;
            const totalDonation = currentTotal + parseInt(donationData.amount);
            const updatedDoc = {
                $push : {
                    donationDetails : 
                        {...donationData}
                },
                $set : {
                    donatedAmount : totalDonation
                }
            }
            const upsert = true;
            const result = await donationCampaignCollection.updateOne(query , updatedDoc , upsert)
            res.send(result);
        })


        //adoption requiest
        app.post("/adoption-request", async (req, res) => {
            const requestData = req.body;
            //checking if user already request once 
            const query = {
                'userInfo.userEmail': requestData.userInfo.userEmail,
                'petInfo._id': requestData.petInfo._id,
            }
            const idDataExist = await adoptionRequestCollection.findOne(query);
            if (idDataExist) {
                return res.send({ message: "Request already Exist" })
            }
            const result = await adoptionRequestCollection.insertOne(requestData);
            res.send(result);
        })

        //reviews related api
        app.get("/reviews", async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        })

        //payment related api
        app.post("/create-payment-intent", async (req, res) => {
            const { donationAmount } = req.body;
            const amount = parseInt(donationAmount * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                "payment_method_types": [
                    "card"
                ],
            })

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.listen(port, () => {
            console.log(`Example app listening on port ${port}`)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);