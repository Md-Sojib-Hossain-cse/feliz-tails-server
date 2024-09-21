const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_SK)

const port = process.env.PORT || 5000;


app.use(express.json());
app.use(cookieParser());

// middleware
app.use(cors({
    origin: [
        'http://localhost:5173', 'http://localhost:5174',
        'https://feliz-tails.firebaseapp.com',
        'https://feliz-tails.web.app'
    ],
    credentials: true
}));

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
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
};

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const usersCollection = client.db("felizTailsDB").collection("users");
        const petListingCollection = client.db("felizTailsDB").collection("petListing");
        const reviewsCollection = client.db("felizTailsDB").collection("reviews");
        const adoptionRequestCollection = client.db("felizTailsDB").collection("adoptionRequest");
        const donationCampaignCollection = client.db("felizTailsDB").collection("donationCampaign");

        app.get("/", async (req, res) => {
            res.send("Feliz Tails Server is running ...");
        })

        // jwt related api
        app.post("/jwt", async (req, res) => {
            const token = await jwt.sign(req?.body, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "24hr" })
            res.cookie("token", token, cookieOptions).send({ success: true })
        })

        // custom middleware
        const verifyToken = (req, res, next) => {
            const token = req?.cookies?.token;
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


        const verifyAdmin = async (req, res, next) => {
            const userEmail = req?.query?.userEmail;
            const query = { email: userEmail };
            const result = await usersCollection.findOne(query)
            if (result?.role !== "Admin") {
                return res.status(403).send({ message: "forbidden access" })
            }
            next();
        }


        app.post("/logout", async (req, res) => {
            res
                .clearCookie("token", {
                    maxAge: 0,
                    secure: process.env.NODE_ENV === "production" ? true : false,
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                })
                .send({ status: true });
        });

        //user related api
        app.get("/user/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            res.send(result);
        })

        app.get("/users", verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.patch("/users/:id", verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: "Admin",
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

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
            const page = req?.query?.page || 1;
            const limit = req?.query?.limit || 5;
            let query = { adopted: false };
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

        app.get("/my-pets-adoption-request/:email", async (req, res) => {
            const email = req.params.email;
            const result = await adoptionRequestCollection.aggregate([
                {
                    $match: { "petInfo.addedBy.email": email }
                },
                {
                    $unwind: "$userInfo"
                },
                {
                    $project: {
                        _id: 1,
                        "petInfo._id": 1,
                        "petInfo.name": 1,
                        "petInfo.image": 1,
                        "petInfo.adopted": 1,
                        "petInfo.addedBy": 1,
                        "userInfo": 1,
                    }
                }
            ]).toArray();
            res.send(result);
        })

        app.patch("/my-pets-adoption-request", async (req, res) => {
            const listingId = req.query.listingId;
            const adoptionRequestId = req.query.adoptionRequestId;
            const filter = { _id: new ObjectId(listingId) };
            const updatedDoc = {
                $set: {
                    adopted: true,
                }
            }
            const query = { _id: new ObjectId(adoptionRequestId) };
            const updatedDoc2 = {
                $set: {
                    "petInfo.adopted": true,
                }
            }
            const result = await petListingCollection.updateOne(filter, updatedDoc);
            if (result.modifiedCount) {
                const result2 = await adoptionRequestCollection.updateOne(query, updatedDoc2);
                res.send(result2);
            }
        })

        app.delete("/my-pets-adoption-request/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await adoptionRequestCollection.deleteOne(query);
            res.send(result);
        })


        app.get("/all-pets", verifyAdmin, async (req, res) => {
            const result = await petListingCollection.find().toArray();
            res.send(result);
        })

        app.patch("/pet-listing/:id" , verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updateBy = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    ...updateBy,
                }
            }
            const result = await petListingCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete("/pet-listing/:id" , verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await petListingCollection.deleteOne(query);
            res.send(result);
        })

        // add pets by user
        app.post("/add-a-pet", async (req, res) => {
            const petInfo = req.body;
            const query = {
                name: petInfo.name,
                "addedBy.email": petInfo.addedBy.email,
            }
            const isExist = await petListingCollection.findOne(query);
            if (isExist) {
                return res.send({ message: "pet already exist" });
            }
            const result = await petListingCollection.insertOne(petInfo);
            res.send(result);
        })

        //get added pets by user
        app.get("/my-added-pets/:email", async (req, res) => {
            const email = req.params.email;
            const query = { "addedBy.email": email };
            const result = await petListingCollection.find(query).toArray();
            res.send(result)
        })

        app.delete("/my-added-pets/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await petListingCollection.deleteOne(query);
            res.send(result);
        })

        app.patch("/my-added-pets/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    adopted: true,
                }
            }
            const result = await petListingCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        //single pet details related api
        app.get("/petDetails/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await petListingCollection.findOne(query);
            res.send(result);
        })

        //update pet info 
        app.put("/update-a-pet/:id", async (req, res) => {
            const id = req.params.id;
            const updatedInfo = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    ...updatedInfo,
                }
            }
            const result = await petListingCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        //donation campaign related api

        app.get("/donation-campaign-recommended", async (req, res) => {
            const page = req?.query?.page || 1;
            const limit = req?.query?.limit || 3;
            const sortBy = { createdAt: -1 };
            const result = await donationCampaignCollection.find().skip((page - 1) * limit).limit(page * limit).sort(sortBy).toArray();
            res.send(result);
        })

        app.get("/donation-campaign", async (req, res) => {
            const page = req?.query?.page || 1;
            const limit = req?.query?.limit || 5;
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

        app.post("/donation-campaign", async (req, res) => {
            const campaignDetails = req.body;
            const query = {
                petName: campaignDetails?.petName,
                'addedBy.email': campaignDetails?.addedBy?.email,
            }
            const isExist = await donationCampaignCollection.findOne(query);
            if (isExist) {
                return res.send({ message: "campaign already exist" });
            }
            const result = await donationCampaignCollection.insertOne(campaignDetails);
            res.send(result);
        })

        app.patch("/edit-donation-campaign/:id", async (req, res) => {
            const id = req.params.id;
            const updatedInfo = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    ...updatedInfo,
                }
            }
            const result = await petListingCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete("/all-donation-campaign/:id", verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await petListingCollection.deleteOne(query);
            res.send(result);
        })

        app.patch("/all-donation-campaign/:id", verifyAdmin, async (req, res) => {
            const id = req?.params?.id;
            const updatedInfo = req.body;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    ...updatedInfo
                }
            }
            const result = await donationCampaignCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        app.patch("/donation-campaign/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const donationData = req.body;
            const previousDonation = await donationCampaignCollection.aggregate([
                {
                    $match: { _id: new ObjectId(id) }
                },
                {
                    $unwind: "$donationDetails"
                },
                {
                    $group: {
                        _id: "$_id",
                        totalDonationAmount: { $sum: "$donationDetails.amount" }
                    }
                }
            ]).toArray();
            const currentTotal = parseInt(previousDonation[0]?.totalDonationAmount) > 0 ? parseInt(previousDonation[0]?.totalDonationAmount) : 0;
            const totalDonation = currentTotal + parseInt(donationData.amount);
            const updatedDoc = {
                $push: {
                    donationDetails:
                        { ...donationData }
                },
                $set: {
                    donatedAmount: totalDonation
                }
            }
            const upsert = true;
            const result = await donationCampaignCollection.updateOne(query, updatedDoc, upsert)
            res.send(result);
        })

        //my donation campaign related api 
        app.get("/my-donation-campaign", async (req, res) => {
            const userEmail = req.query.email;
            const query = { 'addedBy.email': userEmail };
            const result = await donationCampaignCollection.find(query).toArray();
            res.send(result);
        })
        app.get("/my-donation-campaign/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await donationCampaignCollection.findOne(query);
            res.send(result);
        })

        app.get("/my-donations/:email", async (req, res) => {
            const email = req.params.email;
            const result = await donationCampaignCollection.aggregate([
                {
                    $match: { "donationDetails.donatorEmail": email }
                },
                {
                    $unwind: "$donationDetails"
                },
                {
                    $match: { "donationDetails.donatorEmail": email }
                },
                {
                    $project: {
                        _id: 1,
                        petName: 1,
                        petImage: 1,
                        "donationDetails.amount": 1,
                        "donationDetails.transactionId": 1,
                        "donationDetails.donatorEmail": 1
                    }
                }
            ]).toArray();
            res.send(result);
        })

        app.patch("/my-donations", async (req, res) => {
            const id = req?.query?.id;
            const transactionId = req?.query?.transactionId;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $pull: {
                    donationDetails: {
                        transactionId: transactionId,
                    }
                }
            }
            const result = await donationCampaignCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        app.patch("/my-donation-campaign/:id", async (req, res) => {
            const id = req.params.id;
            const isPaused = req.query.paused;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    isPaused: isPaused,
                }
            }
            const result = await donationCampaignCollection.updateOne(filter, updatedDoc);
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
            const isDataExist = await adoptionRequestCollection.findOne(query);
            if (isDataExist) {
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
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);